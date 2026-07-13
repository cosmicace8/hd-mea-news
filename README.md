# HD-MEA News

HD-MEA(High-Density Microelectrode Array)に関する最新論文・イベント・企業情報(MaxWell Biosystems / 3Brain)をまとめる静的サイト。

## 構成

- `index.html` / `css/style.css` / `js/main.js` — フロントエンド(ビルド不要の素のHTML/CSS/JS)
- `data/papers.json` — PubMedから自動取得した論文一覧
- `data/events.json` — 手動でキュレーションしたイベント情報
- `data/news.json` — 手動でキュレーションした企業情報
- `data/new-content-alerts.json` — 3Brain/MaxWell Biosystemsのsitemap.xmlを巡回して見つけた「未確認の新規ページ候補」(自動生成、内容の要約は含まない)
- `scripts/fetch-papers.mjs` — PubMed E-utilities APIから論文を取得し `data/papers.json` を更新するスクリプト
- `scripts/check-new-content.mjs` — 3Brain/MaxWell Biosystemsの新規イベント・ニュースページのURLを検知するスクリプト
- `.github/workflows/update-papers.yml` — 毎日データを自動更新し、GitHub Pagesへデプロイするワークフロー

## ローカルでの確認

```bash
# 論文データを手動更新する場合
node scripts/fetch-papers.mjs

# 新規イベント・ニュースページを検知する場合
node scripts/check-new-content.mjs

# ローカルサーバーで確認する場合(例: Python)
python -m http.server 8000
# → http://localhost:8000 を開く
```

## イベント・企業情報の更新

`data/events.json` と `data/news.json` は手動管理です。

`scripts/check-new-content.mjs` が3Brain/MaxWell Biosystemsの公式サイトのsitemap.xmlを巡回し、`data/events.json`/`data/news.json`にまだ載っていないイベント・ニュースページのURLを`data/new-content-alerts.json`に書き出します(サイト上では各タブの「未確認の候補」から確認できます)。ただしタイトル・日付・要約は自動生成されないため、リンク先を確認したうえで`data/events.json`または`data/news.json`に手動で追記してください。追記時にそのページのURLを`url`フィールドに含めれば、次回実行時にそのアラートは自然に消えます。

## GitHub Pagesへの公開手順

1. このディレクトリをGitHubリポジトリにpushする
2. リポジトリの Settings → Pages → Source を「GitHub Actions」に設定する
3. `.github/workflows/update-papers.yml` が毎日 (JST 6:00) 自動実行され、論文データの更新とデプロイを行う
4. 手動で今すぐ実行したい場合は Actions タブから `Update HD-MEA papers` を Run workflow する
