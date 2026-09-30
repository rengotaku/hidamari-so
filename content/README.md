# content/ — 住人と出来事のデータ

ゲームの物語は、コードではなくここの JSON で持つ。出来事を足すのにコードの変更は要らない。
読み込み時に `src/content/schema.ts` の zod スキーマで検証し、書き間違い（未知のフィールド・存在しない id・宣言していない差し込み・本文の数字など）は `make test` / `make ci` で落ちる。

| ファイル | 中身 |
|---|---|
| `archetypes.json` | キャラの種類（職業・年齢幅・睡眠時間帯・勤務シフト・趣味の重み・癖の候補・仕送り・初期所持金・人生の筋の入口） |
| `traits.json` | だめな癖（表示名と説明） |
| `decor.json` | 部屋の装飾の部品（ドット絵を色つきの矩形の並びで持つ。置き場所つき） |
| `storylets/*.json` | 出来事。1 ファイルに配列で複数件を書いても、オブジェクト 1 件だけを書いてもよい |
| `town.json` | 町並みの変化（空き地 → 囲い → マンションなど）。下の「町並みの変化を足す」 |

## 出来事を 1 件足す手順

1. `content/storylets/` の好きなファイル（新しいファイルでもよい）に、下の形で 1 件足す。
2. `make test` を実行する。スキーマ違反は理由つきで失敗する。
3. 終わり。コードは触らない。

```json
{
  "id": "parcel-notice",
  "kind": "daily",
  "trigger": "hour",
  "cooldownDays": 2,
  "when": { "hours": [6, 10], "weather": ["rain"] },
  "roles": { "a": { "out": true }, "b": { "inRoom": true, "awake": true } },
  "numbers": { "n": [3, 9] },
  "choices": { "gift": ["みかん", "じゃがいも"] },
  "texts": [
    "{a}さん宛の不在票が、また増えた",
    "{b}さんが{a}さんの荷物を{n}日預かっている。{gift}が入っているらしい"
  ],
  "effects": [{ "type": "adjust", "role": "b", "stat": "mood", "delta": -3 }]
}
```

## storylet のフィールド

| フィールド | 意味 |
|---|---|
| `id` | 小文字・数字・ハイフン。全 storylet で一意 |
| `kind` | `daily`（日常）/ `happening`（ハプニング）/ `relation`（人間関係）/ `romance`（恋）/ `arc`（人生の筋） |
| `trigger` | いつ抽選されるか（下の表） |
| `act` | `trigger` が `act-end` のときだけ。どの行動が終わったときか |
| `chance` | 選ばれたあと実際に起きる確率（0〜1、既定 1） |
| `weight` | 候補が複数あるときの重み（既定 1） |
| `when` | `hours`: `[開始時, 終了時)`（`[23, 4]` のように日をまたげる）、`weather`: `sunny` / `cloudy` / `rain` / `snow`、`season`: `spring` / `tsuyu` / `summer` / `autumn` / `winter`、`days`: ゲーム開始からの日数の範囲 `{min, max}`（設備が年月とともに増える出来事に使う。例 `"when": { "days": { "min": 18 } }`） |
| `roles` | 登場人物の条件。`a`・`b` のうち宣言した役割だけが登場する（下の表） |
| `cooldownDays` | 同じ出来事が再び起きるまでの最短日数 |
| `once` | `true` なら 1 ゲームで 1 回だけ |
| `texts` | 本文の言い回し（1 つ以上。起きるたびに 1 つ選ぶ） |
| `numbers` | `{n}` に入る漢数字を `[最小, 最大]` で抽選する。値は 0〜99 に限る（漢数字で表示できる範囲。例 `"n": [3, 9]` は可、`[100, 300]` と `[-1, 5]` は検証で落ちる） |
| `choices` | `{名前}` に入る言い回しの候補 |
| `logKind` | 日誌の見た目。`move` / `noise` |
| `effects` | 起きた結果（下の表） |

本文に書ける差し込み: `{a}` `{b}`（名字。`roles` に宣言した役割だけ）、`{room}`（a の部屋番号。a が要る）、`{act}`（`noise` のとき、音の主の行動名）、`{shift}`（`late` のとき、寝坊した勤務名）、`numbers` と `choices` で宣言した名前。
**本文に算用数字を書かない**（数は漢数字か `numbers` で）。数値の増減も本文に書かない。

### trigger

| 値 | いつ | 必要な役割 |
|---|---|---|
| `hour` | 1 時間ごとの抽選（日常の出来事の主な入口） | 任意 |
| `day-start` | 日付が変わった直後 | 任意 |
| `visit` | 住人が隣の部屋を訪ねたとき | `a`=訪問者, `b`=訪問先 |
| `noise` | 物音で隣が壁を叩いたとき | `a`=音の主, `b`=隣 |
| `act-end` | 行動 `act` が終わったとき | `a` |
| `quit-gym` / `late` / `gamble-win` / `gamble-loss` | 筋トレを諦めた / 寝坊した / パチンコで大勝ち・大負けした | `a` |
| `season-start` | 季節の最初の日（日付が変わった直後。春 1〜4 日目、梅雨 5〜7、夏 8〜11、秋 12〜15、冬 16〜18、19 日目で春に戻る） | 任意 |
| `rent-late` | 家賃の集金日に払いきれなかった | `a`=払えなかった住人 |
| `opening` | 新規ゲームの最初の 1 件 | なし |
| `book` | 他の出来事の `book` や人生の筋から予約されたときだけ | 任意 |

### roles の条件（すべて省略可。書いたものは全部満たす）

`archetype` / `notArchetype`（種類の id）、`tag` / `notTag`（種類のタグ。例 `old`）、`trait` / `notTrait`（癖の id）、`floor`（1 か 2）、`inRoom`（自室にいるか）、`awake`（起きているか）、`out`（外出中か）、`noisy`（この 1 日以内に騒いだか）、`stayDays`・`money`・`age`（年齢）・`mood`（気分。内部値 0〜100）（いずれも `{min, max}`）、`single`（恋の相手が他にいないか。関係が `none` 以外の相手がいなければ真。例 `"single": true`）。
`b` にだけ、`a` との関係として `affinity`（仲の良さ 0〜100、初期値 30。`{min, max}`）と `romance`（恋の段階の配列。`none`（なし）/ `crush`（片想い）/ `dating`（付き合っている）/ `cohabiting`（同棲）/ `married`（結婚）のどれか。例 `["dating", "cohabiting"]`）を書ける。

### effects

| type | 内容 |
|---|---|
| `adjust` | `role` の `stat`（`mood` `money` `hunger` `sleepy` `comfort` `clutter`）を `delta` だけ増減（内部値。画面には出ない） |
| `bond` | a と b の仲の良さを `delta` だけ増減 |
| `romance` | a と b の恋の段階を `stage` にする |
| `say` | `role` が吹き出しで `text` を言う。`afterMinutes` で遅らせられる |
| `book` | `next`（`{id, weight}` の配列）から 1 つ選び、`afterMinutes: [最小, 最大]` 後に予約する。宴会・送別会・人生の筋の続きはこれで書く |
| `moveOut` | `role` の住人が出ていく |
| `changeJob` | `role` の住人の種類を `archetype` に変える（その種類の人生の筋が予約される） |
| `purse` | 大家の所持金を `delta` だけ増減（内部値。マイナスになってもゲームは終わらない）。例 `{ "type": "purse", "delta": -6000 }` |
| `away` | `role` の住人が部屋を空けて入院する。`minutes: [最小, 最大]` 分のあと帰ってくる（自室にいるときだけ）。例 `{ "type": "away", "role": "a", "minutes": [7200, 9000] }` |
| `cohabit` | `role` の住人が、もう一方の部屋へ移って一緒に住む。元の部屋は空室になり、大家が片付けて次の入居者を迎える。`roles.a` と `roles.b` が要る。恋の段階は別に `romance` で `cohabiting` にする |
| `party` | a の部屋に、起きて自室にいる住人が集まって宴会になる。全員の仲の良さを `bond`、気分を `mood` だけ増減する。財布は動かない。例 `{ "type": "party", "bond": 8, "mood": 8 }` |
| `decorAdd` / `decorRemove` | `role` の部屋に装飾（`decor.json` の id）を足す / 外す。外すと、これから置く予定だった分も取り消す |

## 種類（archetype）を足す

`archetypes.json` に 1 件足す。`traits` は `traits.json` に存在する id、`arc` は人生の筋の入口にする storylet の id（`trigger: "book"`）。`tags` に `arc-only` を付けた種類は、人生の筋の途中（`changeJob`）でだけなる種類で、新しい入居者としては抽選されない（例: 浪人生が専門学校に進んだときの専門学校生）。
人生の筋の「入口」は、種類の `arc` が指す出来事から、最初の分岐（`book` の `next`）で予約される別々の出来事（入口自身への戻りは除く）。抽選される種類には 2 本以上（うまくいく筋とうまくいかない筋）を持たせ、筋は入口から 3 段以上続ける。
勤務シフトの `days` は「日付 % every が on のどれかに一致する日」（毎日なら `{"every": 1, "on": [0]}`）。`on` の各値は `every` 未満にする（例 `{"every": 3, "on": [0, 2]}` は可、`{"every": 3, "on": [3]}` は一度も勤務日にならないので検証で落ちる）。`start` が `end` より大きいシフトは日をまたぐ夜勤。

## 町並みの変化を足す

`town.json` に 1 件足す。コードは触らない（新しい見た目の種類が要るときだけ `src/render/town.ts` に描画を足す）。

```json
{
  "id": "east-lot",
  "slot": "east",
  "startYear": 1,
  "chance": 0.25,
  "stages": [
    { "look": "lot" },
    { "look": "fence", "afterDays": 0, "log": "隣の空き地に白い囲いが立った。工事の看板が出ている" },
    { "look": "mansion", "afterDays": 6, "log": "隣の空き地にマンションが建った。夜になると窓があかるい" }
  ]
}
```

| フィールド | 意味 |
|---|---|
| `slot` | 変化が起きる場所。`east`（右隣の土地）/ `pole`（電柱） |
| `startYear` | ゲーム開始から何年たったら始まりうるか（ゲーム内 18 日で 1 年） |
| `chance` | 始まりうる日ごとの、実際に始まる確率（0〜1） |
| `stages` | 最初の姿から順に。最初の段階は `look` だけ。2 つ目以降は、変化が始まってから `afterDays` 日目にその段階へ進む。`afterDays` は段階ごとに必ず増える（逆戻り・同日 2 段階は検証で落ちる）。`log` は段階に入った日の日誌 1 行（数字を書かない） |
| `look` | 見た目。`lot` / `fence` / `mansion` / `pole` / `underground`。`slot` ごとに置ける look が決まっていて、`east` は `lot` / `fence` / `mansion`、`pole` は `pole` / `underground`（例: `pole` の段階に `mansion` を書くと検証で落ちる） |

一度進んだ段階には戻らない。日誌には段階ごとに 1 行だけ出る。

## 装飾（decor）を足す

部屋の見た目は `decor.json` の部品で決まる。コードに職業ごとの描き分けは無い。

```json
{
  "id": "poster-band", "name": "バンドのポスター", "slot": "wall", "w": 6, "h": 9,
  "rects": [[0, 0, 6, 9, "#2a2a36"], [1, 1, 4, 5, "#c44a3a"]]
}
```

- `slot`: `wall`（奥の壁）/ `window`（窓辺）/ `floor`（床）/ `ceiling`（天井）。置き場所ごとに描ける数が決まっていて（壁 5・窓辺 3・床 6・天井 2）、超えた部品は描かれない
- `rects`: `[x, y, w, h, 色]` の並び。部品の左上が原点で、`w` × `h` の枠からはみ出さない。置き場所の区画に左下を合わせて描く
- `hideDuringAct`（省略可）: その行動をしている間は描かない（弾いているギターなど）
- `moving-box`（入居直後の段ボール）は必須。`step` で 1 箱ごとのずれを決める
- archetype の `decor` に `required`（必ず置く）・`pool`（候補）・`pick`（候補から何点抽選するか `[最小, 最大]`）を書く。住人ごとに抽選するので、同じ種類でも違う部屋になる。最悪の抽選でも置き場所の数に収まることを `make test` が確かめる

### 退去・大家・模様替え（コードの担当）

- 住人が `moveOut` で出ていくと、荷物を残した部屋が「片付け待ち」になり、2〜4 日後の入居が決まる
- 大家（画面の登場人物）が日中（8〜19 時）に部屋へ行って片付ける。装飾が空になり、窓に募集の貼り紙が出る。片付けが終わっていない部屋には入居させない
- 入居の日、大家が新しい住人を連れて階段を上がる。部屋には段ボールだけで、約 1 日かけて装飾が 1 つずつ増え、段ボールが減る
- 日誌に残る出来事は `storylets/house.json` の `room-cleared` / `room-move-in` / `room-settled`（`trigger: "book"`。エンジンが起こす。`{a}` は前の住人または新しい住人）

## 日誌との関係

日誌は組み立て済みの文章ではなく `{t, storyletId, roles, variant}` を保存し、表示のたびにここの `texts` から本文を組み立てる。
保存後に `texts` を直せば、過去の日誌の表示も変わる（保存されているのは何番目の言い回しかだけ）。
- `texts` の順番を入れ替える・削る: 保存済みの番号が別の言い回しを指す。番号が範囲外なら先頭の言い回しになる
- `numbers` / `choices` を足す・名前を変える: 過去の行にはその値が保存されていないので、`numbers` は下限、`choices` は先頭の候補で補う（`undefined` や `NaN` は出ない）
- `{act}` `{shift}` の値が保存されていない過去の行は、その差し込みが空になる
- `id` を消す・変えると、その出来事の過去の行は表示されなくなる

保存形式（`SCHEMA_VERSION`）を上げるときは、`src/save/migrate.ts` の登録表に「版 N → N+1」の移行関数を足す。古い保存はそこで段階的に最新まで移してから検証される。
