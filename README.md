# 技術質問ノート (notes.maijun.net)

Claude への技術質問を 1 ページ 1 テーマの HTML 記事として蓄積する学習ノートです。
記事の生成・運用は Claude Code (Claude Code on the web) で行い、
Cloudflare Pages で https://notes.maijun.net に公開します。

運用ルールの詳細は [CLAUDE.md](CLAUDE.md)、
記事化の手順は [.claude/skills/note-article/SKILL.md](.claude/skills/note-article/SKILL.md)、
動的 OGP 画像生成のしくみは [docs/ogp-image.md](docs/ogp-image.md) を参照。

## 構成

```
index.html              # トップページ(全記事の目次)
styles/site.css         # 共通スタイル
_template/article.html  # 記事テンプレート
aws/ oci/ misc/         # カテゴリ別の記事
images/                 # 記事用の画像・SVG

functions/og.js         # 動的 OGP 画像生成エンドポイント(/og, Pages Functions・事前バンドル済み)
functions/*.wasm        # og.js が静的 import する WASM(resvg / satori の yoga)
assets/og/              # OGP 用フォント(Noto Sans JP サブセット, OFL-1.1)
tools/og.src.js         # functions/og.js の元ソース(編集後に npm run build:og で再生成)
docs/ogp-image.md       # OGP 生成の設計・デプロイ・再生成手順
package.json            # ローカルのバンドル用ツール定義(devDependencies のみ)
```

記事本体は **静的 HTML のまま**です。OGP 画像は Cloudflare Pages Functions
(`functions/og.js`・事前バンドル済み)で動的生成します。**検索索引のみ**デプロイ時に
[Pagefind](https://pagefind.app) で生成します(`/pagefind/` は生成物のためコミットしません)。
詳細は [docs/ogp-image.md](docs/ogp-image.md) を参照。

## 検索(Pagefind)

全文検索は [Pagefind](https://pagefind.app) を使い、ビルド済みの HTML を直接索引します
(`notes.json` には依存しません)。索引対象は各記事の `<main data-pagefind-body>` 内のみで、
index / カテゴリ / 検索ページは索引から除外されます。検索 UI は `search.html` にあり、
全ページのヘッダ「検索」リンクから開けます。

`npx` で実行する Pagefind は extended 版で、日本語(CJK)のトークナイズに対応します
(各ページに `<html lang="ja">` が必要)。

### Cloudflare Pages のビルド設定(ダッシュボードで人間が設定する)

検索を有効にするには、Cloudflare Pages のプロジェクト設定を次のように変更します。

- **Build command**: `npx -y pagefind --site . --glob "{aws,oci,misc}/**/*.html"`
- **Build output directory**: `/`(変更なし)

> これまで Build command は空欄でしたが、検索索引生成のため上記コマンドを設定します。
> `functions/og.js` は事前バンドル済みのため、このビルドでは追加の処理は不要です。
>
> `--glob` は索引対象を記事ディレクトリ(aws / oci / misc)に限定し、プレースホルダの
> `_template/article.html` を索引から除外するためのものです。記事は必ず
> aws / oci / misc のいずれかに置く運用なので取りこぼしはありません。
> (`--glob` を付けずに `npx -y pagefind --site .` としても動きますが、その場合は
> テンプレートページも検索結果に出ます。)

ローカルでの動作確認(索引生成 + プレビューサーバ起動):

```bash
npx -y pagefind --site . --glob "{aws,oci,misc}/**/*.html" --serve
```

## セットアップ手順(初回のみ)

1. このディレクトリを GitHub リポジトリ `maijun2/tech-notes` として push する
   (最初は private でも可)
2. GitHub の Settings → Branches で `main` への直接 push を禁止し、
   PR レビューを必須にする(branch protection)
3. Cloudflare ダッシュボード → Workers & Pages → Create → Pages →
   「Connect to Git」でこのリポジトリを接続する
   - Build command: なし(空欄)
   - Build output directory: `/`(リポジトリルート)
4. プロジェクトの Custom domains で `notes.maijun.net` を追加する
   (DNS が Cloudflare 管理なので CNAME は自動設定される)
5. スマホの Claude アプリ → Code タブからこのリポジトリを開き、
   「質問: ◯◯について教えて」と投げると記事 PR が作られる

## 運用フロー

```
スマホで質問 → Claude Code が記事生成 + PR 作成
→ PR の差分を目視レビュー → merge
→ Cloudflare Pages が自動デプロイ → notes.maijun.net で閲覧
```

main へ merge されるまで公開されません(プレビューは PR ごとの
Preview deployment URL で確認できます)。
