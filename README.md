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

記事本体は **ビルド不要の静的 HTML** です。OGP 画像だけ Cloudflare Pages Functions で
動的生成しますが、`functions/og.js` は事前バンドル済みのため **Cloudflare 側のビルド設定は不要**
(ビルドコマンドは空欄のまま)です。詳細は [docs/ogp-image.md](docs/ogp-image.md) を参照。

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
