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

### 3. 目次の更新

- `index.html` の該当カテゴリの `<ul class="entries">` の**先頭**に
  以下の形式で 1 行追加する:

```html
<li><a class="entry" href="aws/your-slug.html"><span class="entry-title">記事タイトル</span><span class="leader"></span><time datetime="2026-06-13">2026-06-13</time></a></li>
```

### 4. commit と Pull Request

```bash
git checkout -b note/<slug>
git add <記事ファイル> index.html
git commit -m "note: <記事タイトル>"
git push -u origin note/<slug>
```

- PR を作成し、説明に「質問の原文」「記事の要約(3 行以内)」「参照 URL」を記載する
- main への直接 push は禁止。merge は人間が行う

## 品質チェックリスト(commit 前に確認)

- [ ] 結論が冒頭にあるか
- [ ] 参照 URL(一次情報)が末尾にあるか
- [ ] 秘匿情報(アカウント ID、OCID、API キー、社名等)が含まれていないか
- [ ] コードブロックが `<pre><code>` で囲まれているか
- [ ] index.html にリンクを追記したか
- [ ] ブランチ名が note/<slug> になっているか
