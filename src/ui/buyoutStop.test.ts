import { describe, it, expect, beforeEach } from "vitest";
import { createRng, isBuyoutPending, newGame, step, type GameState } from "@/sim";
import { loadGame, saveGame } from "@/save";
import { GameEngine } from "@/ui/engine";

const NOW = 9_000_000;
const DAY = 1440;

beforeEach(() => localStorage.clear());

/** 記念日の少し手前（開始から 54 日の 1 時間前）の保存を用意し、速さ 4 で開く */
function openBeforeAnniversary(speed: 0 | 1 | 4 | 15 = 4): GameEngine {
  const rng = createRng(2026);
  const s0 = newGame(rng);
  const s = step(s0, 54 * DAY - 60, rng);
  expect(isBuyoutPending(s)).toBe(false);
  saveGame(localStorage, s, rng.getState(), NOW, speed);
  return GameEngine.open(localStorage, 1, NOW);
}

/** 記念日を迎えて返事待ちのエンジン */
function pendingEngine(): GameEngine {
  const e = openBeforeAnniversary(4);
  for (let i = 0; i < 20 && !isBuyoutPending(e.state); i++) e.tick(30);
  expect(isBuyoutPending(e.state)).toBe(true);
  return e;
}

describe("買収提案での自動停止", () => {
  it("記念日が来ると速さが停止になり、以後 tick しても進まない", () => {
    const e = openBeforeAnniversary(4);
    expect(e.speed).toBe(4);
    for (let i = 0; i < 20 && !isBuyoutPending(e.state); i++) e.tick(30);
    expect(isBuyoutPending(e.state)).toBe(true);
    expect(e.speed).toBe(0);
    const t = e.state.t;
    e.tick(600);
    expect(e.state.t).toBe(t);
  });

  it("返事を待っている間は、速さのボタンを押しても時間が進まない", () => {
    const e = pendingEngine();
    const t = e.state.t;
    for (const sp of [1, 4, 15] as const) {
      e.setSpeed(sp);
      expect(e.speed).toBe(0);
      e.tick(600);
      expect(e.state.t).toBe(t);
    }
  });

  it("「断る」で 1 倍に戻って時間が進み、記念日は再び止めない", () => {
    const e = pendingEngine();
    const t = e.state.t;
    e.decide("decline");
    expect(e.speed).toBe(1);
    expect(e.state.buyout.phase).toBe("declined");
    e.tick(60);
    expect(e.state.t).toBeGreaterThan(t);
    e.setSpeed(15);
    expect(e.speed).toBe(15);
    e.tick(120);
    expect(isBuyoutPending(e.state)).toBe(false);
    expect(e.speed).toBe(15);
  });

  it("「売る」の結末では止まったまま（速さを上げても状態は進まない）", () => {
    const e = pendingEngine();
    e.decide("sell");
    expect(e.speed).toBe(0);
    expect(e.state.buyout.phase).toBe("sold");
    const snapshot = JSON.stringify(e.state);
    e.setSpeed(15);
    e.tick(600);
    expect(JSON.stringify(e.state)).toBe(snapshot);
  });

  it("追加: 待っていないときの decide は速さも状態も変えない", () => {
    const e = openBeforeAnniversary(4);
    const snapshot = JSON.stringify(e.state);
    e.decide("decline");
    e.decide("sell");
    expect(e.speed).toBe(4);
    expect(JSON.stringify(e.state)).toBe(snapshot);
  });

  it("追加: 留守の間に記念日をまたいでも、そこで止まって返事を待つ", () => {
    const rng = createRng(2026);
    const s = step(newGame(rng), 52 * DAY, rng);
    saveGame(localStorage, s, rng.getState(), NOW, 4);
    // 実時間 3 日ぶん（ゲーム内の上限 3 日）留守にした
    const e = GameEngine.open(localStorage, 1, NOW + 3 * DAY * 30_000);
    expect(isBuyoutPending(e.state)).toBe(true);
    expect(e.speed).toBe(0);
    // 記念日の直後（区切り 6 時間以内）で止まり、3 日ぶんは進んでいない
    const past = e.state.t - e.state.t0 - 54 * DAY;
    expect(past).toBeGreaterThanOrEqual(0);
    expect(past).toBeLessThanOrEqual(6 * 60);
  });

  it("追加: 返事待ちの保存は、保存された速さが何でも停止で開く。保存し直しても保たれる", () => {
    const rng = createRng(2026);
    const s: GameState = step(newGame(rng), 54 * DAY, rng);
    expect(isBuyoutPending(s)).toBe(true);
    saveGame(localStorage, s, rng.getState(), NOW, 15);
    const e = GameEngine.open(localStorage, 1, NOW + 60_000);
    expect(e.speed).toBe(0);
    expect(e.state.t).toBe(s.t);
    e.save(localStorage, NOW);
    expect(loadGame(localStorage)!.speed).toBe(0);
  });
});
