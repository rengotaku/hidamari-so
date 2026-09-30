import { ambientRng, createAmbient, updateAmbient, type Ambient } from "@/render";
import {
  catchUp,
  loadOrNew,
  saveGame,
  type KeyValueStorage,
  type OpenedGame,
} from "@/save";
import { hourOf, step, type GameState, type Rng, type SeededRng } from "@/sim";

/**
 * 進行中のゲーム 1 つぶん（状態・乱数・通行人の演出）を持つ入れ物。
 * 画面のループから tick を呼んで進める。状態そのものは step が返す新しい値で差し替える。
 */
export class GameEngine {
  state: GameState;
  ambient: Ambient = createAmbient();
  private readonly rng: SeededRng;
  private readonly decorRng: Rng = ambientRng();

  private constructor(opened: OpenedGame) {
    this.state = opened.state;
    this.rng = opened.rng;
  }

  /** 保存があれば続きから（留守にしていた時間ぶん進める）、無ければ seed から新しく始める */
  static open(storage: KeyValueStorage, seed: number, nowMs: number): GameEngine {
    const opened = loadOrNew(storage, seed);
    const engine = new GameEngine(opened);
    if (opened.savedAt !== null) engine.resume(nowMs - opened.savedAt);
    return engine;
  }

  /** ゲーム内で gameMinutes 分進める */
  tick(gameMinutes: number): void {
    this.state = step(this.state, gameMinutes, this.rng);
    this.ambient = updateAmbient(
      this.ambient,
      gameMinutes,
      hourOf(this.state.t),
      this.decorRng
    );
  }

  /** 留守にしていた実時間 elapsedMs ぶん進める */
  resume(elapsedMs: number): void {
    this.state = catchUp(this.state, elapsedMs, this.rng);
  }

  save(storage: KeyValueStorage, nowMs: number): void {
    saveGame(storage, this.state, this.rng.getState(), nowMs);
  }
}

/** localStorage が使えない環境（プライベートモード等）でも動くように、メモリ上の代替を返す */
export function defaultStorage(): KeyValueStorage {
  try {
    const s = window.localStorage;
    s.getItem("hidamari-so-probe");
    return s;
  } catch {
    const mem = new Map<string, string>();
    return {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => void mem.set(k, v),
      removeItem: (k) => void mem.delete(k),
    };
  }
}
