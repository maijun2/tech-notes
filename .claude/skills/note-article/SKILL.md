---
name: note-article
description: ユーザーが「質問:」で始まる技術質問をしたとき、調査して 1 ページ 1 テーマの HTML 記事を生成し、index.html へのリンク追記・ブランチ作成・commit・PR 作成までを行うスキル。技術質問ノート(notes.maijun.net)専用。
---

# 技術質問ノート 記事化スキル

「質問:」で始まる指示を受けたら、以下の手順で記事を作成する。

## 手順

### 1. 調査

- まず質問内容を Web 検索等で調査し、**公式ドキュメントを中心とした一次情報**を確認する
- 一次情報で確認できた事実と、確認できなかった推測を区別してメモする

### 2. 記事ファイルの作成

- `_template/article.html` を複製して書き始める(構造・class 名を変えない)
  - テンプレートの `<main data-pagefind-body>` はそのまま使う。これにより
    複製した記事は全文検索(Pagefind)の索引対象になる。Skill 側で索引用の
    追加作業は不要
  - 記事末尾の戻り導線(`.back-link`)は、配置したカテゴリに合わせて
    `../aws.html` / `../oci.html` / `../misc.html` とラベルを選ぶ
    (もう一方の「トップへ」= `../index.html` はそのまま)
- カテゴリを判定し、`aws/` `oci/` `misc/` のいずれかに配置する
- ファイル名は内容を表す英小文字ハイフン区切りの slug にする
- 記事の構成:
  1. `h1`: 質問を一言で表すタイトル
  2. `.meta`: 作成日(YYYY-MM-DD)とカテゴリ
  3. `.lead`: 結論(2〜4 文)。読者がここだけ読めば答えが分かる状態にする
  4. `h2` 以降: 詳細・根拠・手順・比較など。冗長にせず、必要な分だけ書く
  5. 図解が理解を助ける場合のみ、インライン SVG を 1〜2 点入れる
  6. `section.refs`: 参照した一次情報の URL リスト(必須・1 件以上)
- コード・コマンドは `<pre><code>` で囲む
- CLAUDE.md の「絶対に守るルール」(秘匿情報禁止など)を遵守する
- **テンプレートの TODO は必ず実データで置換・削除する**:
  `_template/article.html` には `<!-- TODO: ... -->` コメントとプレースホルダ
  (`記事タイトル` / `slug` / `misc/slug` / `2026-01-01` / `TODO: 結論を 1 文で要約` /
  `TODO: 参照した公式ドキュメントの URL` など)が多数含まれる。これらは
  **すべて記事の実データで置換または削除してから出力すること**。
  TODO コメントやプレースホルダを 1 つでも残したまま出力してはならない
  (og:url / og:image の `title=` / canonical / 日付 / カテゴリ class /
  戻り導線リンクを含む)。commit 前に文字列 `TODO` がファイルに残っていないことを確認する

### 2.5 OGP メタタグの設定(SNS カード用)

テンプレートの `<head>` にある OGP ブロックの TODO を、記事の内容に合わせて埋める。

- `og:title` … H1(記事タイトル)と**同じ文字列**にする
- `og:description` … `<meta name="description">` と同じ結論 1 文にする
- `og:url` と `<link rel="canonical">` … **拡張子なしの正規 URL**
  `https://notes.maijun.net/<category>/<slug>`(`.html` を付けない)
  - Cloudflare Pages は `.html` 付き URL を 308 で拡張子なしへリダイレクトする。
    `og:url` に `.html` を書くと SNS クローラ(特に X)がカードを生成できないため、
    必ず拡張子なしにする
- `og:image` … `https://notes.maijun.net/og?title=<H1 を encodeURIComponent した値>`
  - 動的 OGP 画像生成エンドポイント(`functions/og.js`)がタイトル入り画像を返す
  - エンコード例: `KMS キーポリシー` → `KMS%20%E3%82%AD%E3%83%BC%E3%83%9D%E3%83%AA%E3%82%B7%E3%83%BC`
  - 半角スペースは `%20`、「 は `%E3%80%8C` など。手で書かず必ず encodeURIComponent 相当で生成する

> 仕組みの詳細は `docs/ogp-image.md` を参照。

### 3. メタデータの登録(notes.json)

- `index.html` は編集しない。一覧・新着・カテゴリページ(`aws.html` /
  `oci.html` / `misc.html`)は `notes.json` から自動生成される。
- `notes.json` の配列に、作成した記事のオブジェクトを 1 件追記する
  (JSON として valid なまま。`category` は `aws` / `oci` / `misc` のいずれか、
  `summary` は `.lead` 冒頭の結論 1 文、`date` は記事の `<time>` と一致させる):

```json
{ "title": "記事タイトル", "category": "aws", "path": "aws/your-slug.html", "date": "2026-06-13", "summary": "結論1文", "tags": ["..."] }
```

### 4. commit と Pull Request

```bash
git checkout -b note/<slug>
git add <記事ファイル> notes.json
git commit -m "note: <記事タイトル>"
git push -u origin note/<slug>
```

- PR を作成し、説明に「質問の原文」「記事の要約(3 行以内)」「参照 URL」を記載する
- main への直接 push は禁止。merge は人間が行う

## 品質チェックリスト(commit 前に確認)

- [ ] テンプレート由来の TODO コメント・プレースホルダがすべて実データに置換・削除されているか(`TODO` 文字列が残っていないか)
- [ ] 結論が冒頭にあるか
- [ ] 参照 URL(一次情報)が末尾にあるか
- [ ] 秘匿情報(アカウント ID、OCID、API キー、社名等)が含まれていないか
- [ ] コードブロックが `<pre><code>` で囲まれているか
- [ ] OGP メタタグ(og:title / og:description / og:url / og:image)を記事内容に合わせたか
- [ ] og:image の title= が encodeURIComponent された H1 になっているか
- [ ] notes.json にエントリを追記したか(JSON として valid か)
- [ ] ブランチ名が note/<slug> になっているか
