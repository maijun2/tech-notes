# 動的 OGP 画像生成(Cloudflare Pages Functions)

各ページのタイトルを埋め込んだ OGP 画像を、Cloudflare Pages Functions で動的生成します。
SNS に URL を貼ると、ページごとに異なる OGP カードが表示されます。

```
GET https://notes.maijun.net/og?title=記事タイトル  →  1200x630 PNG
```

## 仕組み

```
SNS クローラ
   │  <meta property="og:image" content="https://notes.maijun.net/og?title=…">
   ▼
/og  (functions/og.js = Pages Function)
   │  1. title クエリを取得
   │  2. satori        : レイアウト → SVG(テキストはパス化)
   │  3. resvg-wasm    : SVG → PNG(WASM)
   ▼
PNG (image/png, 1 日キャッシュ)
```

- **satori**(`satori/standalone`)… HTML/CSS 風のツリーを SVG に変換。`tools/og.src.js` の `ogTree()` がレイアウト。
- **resvg-wasm**(`@resvg/resvg-wasm`)… SVG を PNG にラスタライズ。
- **`process` shim** … satori はモジュール評価時に `process` を参照します。Workers ランタイムには
  `process` グローバルが無いため、バンドルの先頭(banner)で `globalThis.process||={env:{}}` を定義しています。

### 重要1: WASM は「静的 import」する(実行時 fetch + instantiate は不可)

Cloudflare Workers は **実行時にバイト列から WASM をコンパイルすることを禁止**しています
(`WebAssembly.instantiate(): Wasm code generation disallowed by embedder`)。
そのため WASM は **静的 module として import** し、デプロイ時に Pages にコンパイルさせ、
**事前コンパイル済みの `WebAssembly.Module` を instantiate** します(これは許可される)。

- **resvg**: `functions/resvg.wasm` を import → `initWasm(module)`
- **satori の yoga**: 既定の `satori` は yoga WASM をバイト列から実行時 instantiate するため Workers では失敗する。
  → `satori/standalone`(yoga 自動ロードなし)を使い、`functions/yoga.wasm` を import → `init(module)` で渡す。
- **フォント**は WASM ではなく単なるバイト列(opentype.js が JS で処理)なので、実行時 `fetch` で問題なし。
  `/assets/og/noto-sans-jp-bold-subset.otf` を取得し isolate 内でキャッシュ。
  - サブセット範囲: ASCII / Latin-1 / かな / 各種記号・約物 / 全角半角形 / CJK 統合漢字(U+4E00–U+9FFF)。
    範囲外の漢字・絵文字は欠ける(豆腐になる)ことがあります。

### 重要2: `functions/og.js` は「事前バンドル済み」の自己完結ファイルです

`functions/og.js` は **esbuild で satori と resvg のJSグルーをインライン展開した生成物**です。
JS の外部 import を持たない(2つの `.wasm` は `functions/` 内のローカルファイルを参照)ため、
**Cloudflare 側で `npm install` は不要**です。OGP 生成のためだけにビルドコマンドを設定する
必要はありません。

> 検索(Pagefind)導入後はビルドコマンドに
> `npx -y pagefind --site . --glob "{aws,oci,misc}/**/*.html"` を設定しますが、これは
> `npm install` ではなく Pagefind を `npx` 実行するだけです。`satori` 等の bare import 解決は
> 走らないため、事前バンドル済みの `functions/og.js` には影響しません。仮に `npm install` を
> 含むビルドにしてしまうと、`satori` 等の bare import を解決できず Functions のバンドルが
> 失敗するため、事前バンドル方式でその経路を回避しています。
> なお WASM はバンドルではなく `functions/` 内の `.wasm` ファイルを Pages が解決・コンパイルします。

## ファイル構成

```
functions/og.js                        # /og エンドポイント本体(esbuild 生成物・自己完結)
functions/resvg.wasm                   # resvg WASM(静的 import, 約 2.5 MB)※静的配信されない
functions/yoga.wasm                    # satori の yoga WASM(静的 import, 約 0.07 MB)
tools/og.src.js                        # functions/og.js の元ソース(これを編集して再バンドル)
assets/og/noto-sans-jp-bold-subset.otf # 日本語フォント(静的アセット, 約 3.8 MB)
assets/og/NOTO-SANS-JP-LICENSE.md      # フォントの OFL-1.1 ライセンス
package.json / package-lock.json       # ローカルのバンドル用ツール定義(devDependencies のみ)
```

> `functions/` 内の `.wasm` は Functions のモジュールとして取り込まれ、静的アセットとしては
> 配信されません(`/resvg.wasm` で公開ダウンロードはできない)。

## 各ページへの埋め込み

記事 HTML の `<head>` に以下を入れます(`_template/article.html` に雛形あり。
既存記事には設定済み)。

```html
<meta property="og:type" content="article">
<meta property="og:site_name" content="maijun の技術質問ノート">
<meta property="og:title" content="記事タイトル">
<meta property="og:description" content="結論を 1 文で">
<link rel="canonical" href="https://notes.maijun.net/aws/your-slug">
<meta property="og:url" content="https://notes.maijun.net/aws/your-slug">
<meta property="og:image" content="https://notes.maijun.net/og?title=記事タイトルを encodeURIComponent した値">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
```

- `og:image` の `title=` は **必ず URL エンコード**します(例: `KMS キー` → `KMS%20%E3%82%AD%E3%83%BC`)。
- 記事生成時の自動埋め込みは `note-article` スキル(`.claude/skills/note-article/SKILL.md` の手順 2.5)が行います。

## ローカル動作確認(wrangler pages dev)

```bash
# バンドル用ツールをインストール(node_modules は .gitignore 済み)
npm install

# ローカルで Pages(静的 + Functions)を起動
#  ※ compatibility-date は当日以前の日付を指定する(未指定だと警告が出る)
npm run dev          # = wrangler pages dev . --compatibility-date=2025-07-18

# 別ターミナルで確認(PNG が返ればOK)
curl -s "http://localhost:8788/og?title=テスト記事のタイトル" -o og-test.png
file og-test.png   # → PNG image data, 1200 x 630
```

`wrangler pages dev .` は静的ファイル(`assets/og/*` を含む)も配信するため、
WASM・フォント取得もローカルで再現できます。

## デプロイ

このサイトは **GitHub 連携の Pages 自動ビルド** で運用しています(README 参照)。
**`main` に merge すれば自動デプロイ**されます。`functions/og.js` は事前バンドル済みの
自己完結ファイルなので、Cloudflare 側での `npm install` もビルドコマンドも不要です。

```
note/<slug> ブランチで PR → レビュー → main に merge
        → Cloudflare Pages が functions/og.js と静的アセットをそのまま配信(install 不要)
```

手動でデプロイする場合(任意):

```bash
npx wrangler pages deploy .
```

## Cloudflare Pages の設定

検索(Pagefind)導入後のビルド設定は次のとおりです。OGP(`functions/og.js`)は
事前バンドル済みのため、このビルドで追加の処理は発生しません。

| 項目 | 値 | 補足 |
| --- | --- | --- |
| Build command | `npx -y pagefind --site . --glob "{aws,oci,misc}/**/*.html"` | 検索索引を生成。Pagefind を `npx` 実行するだけで `npm install` は走らない |
| Build output directory | `/`(リポジトリルート) | 変更不要 |
| Node 互換フラグ | 不要 | `process` は banner で shim 済み |

> ⚠️ ビルドコマンドに `npm install` 等を**追加しないこと**。出力ディレクトリが
> リポジトリルート(`/`)のため `node_modules` がアセットとしてアップロードされ得ます。
> Pagefind は `npx` 実行のみで完結し、`functions/og.js` も事前バンドル済みのため
> install 自体が不要です。

## Function(`functions/og.js`)の再生成

レイアウトや色を変えるときは **`tools/og.src.js` を編集** し、再バンドルします
(`functions/og.js` を直接編集しないこと)。

```bash
npm install        # 初回のみ(esbuild / satori / @resvg/resvg-wasm を devDeps として取得)
npm run build:og   # tools/og.src.js -> functions/og.js を再生成(.wasm は --external で外す)
```

WASM(resvg / yoga)を更新する場合は、各パッケージの `.wasm` を `functions/` に上書きコピーします
(これらは静的 import される実体ファイルです)。

```bash
cp node_modules/@resvg/resvg-wasm/index_bg.wasm functions/resvg.wasm
cp node_modules/satori/yoga.wasm                functions/yoga.wasm
```

## フォントサブセットの再生成

カバー範囲を変えたい場合の再生成手順(ローカルの作業ディレクトリで実行):

```bash
# 1) 元フォント(Noto Sans JP Bold, OFL-1.1)を取得
curl -L -o NotoSansJP-Bold.otf \
  https://github.com/notofonts/noto-cjk/raw/main/Sans/SubsetOTF/JP/NotoSansJP-Bold.otf

# 2) サブセット(subset-font = harfbuzz)。ASCII + かな + 記号 + CJK 統合漢字
npm i subset-font
node --input-type=module -e '
import subsetFont from "subset-font";
import { readFile, writeFile } from "node:fs/promises";
const r=(a,b)=>{let s="";for(let c=a;c<=b;c++)s+=String.fromCodePoint(c);return s;};
const chars=[r(0x20,0x7E),r(0xA0,0xFF),r(0x2010,0x2027),r(0x3000,0x303F),
  r(0x3041,0x309F),r(0x30A0,0x30FF),r(0xFF01,0xFF60),r(0x4E00,0x9FFF)].join("");
const out=await subsetFont(await readFile("NotoSansJP-Bold.otf"),chars,{targetFormat:"sfnt"});
await writeFile("noto-sans-jp-bold-subset.otf",out);
'

# 3) 生成物を差し替え
cp noto-sans-jp-bold-subset.otf <repo>/assets/og/noto-sans-jp-bold-subset.otf
```

## トラブルシュート

- **`Wasm code generation disallowed by embedder`** … WASM を実行時にバイト列から instantiate している。
  必ず `.wasm` を静的 import し `WebAssembly.Module` を渡すこと(本実装は対応済み)。
- **ビルドが `Could not resolve "satori"` 等で失敗** … `functions/og.js` を直接編集して
  bare import を持ち込んでいないか確認。必ず `tools/og.src.js` を編集して `npm run build:og` で再生成する。
- **ビルドが `ENOENT … functions/resvg.wasm`** … `functions/resvg.wasm` / `functions/yoga.wasm` が
  コミットされているか確認(静的 import の実体)。
- **404 /og** … `functions/og.js` が deploy に含まれているか、Build output が `/` か確認。
- **500 font fetch failed** … `https://notes.maijun.net/assets/og/noto-sans-jp-bold-subset.otf` が配信されているか確認。
- **文字化け(豆腐)** … サブセット範囲外の文字。上記手順で範囲を広げて再生成する。
- **SNS カードが出ない(画像は /og で正常に返るのに)** … `og:url` / `canonical` が
  `.html` 付きになっていないか確認。Cloudflare Pages は `.html` を **308 で拡張子なしへ
  リダイレクト**するため、`og:url` に `.html` を書くとクローラ(特に X)がカードを生成できない。
  正規 URL は**拡張子なし**(`/aws/your-slug`)で統一する。
- **OGP が更新されない** … X / Facebook 等はカードをキャッシュする。Facebook の
  Sharing Debugger 等で再取得する(X の公開 Card Validator は 2022 に廃止)。
