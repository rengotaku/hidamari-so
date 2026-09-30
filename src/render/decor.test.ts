import { describe, expect, it } from "vitest";
import { createRng, newGame, type GameState } from "@/sim";
import { createAmbient, drawScene } from "@/render";

/** 塗った矩形を色ごとに数えるだけの偽 Canvas */
function fakeCtx() {
  const fills: string[] = [];
  let style = "";
  const ctx = {
    set fillStyle(v: string) {
      style = v;
    },
    get fillStyle() {
      return style;
    },
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    fillRect: () => fills.push(style),
    strokeRect: () => undefined,
    beginPath: () => undefined,
    moveTo: () => undefined,
    quadraticCurveTo: () => undefined,
    stroke: () => undefined,
    createRadialGradient: () => ({ addColorStop: () => undefined }),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, fills };
}

const draw = (s: GameState) => {
  const { ctx, fills } = fakeCtx();
  drawScene(ctx, s, createAmbient(), 1000, null);
  return fills;
};

describe("追加: 装飾と大家の描画", () => {
  it("装飾を外すと塗る矩形が減り、段ボールを足すと増える（装飾はデータから描かれる）", () => {
    const s = newGame(createRng(2));
    const room = s.res[0]!.room;
    const full = draw(s).length;
    const bare = structuredClone(s);
    bare.decor[room] = { items: [], boxes: 0 };
    expect(draw(bare).length).toBeLessThan(full);
    const boxed = structuredClone(bare);
    boxed.decor[room] = { items: [], boxes: 3 };
    expect(draw(boxed).length).toBeGreaterThan(draw(bare).length);
  });

  it("知らない装飾 id・区画を超える数が入っていても例外にならない", () => {
    const s = structuredClone(newGame(createRng(3)));
    const room = s.res[0]!.room;
    s.decor[room] = {
      items: ["no-such", ...Array.from({ length: 12 }, () => "book-tower")],
      boxes: 3,
    };
    expect(() => draw(s)).not.toThrow();
  });

  it("大家が歩いている・片付けている・新しい住人を連れている場面を描ける", () => {
    const base = newGame(createRng(4));
    const idle = draw(base).length;
    const walking = structuredClone(base);
    walking.landlord = {
      ...walking.landlord,
      phase: "up",
      room: 3,
      x: 100,
      y: 179,
    };
    expect(draw(walking).length).toBeGreaterThan(idle);
    const clearing = structuredClone(base);
    clearing.landlord = {
      ...clearing.landlord,
      phase: "clearing",
      room: 3,
      x: 200,
      y: 115,
    };
    expect(draw(clearing).length).toBeGreaterThan(idle);
    const escort = structuredClone(walking);
    escort.landlord.phase = "escort";
    escort.landlord.escort = structuredClone(base.res[0]!);
    expect(draw(escort).length).toBeGreaterThan(draw(walking).length);
  });
});
