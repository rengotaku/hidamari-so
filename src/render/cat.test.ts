import { describe, it, expect } from "vitest";
import { createRng } from "@/sim";
import { createAmbient, updateAmbient, type Ambient } from "./ambient";
import { drawCat } from "./person";

/** fillRect が呼ばれたときの色と矩形を記録するだけの偽 Canvas */
function recordingCtx() {
  const rects: { color: string; x: number; y: number; w: number; h: number }[] = [];
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get(t, prop: string) {
      if (prop === "fillRect")
        return (x: number, y: number, w: number, h: number) =>
          rects.push({ color: String(t.fillStyle), x, y, w, h });
      return t[prop];
    },
    set(t, prop: string, value) {
      t[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, rects };
}

const EYE = "#2a1f1a";
const eyeX = (dir: 1 | -1) => {
  const { ctx, rects } = recordingCtx();
  drawCat(ctx, 100, 178, 0, dir);
  return rects.find((r) => r.color === EYE)!.x;
};

describe("猫の向き", () => {
  it("右向きなら目（頭）は体の右、左向きなら体の左にある", () => {
    expect(eyeX(1)).toBeGreaterThan(100);
    expect(eyeX(-1)).toBeLessThan(100);
  });

  it("左向きは右向きを x を軸に左右反転した形になる", () => {
    const draw = (dir: 1 | -1) => {
      const { ctx, rects } = recordingCtx();
      drawCat(ctx, 100, 178, 1, dir);
      return rects;
    };
    const right = draw(1);
    const left = draw(-1);
    expect(left).toHaveLength(right.length);
    left.forEach((r, i) => {
      const o = right[i]!;
      expect({ ...r, x: 200 - r.x - r.w }).toEqual(o);
    });
  });

  it("向きを省略すると右向き（従来どおり）", () => {
    const { ctx, rects } = recordingCtx();
    drawCat(ctx, 100, 178, 0);
    expect(rects.find((r) => r.color === EYE)!.x).toBe(eyeX(1));
  });

  it("歩いている方向を向き、着いたらその向きのまま止まる", () => {
    const rng = createRng(1);
    let a: Ambient = { ...createAmbient(), cat: { x: 200, tx: 60, dir: 1 } };
    a = updateAmbient(a, 1, 12, rng);
    expect(a.cat.dir).toBe(-1);
    expect(a.cat.x).toBeLessThan(200);
    // 目標は着くまで変わらない（着いた後に次の目標を引く）ので、着いた時点で止める
    for (let i = 0; i < 100 && Math.abs(a.cat.tx - a.cat.x) >= 0.5; i++)
      a = updateAmbient(a, 1, 12, rng);
    expect(a.cat.x).toBe(60);
    expect(a.cat.dir).toBe(-1);

    let b: Ambient = { ...createAmbient(), cat: { x: 60, tx: 250, dir: -1 } };
    b = updateAmbient(b, 1, 12, rng);
    expect(b.cat.dir).toBe(1);
    expect(b.cat.x).toBeGreaterThan(60);
  });

  it("元の Ambient を書き換えない", () => {
    const a: Ambient = { ...createAmbient(), cat: { x: 200, tx: 60, dir: 1 } };
    updateAmbient(a, 1, 12, createRng(2));
    expect(a.cat).toEqual({ x: 200, tx: 60, dir: 1 });
  });
});
