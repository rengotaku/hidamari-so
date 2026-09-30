import { useCallback, useEffect, useRef, useState } from "react";
import { hitTest } from "@/render";
import type { KeyValueStorage, Speed } from "@/save";
import { buildingAge, formatClock, type BuyoutChoice } from "@/sim";
import { BuyoutDialog, Ending } from "./BuyoutDialog";
import { DepartedProfile } from "./DepartedProfile";
import { GameEngine, defaultStorage } from "./engine";
import { Journal } from "./Journal";
import { Profile } from "./Profile";
import { SpeedControl } from "./SpeedControl";
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
 * 数値（気分・所持金・評判など）は画面に出さない。操作は時間の速さの切り替えと、築五十年の記念日のダイアログだけ。
 */
export function GameScreen({ seed, storage, now = systemNow }: Props) {
  const [store] = useState<KeyValueStorage>(() => storage ?? defaultStorage());
  const [engine] = useState(() =>
    GameEngine.open(store, seed ?? now() % 2147483647, now())
  );
  const [state, setState] = useState(engine.state);
  const [speed, setSpeedState] = useState<Speed>(engine.speed);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  /** 日誌の名前から開いた、出ていった住人 */
  const [departedId, setDepartedId] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selectedIdRef = useRef<number | null>(null);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const onUi = useCallback(() => {
    setState(engine.state);
    setSpeedState(engine.speed);
  }, [engine]);
  const onSpeed = (s: Speed) => {
    engine.setSpeed(s);
    setSpeedState(engine.speed);
  };
  useGameLoop({ engine, canvasRef, selectedIdRef, storage: store, now, onUi });

  const onPick = (x: number, y: number) => {
    const hit = hitTest(engine.state, x, y);
    setSelectedId(hit?.residentId ?? null);
    setDepartedId(null);
    setState(engine.state);
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

  return (
    <div className="game">
      <header className="top">
        <span className="clock">{formatClock(state.t)}</span>
        <span className="age">築{buildingAge(state.t, state.t0)}年</span>
        <SpeedControl speed={speed} onChange={onSpeed} />
      </header>
      <main className="main">
        <Stage canvasRef={canvasRef} state={state} onPick={onPick} />
        <aside className="side">
          {departed ? (
            <DepartedProfile departed={departed} />
          ) : (
            <Profile state={state} resident={selected} />
          )}
          <Journal log={state.log} onName={onName} />
        </aside>
      </main>
      <BuyoutDialog state={state} onChoose={onChoose} />
      <Ending state={state} />
    </div>
  );
}
