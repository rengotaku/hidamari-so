import { describe, expect, it } from "vitest";
import { createRng, newGame, type GameState } from "@/sim";
import { createAmbient, drawScene } from "@/render";
import { defaultContent } from "@/content";

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

describe("#36: 全体図の行動中の色替えと隠し", () => {
  /** 部屋 1 つを、装飾 items・住人の行動 act で描いて、矩形の色を数える */
  const fillsWith = (items: string[], act: "stream" | "phone" | "guitar") => {
    const s = structuredClone(newGame(createRng(2)));
    s.t = 12 * 60;
    const room = s.res[0]!.room;
    const r = s.res[0]!;
    r.at = room;
    r.act = act;
    s.decor[room] = { items, boxes: 0 };
    return draw(s);
  };
  const n = (fills: string[], c: string) => fills.filter((f) => f === c).length;

  it("8: stream の方が #ffffff が 4 多く、#bbbbbb が 4 少ない（phone と比べる）", () => {
    const stream = fillsWith(["streaming-set"], "stream");
    const phone = fillsWith(["streaming-set"], "phone");
    expect(n(stream, "#ffffff") - n(phone, "#ffffff")).toBe(4);
    expect(n(phone, "#bbbbbb") - n(stream, "#bbbbbb")).toBe(4);
  });

  it("10: guitar の hideDuringAct は今までどおり効く（弾いている間は描かれない）", () => {
    const guitar = defaultContent.decor["guitar"]!;
    const extra = (act: "phone" | "guitar") =>
      fillsWith(["guitar"], act).length - fillsWith([], act).length;
    expect(extra("phone")).toBe(guitar.boxes.length);
    expect(extra("guitar")).toBe(0);
  });
});
