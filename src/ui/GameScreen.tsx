import { useCallback, useEffect, useRef, useState } from "react";
import { hitTest } from "@/render";
import type { KeyValueStorage } from "@/save";
import { buildingAge, formatClock } from "@/sim";
import { GameEngine, defaultStorage } from "./engine";
import { Journal } from "./Journal";
import { Profile } from "./Profile";
import { Stage } from "./Stage";
import { useGameLoop } from "./useGameLoop";
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
 * 数値（気分・所持金・評判など）は画面に出さない。操作ボタンも置かない。
 */
export function GameScreen({ seed, storage, now = systemNow }: Props) {
  const [store] = useState<KeyValueStorage>(() => storage ?? defaultStorage());
  const [engine] = useState(() =>
    GameEngine.open(store, seed ?? now() % 2147483647, now())
  );
  const [state, setState] = useState(engine.state);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selectedIdRef = useRef<number | null>(null);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const onUi = useCallback(() => setState(engine.state), [engine]);
  useGameLoop({ engine, canvasRef, selectedIdRef, storage: store, now, onUi });

  const onPick = (x: number, y: number) => {
    const hit = hitTest(engine.state, x, y);
    setSelectedId(hit?.residentId ?? null);
    setState(engine.state);
  };

  const selected = state.res.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="game">
      <header className="top">
        <span className="clock">{formatClock(state.t)}</span>
        <span className="age">築{buildingAge(state.t, state.t0)}年</span>
      </header>
      <main className="main">
        <Stage canvasRef={canvasRef} state={state} onPick={onPick} />
        <aside className="side">
          <Profile state={state} resident={selected} />
          <Journal log={state.log} />
        </aside>
      </main>
    </div>
  );
}
