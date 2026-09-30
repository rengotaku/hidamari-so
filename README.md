# ひだまり荘

ぼろアパート「ひだまり荘」の住人たちを見守る放置ゲーム。ブラウザだけで動き、セーブはブラウザ内（localStorage）に保存されます。

## 遊ぶ

https://hidamari-so.pages.dev

公開後に有効になります（Cloudflare Pages へ初回デプロイされるまでは開けません）。

## ホーム画面に追加する

PWA なので、ホーム画面から枠なしのアプリのように起動できます。一度開けば、オフラインでも起動します。

- iPhone（Safari）: 上記 URL を開く → 共有ボタン → 「ホーム画面に追加」
- Android（Chrome）: 上記 URL を開く → 右上のメニュー → 「ホーム画面に追加」（または「アプリをインストール」）

新しいバージョンを公開すると、次に起動したときに切り替わります。

## 開発

```bash
make install   # 依存のインストール
make run       # 開発サーバ（http://localhost:5173）
make ci        # lint + format-check + test + build
```

その他のターゲットは `make help`。service worker は本番ビルド（`make build` → `make preview`）でのみ登録されます。

## デプロイ

`main` へのマージで、CI（`.github/workflows/ci.yml`）が Cloudflare Pages（プロジェクト名 `hidamari-so`）へデプロイします。
GitHub リポジトリの Settings → Secrets and variables → Actions に、次の 2 つを登録してください。

| 名前 | 内容 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare Pages の編集権限を持つ API トークン |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare のアカウント ID |

どちらかが未登録の間、デプロイジョブは失敗にならず、警告を出してスキップします。
初回のみ、Pages プロジェクトを作成する必要があります（`make pages-login` → `make pages-create`）。
