# ADR 索引

<!-- generate-adr-index.zsh による自動生成。手で編集しない -->

| ADR | タイトル | status | date | 要旨 |
|---|---|---|---|---|
| [0001](0001-content-json-and-zod.md) | 出来事とキャラの種類を content/ の JSON に持ち、zod で検証する（content, storylet, archetype） | accepted | 2026-10-01 | 物語（出来事・キャラの種類・癖・装飾・町並みの変化）はコードでなく content/ の JSON で持ち、読み込み時に zod で検証する。日誌は本文でなく出来事の構造で保存する |
| [0002](0002-save-no-version-bump.md) | 保存の版を上げず、欠けた項目は読み込み時に補う（save, schemaVersion, fillHouse） | accepted | 2026-10-01 | 保存に項目を足すときは schemaVersion を上げず、zod の既定値か fillHouse で読み込み時に補う。版を上げるのは構造を置き換えるときだけ |
| [0003](0003-decor-25d-boxes-source.md) | 装飾は 2.5D の箱を正とし、全体図の平面はそこから導く（decor, closeup, flatRects） | accepted | 2026-10-01 | 部屋の装飾は 2.5D の箱の並びを唯一の定義とし、全体図の平面の矩形はコードが箱から導く。絵を二重に持たない |
| [0004](0004-time-stepping.md) | 時間の進め方: 速さは tick に渡す分に掛け、step は買収提案で打ち切る（tick, step, backlog, catchUp） | accepted | 2026-10-01 | 速さは刻みの大きさでなく進める分量に掛ける。1 回の tick と留守中の進行には上限を置き、step は築 50 年の買収提案が立った刻みで止まる |
| [0005](0005-landlord-state-machine.md) | 入居は大家の状態機械に一本化する（退去・片付け・連れて来る・模様替え）（landlord, vacancy, settle） | accepted | 2026-10-01 | 新しい住人は、退去で生まれた空き部屋を大家が片付け、入居の日に連れて来る流れでしか入らない。入居後の模様替えも同じ流れの続きとして時間をかけて進める |
| [0006](0006-view-only-ui.md) | 画面に数値と操作ボタンを出さない。選択は買収提案だけで、速さのボタンは別枠（ui, buyout, speed） | accepted | 2026-10-01 | 画面に出すのは建物の様子・プロフィール（言葉だけ）・日誌。プレイヤーが選ぶのは築 50 年の買収提案だけで、時間の速さのボタンは眺める側の操作として別枠で置く |
| [0007](0007-pwa-update-on-next-launch.md) | PWA の新しい版は、古い画面がすべて閉じた次回の起動で有効にする（pwa, service worker, update） | accepted | 2026-10-01 | service worker の skipWaiting と clientsClaim を無効にし、新しい版は古い画面が全部閉じた次の起動から使う。読み込み途中で版が混ざらない代わりに、開きっぱなしの画面には新しい版が届かない |
