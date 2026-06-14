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

- **satori**(`satori`)… HTML/CSS 風のツリーを SVG に変換。`functions/og.js` の `ogTree()` がレイアウト。
- **resvg-wasm**(`@resvg/resvg-wasm`)… SVG を PNG にラスタライズ。WASM はバンドルに `import` で取り込む。
- **`process` shim** … satori はモジュール評価時に `process` を参照します。Workers ランタイムには
  `process` グローバルが無いため、`functions/og.js` の冒頭で `globalThis.process ??= { env: {} }` を
  入れてから satori を**動的 import** しています。これによりダッシュボードでの互換フラグ設定が不要になります
  (代替として Settings → Functions → Compatibility flags に `nodejs_compat` を追加する方法もあります)。
- **日本語フォント** … `assets/og/noto-sans-jp-bold-subset.otf`(Noto Sans JP Bold のサブセット, OFL-1.1)。
  Worker バンドルには入れず、静的アセットとして実行時に `fetch` し、isolate 内でキャッシュします。
  - サブセット範囲: ASCII / Latin-1 / かな / 各種記号・約物 / 全角半角形 / CJK 統合漢字(U+4E00–U+9FFF)。
    日常的な日本語の技術記事タイトルはほぼ網羅しますが、範囲外の漢字・絵文字は欠ける(豆腐になる)ことがあります。

## ファイル構成

```
functions/og.js                        # /og エンドポイント本体
assets/og/noto-sans-jp-bold-subset.otf # 日本語フォント(静的アセット, 約 3.8 MB)
assets/og/NOTO-SANS-JP-LICENSE.md      # フォントの OFL-1.1 ライセンス
package.json / package-lock.json       # satori / @resvg/resvg-wasm の依存定義
```

## 各ページへの埋め込み

記事 HTML の `<head>` に以下を入れます(`_template/article.html` に雛形あり。
既存記事には設定済み)。

```html
<meta property="og:type" content="article">
<meta property="og:site_name" content="maijun の技術質問ノート">
<meta property="og:title" content="記事タイトル">
<meta property="og:description" content="結論を 1 文で">
<meta property="og:url" content="https://notes.maijun.net/aws/your-slug.html">
<meta property="og:image" content="https://notes.maijun.net/og?title=記事タイトルを encodeURIComponent した値">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
```

- `og:image` の `title=` は **必ず URL エンコード**します(例: `KMS キー` → `KMS%20%E3%82%AD%E3%83%BC`)。
- 記事生成時の自動埋め込みは `note-article` スキル(`.claude/skills/note-article/SKILL.md` の手順 2.5)が行います。

## ローカル動作確認(wrangler pages dev)

```bash
# 依存をインストール(node_modules は .gitignore 済み)
npm install

# ローカルで Pages(静的 + Functions)を起動
#  ※ compatibility-date は当日以前の日付を指定する(未指定だと警告が出る)
npx wrangler pages dev . --compatibility-date=2025-07-18

# 別ターミナルで確認(PNG が返ればOK)
curl -s "http://localhost:8788/og?title=テスト記事のタイトル" -o og-test.png
file og-test.png   # → PNG image data, 1200 x 630
```

`wrangler pages dev .` は静的ファイル(`assets/og/*.otf` を含む)も配信するため、
フォント取得もローカルで再現できます。

## デプロイ

このサイトは **GitHub 連携の Pages 自動ビルド** で運用しています(README 参照)。
通常は **`main` に merge されれば自動デプロイ**されます。Pages は `package.json` を検出すると
自動で依存をインストールし、`functions/` を Functions としてバンドルします。

```
note/<slug> ブランチで PR → レビュー → main に merge
        → Cloudflare Pages が自動で npm install + functions バンドル + デプロイ
```

手動でデプロイする場合(任意):

```bash
npx wrangler pages deploy .
```

## Cloudflare Pages の設定

GitHub 連携プロジェクトのままで動きます。確認/変更が要るのは次の点だけです。

| 項目 | 値 | 補足 |
| --- | --- | --- |
| Build command | 空欄のまま | `package.json` があれば依存は自動インストールされる |
| Build output directory | `/`(リポジトリルート) | 変更不要 |
| Node 互換 | 不要(コード内で `process` を shim 済み) | satori の `process` 参照はコードで吸収済み。もし他の依存で `process is not defined` が出たら Settings → Functions → Compatibility flags に `nodejs_compat` を追加 |

> **Worker サイズ上限に注意**: resvg の WASM(約 2.5 MB)をバンドルに含めます。
> Free プラン(gzip 後 3 MB)で上限に当たる場合は、WASM も `assets/og/` に置いて
> 実行時 `fetch` + `initWasm(response)` する方式に切り替えてください(フォントと同じ手法)。

## フォントサブセットの再生成

カバー範囲を変えたい場合の再生成手順(リポジトリにスクリプトは置かず、ローカルの作業ディレクトリで実行):

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

- **404 /og** … `functions/og.js` が deploy に含まれているか、Build output が `/` か確認。
- **500 font fetch failed** … `assets/og/noto-sans-jp-bold-subset.otf` が配信されているか
  (`https://notes.maijun.net/assets/og/noto-sans-jp-bold-subset.otf` に直接アクセス)。
- **文字化け(豆腐)** … サブセット範囲外の文字。上記手順で範囲を広げて再生成する。
- **Worker too large** … 上記「Worker サイズ上限」を参照(WASM を静的アセット化)。
- **OGP が更新されない** … X / Facebook 等はカードをキャッシュする。各社のデバッガ
  (X: Post Inspector, Facebook: Sharing Debugger)で再取得する。
