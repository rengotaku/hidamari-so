import {
  MIN_PER_SEC,
  createRng,
  newGame,
  step,
  type GameState,
  type SeededRng,
} from "@/sim";
import { SCHEMA_VERSION, saveEnvelope } from "./schema";

export { SCHEMA_VERSION };
export const SAVE_KEY = "hidamari-so-save";
/** 留守中に進めるのは、ゲーム内 3 日ぶんまで */
export const MAX_CATCHUP_MINUTES = 3 * 1440;

export type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface LoadedGame {
  state: GameState;
  rngState: number;
  savedAt: number;
}

/** 書き込みに失敗（容量超過・プライベートモード等）してもゲームは止めない */
export function saveGame(
  storage: KeyValueStorage,
  state: GameState,
  rngState: number,
  nowMs: number
): boolean {
  try {
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, savedAt: nowMs, rngState, state })
    );
    return true;
  } catch {
    return false;
  }
}

/** 保存が無い・壊れている・schemaVersion が違うときは null（例外は出さない） */
export function loadGame(storage: KeyValueStorage): LoadedGame | null {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = saveEnvelope.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const { state, rngState, savedAt } = parsed.data;
    return { state: state as GameState, rngState, savedAt };
  } catch {
    return null;
  }
}

export interface OpenedGame {
  state: GameState;
  rng: SeededRng;
  /** 読み込んだ保存の時刻。新しいゲームのときは null */
  savedAt: number | null;
}

/** 保存があれば続きから、無ければ seed から新しいゲームを始める */
export function loadOrNew(storage: KeyValueStorage, seed: number): OpenedGame {
  const loaded = loadGame(storage);
  if (loaded)
    return {
      state: loaded.state,
      rng: createRng(loaded.rngState),
      savedAt: loaded.savedAt,
    };
  const rng = createRng(seed);
  return { state: newGame(rng), rng, savedAt: null };
}

/**
 * 留守にしていた実時間 elapsedMs ぶん、ゲームを進める（実時間 1 秒 = ゲーム内 2 分、上限はゲーム内 3 日）。
 * 負・0・NaN・無限大・1 分未満のときは状態を変えない。時計は呼び出し側が測って渡す。
 */
export function catchUp(state: GameState, elapsedMs: number, rng: SeededRng): GameState {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return state;
  const minutes = Math.min((elapsedMs / 1000) * MIN_PER_SEC, MAX_CATCHUP_MINUTES);
  if (minutes < 1) return state;
  return step(state, minutes, rng, { quiet: true });
}
