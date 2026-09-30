---
last_verified: 2026-10-01
---

# ARCHITECTURE

ひだまり荘は、築 47 年の木造アパートの住人たちを眺める放置ゲームです。ブラウザだけで動き、セーブはブラウザ内（localStorage）に置きます。サーバ側の処理はありません。ビルドは Vite、公開は Cloudflare Pages、PWA として入れられます。

プレイヤーが選ぶのは、築 50 年の記念日に来る買収提案（売る / 断る）だけです。ほかの画面操作は、時間の速さの切り替えと、住人・部屋・日誌を見るための操作に限ります。

## 構成

コードは `src/` 以下で、層ごとに役割が分かれています。依存の向きは `ui` → `render` / `save` → `sim` / `content` で、`sim` は画面にも保存にも依存しません（`src/sim/purity.test.ts` が、sim のソースに React・DOM・`Math.random`・`Date.now` などが入っていないことを検査します）。

**表1: 層と役割**

| 層 | ディレクトリ | 役割 | 主なファイル |
|---|---|---|---|
| 状態と規則 | `src/sim/` | ゲームの状態 `GameState` と、それを進める規則。純粋な TypeScript で、乱数は引数で受け取る | `types.ts`（状態の型）、`init.ts`（新規ゲーム）、`step.ts`（時間を進める入口）、`world.ts`（1 刻みの更新）、`behavior.ts`（住人の行動）、`storylets.ts`（出来事の抽選・効果・日誌の組み立て）、`landlord.ts` / `decor.ts`（退去・片付け・入居・模様替え）、`buyout.ts`（築 50 年の買収提案）、`town.ts`（町並みの変化）、`clock.ts`（時計） |
| 出来事のデータ | `content/` と `src/content/` | 住人の種類・癖・装飾・出来事・町並みの変化は `content/` の JSON。`src/content/` が zod で検証して `Content` にする | `src/content/schema.ts`（スキーマ）、`src/content/index.ts`（読み込みと検証）、`src/content/decor25.ts`（装飾の箱と全体図の矩形） |
| 保存 | `src/save/` | localStorage への読み書き、古い保存の補完、留守中の進行 | `schema.ts`（保存の検証）、`storage.ts`（保存・読み込み・`catchUp`）、`migrate.ts`（版の移行と `fillHouse`）、`away.ts`（タブが隠れていた時間の計測） |
| 描画 | `src/render/` | `GameState` を読んで Canvas に描く | `view.ts`（`drawStage`: 全体図・ズーム・フェード・大写しの切り替え）、`scene.ts`（全体図）、`closeup.ts`（2.5D の大写し）、`decor.ts`（全体図の装飾）、`person.ts`、`room.ts`、`season.ts`、`town.ts`、`night.ts`、`collector.ts`、`hit.ts`（押した場所の判定） |
| 画面 | `src/ui/` | React の 1 画面と、ゲームループ | `GameScreen.tsx`（画面の組み立て）、`engine.ts`（`GameEngine`: 状態・乱数・速さを持つ入れ物）、`useGameLoop.ts`（フレームごとの進行・描画・保存）、`zoom.ts`（大写しの状態遷移）、`Stage.tsx`、`Journal.tsx`、`Profile.tsx`、`BuyoutDialog.tsx`、`SpeedControl.tsx` |
| PWA | `src/pwa/`、`vite.config.ts` | manifest と service worker の登録。新しい版は、読み込み途中で混ざらないよう待機させ、タブが非表示から表示に戻った瞬間に `SKIP_WAITING` で有効にして 1 回だけ再読み込みする（画面に UI は出さない。保存から続きが始まる） | `manifest.ts`、`register.ts` |

`src/components/ui/` は、雛形から引き継いだ共通の UI 部品です。`src/` 以下のほかのファイルからは参照されていません（削除してよいかどうかは未確認です）。

## データフロー

### 起動から保存まで

1. `src/main.tsx` が `App` を描き、`GameScreen` が `GameEngine.open` で保存を開く。
2. `loadOrNew`（`src/save/storage.ts`）が localStorage の保存を読む。`migrateSave` で古い版を最新まで移し、`fillHouse` で後から足した項目を補い、`saveEnvelope`（zod）で検証する。保存が無い・壊れている・未来の版のときは、シードから `newGame` で新しいゲームを始める。売って結末を迎えた保存も、開き直すと新しいゲームになる。
3. 保存があれば、`savedAt` から現在までの実時間を留守時間として `catchUp` で進める（quiet で吹き出しを出さない）。
4. `useGameLoop` が `requestAnimationFrame` ごとに `engine.tick` を呼び、Canvas を描き、0.3 秒ごとに画面の文字を更新し、5 秒ごとに保存する。タブが隠れた時点で保存し、戻ったら隠れていた時間ぶんを `engine.resume` で進める。速さボタンを押したときと、買収の返事を選んだときも、その場で保存する。返事待ちの間は `GameScreen` が `header` と `main` を `inert` にし、ダイアログ（`BuyoutDialog`）が本体へフォーカスを受け取って、閉じたあと表示前の要素へ戻す。

### 時間の進み方

実時間 1 秒がゲーム内 2 分です（`MIN_PER_SEC`）。

1. `useGameLoop` がフレームの経過秒（上限 0.25 秒）に `MIN_PER_SEC` を掛けた分を `engine.tick` に渡す。
2. `GameEngine.tick` が、渡された分に速さ（0 / 1 / 4 / 15）を掛け、持ち越しを足し、1 回あたり 240 分までを `step` に渡す。超えた分は次の `tick` に持ち越す（持ち越しは 1440 分まで）。
3. `step`（`src/sim/step.ts`）が状態を複製し、2 分以下の刻みに区切って `update`（`src/sim/world.ts`）を繰り返す。買収提案が立った刻みで打ち切る。
4. `update` が時刻を進め、1 時間ごと・1 日ごとの処理（天気、町並み、家賃、抽選）、住人の行動、装飾の模様替え、大家の動きを進める。
5. `GameEngine` が、返ってきた新しい状態で自分の `state` を差し替える。

### 出来事と日誌

`content/storylets/*.json` の出来事は、`storylets.ts` が条件（時間帯・天気・季節・登場人物の条件）に合うものから抽選します。起きた出来事は「どの出来事が、誰に、いつ、どの言い回しで」という構造のまま `GameState.log` に入ります。本文は `Journal` が表示のたびに `content` から組み立てます。

### 描画

`drawStage`（`src/render/view.ts`）が、1 フレームを次のどれかで描きます。

- 全体図: `drawScene`（建物の断面、空、町並み、季節、住人、大家、夜の場面）
- ズーム: 下絵に描いた全体図を、押した部屋へ切り出して拡大する
- フェード: 大写しの上に、寄った絵を薄めながら重ねる
- 大写し: `drawCloseup`（2.5D。装飾は `content/decor.json` の箱から立てる）

大写しの状態遷移（全体図 → ズーム中 → 大写し → 戻り中 → 全体図）は `src/ui/zoom.ts` にあります。ゲーム内の時間とは関係なく、大写し中も時間は止まりません。

### 保存の中身

localStorage の 1 つのキー（`hidamari-so-save`）に、`schemaVersion`・`savedAt`（保存時刻）・`rngState`（乱数の内部状態）・`speed`・`state` を JSON で入れます。`schemaVersion` は現在 2 です。

## どこを触れば何が変わるか

**表2: 変えたいことと触る場所**

| 変えたいこと | 触る場所 |
|---|---|
| 出来事（日常・ハプニング・恋・人生の筋）を足す・直す | `content/storylets/*.json`。書き方は `content/README.md` |
| 住人の種類（職業・シフト・装飾のセット）を足す | `content/archetypes.json`（癖は `content/traits.json`） |
| 部屋の装飾の部品を足す | `content/decor.json`（2.5D の箱で定義する。全体図の平面は導かれる） |
| 町並みの変化（空き地 → マンションなど）を足す | `content/town.json`。新しい見た目の種類が要るときだけ `src/render/town.ts` |
| 出来事データの書式・検証ルールを変える | `src/content/schema.ts` |
| 出来事の抽選・効果の適用・日誌の組み立て | `src/sim/storylets.ts` |
| 住人の行動（食事・睡眠・外出・勤務） | `src/sim/behavior.ts`、`src/sim/data.ts` |
| 家賃の日、1 時間ごと・1 日ごとの処理 | `src/sim/world.ts` |
| 時間の刻み、1 回の進行の上限 | 刻みは `src/sim/step.ts`、`tick` の上限と持ち越しは `src/ui/engine.ts` |
| 速さの種類（停止 / 1 / 4 / 15） | `src/save/schema.ts` の `SPEEDS`、ボタンは `src/ui/SpeedControl.tsx` |
| 留守中の進行の上限 | `src/save/storage.ts` の `MAX_CATCHUP_MINUTES` |
| 築年数の進み方、買収提案の年齢 | `src/sim/clock.ts`（`YEAR_DAYS`）、`src/sim/buyout.ts`（`ANNIVERSARY_AGE`） |
| 退去後の片付け・入居・模様替え | `src/sim/landlord.ts`、`src/sim/decor.ts` |
| 保存の項目を足す | `src/save/schema.ts`（欠けた保存の既定値または `fillHouse` も）。判断は ADR 0002 |
| 保存の版を上げる | `src/save/migrate.ts` の `MIGRATIONS` に移行関数を 1 件足し、`SCHEMA_VERSION` を上げる |
| 積雪・雪かき（積雪は実際に雪が降った日数 `GameState.snowDays` で決まり、雪かき役は家にいる人のうち id が最小の人。雪かき中はその人を部屋に描かない） | `src/sim/world.ts`（`onDay`）、`src/render/season.ts`（`snowCover` / `pickShoveler`）、`src/render/room.ts`（`roomOccupants`） |
| 全体図の絵（建物・空・季節） | `src/render/scene.ts`、`src/render/season.ts`、`src/render/sky.ts` |
| 全体図の装飾の置き場所（区画） | `src/render/decor.ts` |
| 大写しの絵 | `src/render/closeup.ts` |
| 大写しの遷移の長さ | `src/ui/zoom.ts`（`ZOOM_IN_MS`、`FADE_MS`） |
| 画面のレイアウト（ヘッダ・側面） | `src/ui/GameScreen.tsx`、`src/ui/game.css` |
| 買収提案のダイアログと結末の画面 | `src/ui/BuyoutDialog.tsx`、`src/ui/buyout.css` |
| PWA の名前・アイコン | `src/pwa/manifest.ts` |
| PWA の更新の挙動（待機させる設定 / 表示に戻ったときの入れ替え） | `vite.config.ts`（`skipWaiting` / `clientsClaim`）、`src/pwa/register.ts` |
| 公開（Cloudflare Pages）の設定 | `.github/workflows/ci.yml`、`wrangler.toml`、`public/_headers` |

## 経緯（why）は docs/adr/ を見る

設計判断の経緯・捨てた案・壊すと危ない前提は [docs/adr/README.md](adr/README.md)（索引）から辿る。
本ファイルには経緯を書かない（現在形とログを混ぜると両方陳腐化するため）。
