# content/ — 住人と出来事のデータ

ゲームの物語は、コードではなくここの JSON で持つ。出来事を足すのにコードの変更は要らない。
読み込み時に `src/content/schema.ts` の zod スキーマで検証し、書き間違い（未知のフィールド・存在しない id・宣言していない差し込み・本文の数字など）は `make test` / `make ci` で落ちる。

| ファイル | 中身 |
|---|---|
| `archetypes.json` | キャラの種類（職業・年齢幅・睡眠時間帯・勤務シフト・趣味の重み・癖の候補・仕送り・初期所持金・人生の筋の入口） |
| `traits.json` | だめな癖（表示名と説明） |
| `storylets/*.json` | 出来事。1 ファイルに配列で複数件を書いても、オブジェクト 1 件だけを書いてもよい |

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
| `when` | `hours`: `[開始時, 終了時)`（`[23, 4]` のように日をまたげる）、`weather`: `sunny` / `cloudy` / `rain` |
| `roles` | 登場人物の条件。`a`・`b` のうち宣言した役割だけが登場する（下の表） |
| `cooldownDays` | 同じ出来事が再び起きるまでの最短日数 |
| `once` | `true` なら 1 ゲームで 1 回だけ |
| `texts` | 本文の言い回し（1 つ以上。起きるたびに 1 つ選ぶ） |
| `numbers` | `{n}` に入る漢数字を `[最小, 最大]` で抽選する |
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
| `opening` | 新規ゲームの最初の 1 件 | なし |
| `book` | 他の出来事の `book` や人生の筋から予約されたときだけ | 任意 |

### roles の条件（すべて省略可。書いたものは全部満たす）

`archetype` / `notArchetype`（種類の id）、`tag` / `notTag`（種類のタグ。例 `old`）、`trait` / `notTrait`（癖の id）、`floor`（1 か 2）、`inRoom`（自室にいるか）、`awake`（起きているか）、`out`（外出中か）、`noisy`（この 1 日以内に騒いだか）、`stayDays`・`money`（`{min, max}`）。
`b` にだけ、`a` との関係として `affinity`（仲の良さ 0〜100、初期値 30。`{min, max}`）と `romance`（恋の段階 `none` / `crush` / `dating` / `married` のどれか）を書ける。

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

## 種類（archetype）を足す

`archetypes.json` に 1 件足す。`traits` は `traits.json` に存在する id、`arc` は人生の筋の入口にする storylet の id（`trigger: "book"`）。
勤務シフトの `days` は「日付 % every が on のどれかに一致する日」（毎日なら `{"every": 1, "on": [0]}`）。`start` が `end` より大きいシフトは日をまたぐ夜勤。

## 日誌との関係

日誌は組み立て済みの文章ではなく `{t, storyletId, roles, variant}` を保存し、表示のたびにここの `texts` から本文を組み立てる。
保存後に `texts` を直せば、過去の日誌の表示も変わる（保存されているのは何番目の言い回しかだけ）。
- `texts` の順番を入れ替える・削る: 保存済みの番号が別の言い回しを指す。番号が範囲外なら先頭の言い回しになる
- `numbers` / `choices` を足す・名前を変える: 過去の行にはその値が保存されていないので、`numbers` は下限、`choices` は先頭の候補で補う（`undefined` や `NaN` は出ない）
- `{act}` `{shift}` の値が保存されていない過去の行は、その差し込みが空になる
- `id` を消す・変えると、その出来事の過去の行は表示されなくなる

保存形式（`SCHEMA_VERSION`）を上げるときは、`src/save/migrate.ts` の登録表に「版 N → N+1」の移行関数を足す。古い保存はそこで段階的に最新まで移してから検証される。
