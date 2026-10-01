import { useCallback, useEffect, useRef, useState } from "react";
import { hitTest, residentOfRoom, roomAt } from "@/render";
import type { KeyValueStorage, Speed } from "@/save";
import { buildingAge, formatClock, type BuyoutChoice } from "@/sim";
import { BuyoutDialog, Ending } from "./BuyoutDialog";
import { DepartedProfile } from "./DepartedProfile";
import { bubbleAnchors, holdBubbles, screenKey } from "./bubbles";
import { GameEngine, defaultStorage } from "./engine";
import { Journal } from "./Journal";
import { Profile } from "./Profile";
import { roomLog } from "./roomLog";
import { SpeedControl } from "./SpeedControl";
import { Stage } from "./Stage";
import { useGameLoop } from "./useGameLoop";
import {
  advance,
  initialZoom,
  press,
  prefersReducedMotion,
  type ZoomState,
} from "./zoom";
import "./game.css";

interface Props {
  /** 新しいゲームの乱数の種。省略時は現在時刻から決める */
  seed?: number;
  storage?: KeyValueStorage;
  /** 現在時刻（epoch ミリ秒）。テストで差し替える */
  now?: () => number;
}

const systemNow = (): number => Date.now();

/**
 * 1 画面のゲーム。上に日付・時刻と築年数、左（スマホは上）に建物、右（スマホは下）に住人のプロフィールと日誌。
 * 数値（気分・所持金・評判など）は画面に出さない。操作は時間の速さの切り替えと、築五十年の記念日のダイアログだけ。
 */
export function GameScreen({ seed, storage, now = systemNow }: Props) {
  const [store] = useState<KeyValueStorage>(() => storage ?? defaultStorage());
  const [engine] = useState(() =>
    GameEngine.open(store, seed ?? now() % 2147483647, now())
  );
  const [state, setState] = useState(engine.state);
  // 吹き出しは、読める時間のあいだ画面に残す。判定はゲームのループ（onUi）で行い、結果だけを Stage に渡す
  const [initialBubbles] = useState(() =>
    holdBubbles(
      new Map(),
      engine.state.res,
      engine.state.t,
      performance.now(),
      bubbleAnchors(engine.state, initialZoom, engine.drawPos),
      screenKey(initialZoom)
    )
  );
  const heldRef = useRef(initialBubbles.held);
  const [bubbles, setBubbles] = useState(initialBubbles.visible);
  const [speed, setSpeedState] = useState<Speed>(engine.speed);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  /** 日誌の名前から開いた、出ていった住人 */
  const [departedId, setDepartedId] = useState<number | null>(null);
  /** 部屋の大写し。描画のループは ref を見て、遷移が終わると onZoom で state にも反映する */
  const [zoom, setZoom] = useState<ZoomState>(initialZoom);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selectedIdRef = useRef<number | null>(null);
  const zoomRef = useRef<ZoomState>(initialZoom);

  /** 吹き出しの判定。ループ（onUi）と、zoom が変わった直後の両方から呼ぶ */
  const updateBubbles = useCallback(() => {
    const next = holdBubbles(
      heldRef.current,
      engine.state.res,
      engine.state.t,
      performance.now(),
      bubbleAnchors(engine.state, zoomRef.current, engine.drawPos),
      screenKey(zoomRef.current)
    );
    heldRef.current = next.held;
    setBubbles(next.visible);
  }, [engine]);

  const onZoom = useCallback(
    (z: ZoomState) => {
      zoomRef.current = z;
      setZoom(z);
      updateBubbles();
    },
    [updateBubbles]
  );

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const onUi = useCallback(() => {
    setState(engine.state);
    setSpeedState(engine.speed);
    updateBubbles();
  }, [engine, updateBubbles]);
  const onSpeed = (s: Speed) => {
    engine.setSpeed(s);
    // 次の定期保存（5 秒ごと）を待たずに、速さの選択を残す
    engine.save(store, now());
    setSpeedState(engine.speed);
  };
  useGameLoop({
    engine,
    canvasRef,
    selectedIdRef,
    zoomRef,
    onZoom,
    storage: store,
    now,
    onUi,
  });

  /** 画面を押した / キーを押した。遷移の途中は何もしない（press が無視する） */
  const pressView = (room: number | null) => {
    const t = performance.now();
    const reduced = prefersReducedMotion();
    onZoom(press(advance(zoomRef.current, t, reduced), room, t, reduced));
  };

  const onPick = (x: number, y: number) => {
    const z = advance(zoomRef.current, performance.now(), prefersReducedMotion());
    if (z.phase !== "overview") {
      // 大写しではどこを押しても全体に戻る。戻り中・ズーム中の押下は無視される
      pressView(null);
      return;
    }
    const hit = hitTest(engine.state, x, y, engine.drawPos);
    setSelectedId(hit?.residentId ?? null);
    setDepartedId(null);
    setState(engine.state);
    pressView(roomAt(x, y));
  };

  // キーボード: Enter / Space で部屋に入り、そこの住人のプロフィールを出す
  const onEnterRoom = (room: number) => {
    const z = advance(zoomRef.current, performance.now(), prefersReducedMotion());
    if (z.phase !== "overview") return;
    setSelectedId(residentOfRoom(engine.state, room));
    setDepartedId(null);
    setState(engine.state);
    pressView(room);
  };

  // 日誌の名前を押す: いる人ならその人を、出ていった人なら記録を見せる
  const onName = (id: number) => {
    const present = engine.state.res.some((r) => r.id === id);
    setSelectedId(present ? id : null);
    setDepartedId(present ? null : id);
    setState(engine.state);
  };

  const onChoose = (choice: BuyoutChoice) => {
    engine.decide(choice);
    engine.save(store, now());
    setState(engine.state);
    setSpeedState(engine.speed);
  };

  const selected = state.res.find((r) => r.id === selectedId) ?? null;
  const departed = state.departed.find((d) => d.id === departedId) ?? null;
  // 大写し中の日誌は、その部屋で起きた出来事だけ
  const logRoom = zoom.phase === "zooming" || zoom.phase === "closeup" ? zoom.room : null;
  const log = logRoom === null ? state.log : roomLog(state.log, logRoom);

  // 返事待ちの間は背景をすべて外す（aside は main の中）。ダイアログは header / main の外にある
  const pending = state.buyout.phase === "pending";

  return (
    <div className="game">
      <header className="top" inert={pending}>
        <span className="clock">{formatClock(state.t)}</span>
        <span className="age">築{buildingAge(state.t, state.t0)}年</span>
        <SpeedControl speed={speed} onChange={onSpeed} />
      </header>
      <main className="main" inert={pending}>
        <Stage
          canvasRef={canvasRef}
          state={state}
          zoom={zoom}
          bubbles={bubbles}
          onPick={onPick}
          onEnterRoom={onEnterRoom}
          onBack={() => pressView(null)}
        />
        <aside className="side">
          {departed ? (
            <DepartedProfile departed={departed} />
          ) : (
            <Profile state={state} resident={selected} />
          )}
          <Journal log={log} onName={onName} />
        </aside>
      </main>
      <BuyoutDialog state={state} onChoose={onChoose} />
      <Ending state={state} />
    </div>
  );
}
