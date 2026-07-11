# HD-MEA News

HD-MEA(High-Density Microelectrode Array)に関する最新論文・イベント・企業情報(MaxWell Biosystems / 3Brain)をまとめる静的サイト。

## 構成

- `index.html` / `css/style.css` / `js/main.js` — フロントエンド(ビルド不要の素のHTML/CSS/JS)
- `data/papers.json` — PubMedから自動取得した論文一覧
- `data/events.json` — 手動でキュレーションしたイベント情報
- `data/news.json` — 手動でキュレーションした企業情報
- `scripts/fetch-papers.mjs` — PubMed E-utilities APIから論文を取得し `data/papers.json` を更新するスクリプト
- `.github/workflows/update-papers.yml` — 毎日論文データを自動更新し、GitHub Pagesへデプロイするワークフロー

## ローカルでの確認

```bash
# 論文データを手動更新する場合
node scripts/fetch-papers.mjs

# ローカルサーバーで確認する場合(例: Python)
python -m http.server 8000
# → http://localhost:8000 を開く
```

## イベント・企業情報の更新

`data/events.json` と `data/news.json` は手動管理です。新しい情報を見つけたら直接編集してください。

## GitHub Pagesへの公開手順

1. このディレクトリをGitHubリポジトリにpushする
2. リポジトリの Settings → Pages → Source を「GitHub Actions」に設定する
3. `.github/workflows/update-papers.yml` が毎日 (JST 6:00) 自動実行され、論文データの更新とデプロイを行う
4. 手動で今すぐ実行したい場合は Actions タブから `Update HD-MEA papers` を Run workflow する
