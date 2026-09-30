import { describe, it, expect } from "vitest";
import { createRng, newGame, roomRect, type GameState } from "@/sim";
import { createAmbient, drawScene } from "@/render";

/** fillRect が呼ばれたときの色と矩形を記録するだけの偽 Canvas */
function recordingCtx() {
  const rects: { color: string; x: number; y: number; w: number; h: number }[] = [];
  const target: Record<string, unknown> = {};
  const gradient = { addColorStop: () => undefined };
  const ctx = new Proxy(target, {
    get(t, prop: string) {
      if (prop === "createRadialGradient") return () => gradient;
      if (prop === "fillRect")
        return (x: number, y: number, w: number, h: number) =>
          rects.push({ color: String(t.fillStyle), x, y, w, h });
      if (
        ["strokeRect", "beginPath", "moveTo", "quadraticCurveTo", "stroke"].includes(prop)
      )
        return () => undefined;
      return t[prop];
    },
    set(t, prop: string, value) {
      t[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, rects };
}

const HEARTS = new Set(["#e86a8a", "#ff9bb0", "#f4527a"]);

function coupleAt(stage: "crush" | "dating", t: number): { s: GameState; room: number } {
  const s = newGame(createRng(77));
  const [a, b] = [s.res[0]!, s.res[1]!];
  a.at = a.room;
  a.visiting = false;
  b.at = a.room;
  b.visiting = true;
  s.t = t;
  s.bonds = [{ a: Math.min(a.id, b.id), b: Math.max(a.id, b.id), affinity: 80, stage }];
  return { s, room: a.room };
}

describe("夜の場面の描画", () => {
  it("付き合っている 2 人が夜に同じ部屋にいると、その部屋が暗くなってハートが描かれる", () => {
    const { s, room } = coupleAt("dating", 23 * 60);
    const { ctx, rects } = recordingCtx();
    drawScene(ctx, s, createAmbient(), 4000, null);
    const rr = roomRect(room);
    const hearts = rects.filter((r) => HEARTS.has(r.color));
    expect(hearts.length).toBeGreaterThan(10);
    for (const h of hearts) {
      expect(h.x).toBeGreaterThanOrEqual(rr.x);
      expect(h.x).toBeLessThanOrEqual(rr.x + rr.w);
      expect(h.y).toBeGreaterThanOrEqual(rr.y);
      expect(h.y).toBeLessThanOrEqual(rr.y + rr.h);
    }
    // 部屋全体を覆う暗転の矩形がある
    expect(rects.some((r) => r.color === "#090914" && r.w === rr.w && r.h === rr.h)).toBe(
      true
    );
  });

  it("片想いの 2 人なら、同じ状況でもハートは描かれない", () => {
    const { s } = coupleAt("crush", 23 * 60);
    const { ctx, rects } = recordingCtx();
    drawScene(ctx, s, createAmbient(), 4000, null);
    expect(rects.filter((r) => HEARTS.has(r.color))).toEqual([]);
  });

  it("付き合っていても、昼には描かれない", () => {
    const { s } = coupleAt("dating", 12 * 60);
    const { ctx, rects } = recordingCtx();
    drawScene(ctx, s, createAmbient(), 4000, null);
    expect(rects.filter((r) => HEARTS.has(r.color))).toEqual([]);
  });
});
