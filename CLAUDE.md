# 技術質問ノート 運用ルール

このリポジトリは、Claude への技術質問を 1 ページ 1 テーマの HTML 記事として蓄積する
「技術質問ノート」です。生成された記事は Cloudflare Pages 経由で
https://notes.maijun.net に公開されます。

## 記事生成のトリガー

- 「質問:」または「質問 」で始まる指示を受けたら、記事化スキル
  (.claude/skills/note-article/SKILL.md) に従って HTML 記事を生成する
- それ以外の指示(リファクタリング、CSS 修正など)は通常のタスクとして扱う

## 絶対に守るルール(セキュリティ・品質)

1. **秘匿情報の記載禁止**: AWS アカウント ID、OCI テナンシ OCID、API キー、
   社名・顧客名・受講者情報、社内 URL は絶対に記事へ書かない。
   例示が必要な場合は `123456789012` や `ocid1.tenancy.oc1..example` 等のダミー値を使う
2. **一次情報の参照必須**: 記事末尾の「参照」セクションに、根拠となる
   公式ドキュメント等の URL を必ず 1 件以上記載する。一次情報が確認できない内容は
   「未確認」と明記する
3. **main への直接 push 禁止**: 必ず `note/<slug>` ブランチを作成し、
   commit → push → Pull Request で提出する。merge は人間が行う
4. **管理対象ファイルの制限**: リポジトリに追加してよいのは
   HTML / CSS / SVG / 画像 / Markdown と、データファイル `notes.json` のみ。
   `notes.json` は記事メタデータの単一真実源(一覧/ナビの元データ)として追加・更新してよい。
   それ以外の JSON や YAML 等の設定ファイル、スクリプトの追加が必要な場合は、
   勝手に追加せず提案にとどめる。
   記事は静的 HTML のままで、ビルドは不要。検索索引のみ deploy 時に
   Pagefind を `npx` で呼んで生成する(node モジュールはコミットしない)。
   生成物 `/pagefind/` は `.gitignore` 済みでコミットしない

## サイト構成

```
index.html            # トップページ(新着5件 + カテゴリへの導線)
notes.json            # 記事メタデータの単一真実源(一覧/ナビの元データ)
aws.html              # AWS カテゴリの全記事一覧ページ
oci.html              # OCI カテゴリの全記事一覧ページ
misc.html             # その他カテゴリの全記事一覧ページ
search.html           # 全文検索ページ(Pagefind 既定 UI)
styles/site.css       # 共通スタイル(原則変更しない)
_template/article.html # 記事テンプレート(これを複製して書き始める)
aws/                  # AWS カテゴリの記事
oci/                  # OCI カテゴリの記事
misc/                 # その他カテゴリの記事
images/               # 記事用の画像・SVG
/pagefind/            # 検索索引(deploy 時に Pagefind が生成する成果物・コミットしない)
```

一覧・ナビゲーションは `notes.json` を読み込んで生成し、全文検索は Pagefind が
HTML 本文(`<main data-pagefind-body>`)を直接索引する。両者は役割が分かれており、
Pagefind は `notes.json` に依存しない。

Cloudflare Pages のビルド設定(検索索引の生成。ダッシュボード操作は人間が行う):
`Build command` を `npx -y pagefind --site . --glob "{aws,oci,misc}/**/*.html"`、
`Build output directory` は `/`(変更なし)。詳細は README.md を参照。

## 記事のルール

- ファイル名: 英小文字とハイフンの slug(例: `aws/kms-key-policy-basics.html`)
- カテゴリ: aws / oci / misc のいずれかのディレクトリに配置する。
  迷ったら misc に置く
- 文体: です・ます調。技術用語・サービス名は英語表記を維持する
- 構成: 冒頭に「結論」を置き、その後に詳細・手順・根拠を書く
- 図解: 理解を助ける場合のみ、インライン SVG で簡潔な図を入れる
  (外部画像生成サービスは使わない)
- コード・コマンドは必ず `<pre><code>` で囲む

## 記事生成後の必須作業

1. `notes.json` の配列に新記事のエントリを 1 件追記する
   (`index.html` の `<ul>` は編集しない。一覧/新着/カテゴリページは
   `notes.json` から自動生成される)
2. ブランチ `note/<slug>` に commit し、push して Pull Request を作成する
3. PR の説明には「質問の原文」「記事の要約(3 行以内)」「参照した一次情報」を書く
