---
adr: 0007
title: PWA の新しい版は、古い画面がすべて閉じた次回の起動で有効にする（pwa, service worker, update）
status: accepted
superseded_by: null
date: 2026-10-01
issues: [1, 6, 21]
tags: [pwa, service-worker, update, cloudflare-pages]
description: service worker の skipWaiting と clientsClaim を無効にし、新しい版は古い画面が全部閉じた次の起動から使う。読み込み途中で版が混ざらない代わりに、開きっぱなしの画面には新しい版が届かない
---

# ADR 0007: PWA の新しい版は、古い画面がすべて閉じた次回の起動で有効にする

## 背景

ひだまり荘は Cloudflare Pages で公開し、PWA としてホーム画面に入れられる（親 #1 Decision Log #3、sub-issue #6）。#6 の「やってはいけないこと」は、service worker が古い版を掴み続けて更新が届かない作りにすることだった。一方、読み込みの途中で版が混ざる（古い画面が新しい版の資産を取りに行く）のも避けたい。

## 決定

- `vite.config.ts` で `skipWaiting: false`、`clientsClaim: false` にする。新しい service worker は待機状態になり、開いている画面がすべて閉じた後の次の起動で有効になる。
- `registerType` は `autoUpdate`、`injectRegister` は `false`。登録は `src/pwa/register.ts` が自分で行う（本番ビルドのときだけ。開発中と非対応ブラウザでは何もしない）。更新の通知 UI は置かない。
- `cleanupOutdatedCaches` を有効にして、古い版のキャッシュを掃除する。
- 日本語のドットフォントは Google Fonts から取得している。CSS は `StaleWhileRevalidate`、フォント本体は `CacheFirst` でキャッシュし、2 回目以降はオフラインでも表示できるようにする。

## 捨てた案

- **`skipWaiting` と `clientsClaim` を有効にして、すぐ切り替える**: 開いている画面の版が途中で変わり、古い画面が新しい版の資産と混ざるおそれがある。
- **更新を知らせる画面を出し、押したら再読み込みする**: 利用者に気づいてもらえるが、画面に操作を足すことになる（ADR 0006）。#21 に案として起票した（open）。

## 変えてよい前提 / 壊すと危ない前提

- **変えてよい**: 更新の届け方。#21 の案（待機中の版があるときに知らせ、押したら再読み込みする。`registerType: "prompt"` に寄せる）に変えるなら、この ADR を置き換える新しい ADR を足し、この ADR に `superseded_by` を付ける。
- **壊すと危ない**:
  - **既知の限界: 開きっぱなしの画面には新しい版が届かない。** 放置ゲームは画面を開いたままにする人が多いので、公開しても更新が何日も届かない。実例として、#3〜#5 をマージして公開した直後、開きっぱなしのブラウザで公開サイトを見ると、速さのボタンが無い古い版のままだった。service worker を消して開き直すと新しい版が出た（#21 に記録）。
  - `skipWaiting` だけを有効にしない。`clientsClaim` と合わせて、開いている画面の版が途中で切り替わる。
  - 新しい版は古い版の保存を読めること（ADR 0002）。版が変わっても遊んでいた町を失わないための前提。
  - Cloudflare Pages の公開は `main` のマージで走る（`.github/workflows/ci.yml`、`wrangler.toml`）。`public/_headers` は `/sw.js` と `/manifest.webmanifest` を `no-cache` にして、ブラウザが古い service worker を固定しないようにしている。これを外すと更新の検知が遅れる。
