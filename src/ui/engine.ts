import { ambientRng, createAmbient, updateAmbient, type Ambient } from "@/render";
import {
  catchUp,
  loadOrNew,
  saveGame,
  SPEEDS,
  type KeyValueStorage,
  type OpenedGame,
  type Speed,
} from "@/save";
import { hourOf, step, type GameState, type Rng, type SeededRng } from "@/sim";

/** 1 回の tick で進める上限（ゲーム内分）。内部の 1 刻み 2 分で 120 回ぶん */
export const MAX_TICK_MINUTES = 240;
/** 持ち越しの上限（ゲーム内分）。重い端末で溜まり続けないように */
export const MAX_BACKLOG_MINUTES = 1440;

/**
 * 進行中のゲーム 1 つぶん（状態・乱数・通行人の演出）を持つ入れ物。
 * 画面のループから tick を呼んで進める。状態そのものは step が返す新しい値で差し替える。
 */
export class GameEngine {
  state: GameState;
  ambient: Ambient = createAmbient();
  private readonly rng: SeededRng;
  private readonly decorRng: Rng = ambientRng();

  /** 時間の速さ（0 = 停止 / 1 / 4 / 15 倍）。setSpeed で切り替える */
  speed: Speed;
  /** 1 回の tick で処理しきれず、次の tick に回したゲーム内分 */
  private backlog = 0;

  private constructor(opened: OpenedGame) {
    this.state = opened.state;
    this.rng = opened.rng;
    this.speed = opened.speed;
  }

  /** 保存があれば続きから（留守にしていた時間ぶん進める）、無ければ seed から新しく始める */
  static open(storage: KeyValueStorage, seed: number, nowMs: number): GameEngine {
    const opened = loadOrNew(storage, seed);
    const engine = new GameEngine(opened);
    if (opened.savedAt !== null) engine.resume(nowMs - opened.savedAt);
    return engine;
  }

  /** 速さを切り替える。停止にすると持ち越し分も捨てるので、戻した瞬間に一気に進まない */
  setSpeed(speed: Speed): void {
    if (!SPEEDS.includes(speed)) return;
    this.speed = speed;
    if (speed === 0) this.backlog = 0;
  }

  /**
   * 速さ 1 のときにゲーム内で gameMinutes 分進む実時間ぶんを渡す。速さ倍の時間を 1 刻みずつ処理する。
   * 1 回で処理するのは MAX_TICK_MINUTES まで。超えた分は次の tick に回す（画面を固めない）。
   */
  tick(gameMinutes: number): void {
    if (this.speed === 0 || !Number.isFinite(gameMinutes) || gameMinutes < 0) return;
    const want = Math.min(this.backlog + gameMinutes * this.speed, MAX_BACKLOG_MINUTES);
    const minutes = Math.min(want, MAX_TICK_MINUTES);
    this.backlog = want - minutes;
    if (minutes <= 0) return;
    this.state = step(this.state, minutes, this.rng);
    this.ambient = updateAmbient(
      this.ambient,
      minutes,
      hourOf(this.state.t),
      this.decorRng
    );
  }

  /** 留守にしていた実時間 elapsedMs ぶん進める */
  resume(elapsedMs: number): void {
    this.state = catchUp(this.state, elapsedMs, this.rng);
  }

  save(storage: KeyValueStorage, nowMs: number): void {
    saveGame(storage, this.state, this.rng.getState(), nowMs, this.speed);
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
