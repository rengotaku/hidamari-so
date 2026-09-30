import { describe, it, expect } from "vitest";
import { createRng, newGame, step, SCENE_W, SCENE_H, roomRect, ROOM_COUNT } from "@/sim";
import type { GameState } from "@/sim";
import {
  drawScene,
  createAmbient,
  updateAmbient,
  hitTest,
  bubbleAnchor,
  toScene,
} from "@/render";

/** 呼ばれた描画命令を数えるだけの偽 Canvas。存在しないメソッドを呼べば TypeError で落ちる */
function fakeCtx() {
  const calls: Record<string, number> = {};
  const gradient = { addColorStop: () => undefined };
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get(_t, prop: string) {
      if (prop === "createRadialGradient") {
        return () => {
          calls[prop] = (calls[prop] ?? 0) + 1;
          return gradient;
        };
      }
      if (
        [
          "fillRect",
          "strokeRect",
          "beginPath",
          "moveTo",
          "quadraticCurveTo",
          "stroke",
        ].includes(prop)
      ) {
        return () => {
          calls[prop] = (calls[prop] ?? 0) + 1;
        };
      }
      return target[prop];
    },
    set(t, prop: string, value) {
      t[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

function stateAt(seed: number, minutes: number): GameState {
  const rng = createRng(seed);
  return step(newGame(rng), minutes, rng);
}

describe("render: drawScene", () => {
  it("昼・夜・雨・くもりのどれでも例外なく描ける（矩形が描かれる）", () => {
    const seen = new Set<string>();
    for (let k = 0; k < 40; k++) {
      const s = stateAt(k + 1, 60 * (k * 7) + k * 13);
      seen.add(s.weather);
      const { ctx, calls } = fakeCtx();
      drawScene(ctx, s, createAmbient(), 12345 + k * 100, k % 2 ? s.res[0]!.id : null);
      expect(calls.fillRect).toBeGreaterThan(50);
    }
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });

  it("状態を書き換えない", () => {
    const s = stateAt(4, 60 * 30);
    const before = JSON.stringify(s);
    drawScene(fakeCtx().ctx, s, createAmbient(), 1000, s.res[1]!.id);
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe("render: ambient", () => {
  it("通行人は増えても 3 人までで、画面外へ出たら消える", () => {
    const rng = createRng(1);
    let a = createAmbient();
    let max = 0;
    for (let i = 0; i < 3000; i++) {
      a = updateAmbient(a, 2, 12, rng);
      max = Math.max(max, a.walkers.length);
    }
    expect(max).toBeGreaterThan(0);
    expect(max).toBeLessThanOrEqual(3);
  });

  it("元の Ambient を書き換えない", () => {
    const rng = createRng(2);
    const a = createAmbient();
    const before = JSON.stringify(a);
    updateAmbient(a, 60, 12, rng);
    expect(JSON.stringify(a)).toBe(before);
  });
});

describe("render: hitTest / bubbleAnchor", () => {
  it("部屋の中を押すとその部屋の住人が引ける。空室は住人なし", () => {
    const s = stateAt(9, 0.5);
    for (let i = 0; i < ROOM_COUNT; i++) {
      const rr = roomRect(i);
      const hit = hitTest(s, rr.x + 37, rr.y + 24)!;
      expect(hit.room).toBe(i);
      expect(hit.residentId).toBe(s.rooms[i] ?? null);
    }
  });

  it("建物の外は null", () => {
    const s = stateAt(9, 0.5);
    expect(hitTest(s, 2, 2)).toBeNull();
  });

  it("歩いている住人を押すとその住人が引ける", () => {
    const s = stateAt(9, 0.5);
    const r = { ...s.res[0]!, at: "walking" as const, x: 150, y: 179 };
    const s2: GameState = { ...s, res: [r, ...s.res.slice(1)] };
    expect(hitTest(s2, 150, 170)).toEqual({ residentId: r.id, room: r.room });
  });

  it("吹き出しの位置は場面の内側、外出中は null", () => {
    const s = stateAt(9, 0.5);
    for (const r of s.res) {
      const p = bubbleAnchor(r);
      if (typeof r.at === "number") {
        expect(p).not.toBeNull();
        expect(p!.x).toBeGreaterThanOrEqual(0);
        expect(p!.x).toBeLessThanOrEqual(SCENE_W);
        expect(p!.y).toBeLessThanOrEqual(SCENE_H);
      } else if (r.at === "out") expect(p).toBeNull();
    }
  });

  it("toScene は要素内の位置を場面の座標へ換算する", () => {
    expect(toScene(100, 50, 640, 400)).toEqual({ x: 50, y: 25 });
  });
});
