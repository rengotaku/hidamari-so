import { describe, it, expect } from "vitest";
import { createRng, newGame } from "@/sim";
import { createAmbient, drawScene } from "@/render";
import {
  MOVING_BOX_ID,
  NO_ACTS,
  boxesFor,
  decorSchema,
  defaultContent,
  flatRects,
  orderedBoxes,
} from ".";

/** fillRect の呼び出し（色と矩形）を記録するだけの偽 Canvas */
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
      if (typeof t[prop] === "undefined") return () => undefined;
      return t[prop];
    },
    set(t, prop: string, value) {
      t[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, rects };
}

describe("G7: 装飾データ（2.5D 定義）から全体図用の平面を導く", () => {
  it("G7: すべての装飾が、2.5D の箱から平面の矩形を導けて、全体図に描ける", () => {
    const defs = Object.values(defaultContent.decor);
    expect(defs.length).toBeGreaterThan(20);
    for (const def of defs) {
      const flat = flatRects(def);
      // 箱が 1 つずつ矩形になる（消えも増えもしない）
      expect(flat.length, def.id).toBe(def.boxes.length);
      expect(flat.length).toBeGreaterThan(0);
      for (const [x, y, w, h] of flat) {
        expect(x, def.id).toBeGreaterThanOrEqual(0);
        expect(y, def.id).toBeGreaterThanOrEqual(0);
        expect(x + w, def.id).toBeLessThanOrEqual(def.w);
        expect(y + h, def.id).toBeLessThanOrEqual(def.h);
      }
    }
    // 全体図で実際に描かれる: 部品を 1 つ飾った部屋は、飾っていない部屋より矩形が増える
    const base = newGame(createRng(12));
    base.t = 12 * 60;
    const room = base.res[0]!.room;
    const bare = structuredClone(base);
    bare.decor[room] = { items: [], boxes: 0 };
    const count = (s: typeof base) => {
      const { ctx, rects } = recordingCtx();
      drawScene(ctx, s, createAmbient(), 1000, null);
      return rects.length;
    };
    const bareCount = count(bare);
    for (const def of defs) {
      const s = structuredClone(bare);
      s.decor[room] =
        def.id === MOVING_BOX_ID
          ? { items: [], boxes: 1 }
          : { items: [def.id], boxes: 0 };
      expect(count(s) - bareCount, def.id).toBe(flatRects(def).length);
    }
  });
});

describe("追加: 2.5D 定義と平面の対応", () => {
  const def = decorSchema.parse({
    id: "test-shelf",
    name: "試験用の棚",
    slot: "floor",
    w: 6,
    d: 4,
    h: 10,
    boxes: [
      [0, 0, 0, 6, 4, 10, "#111111"],
      [1, 3, 6, 4, 1, 3, "#222222"],
    ],
  });

  it("平面は箱の正面の矩形: 床からの高さ z は、上からの y = h - z - 高さ になる", () => {
    expect(flatRects(def)).toEqual([
      [0, 0, 6, 10, "#111111"],
      [1, 1, 4, 3, "#222222"],
    ]);
  });

  it("奥にある箱から先に並ぶ（同じ奥行きは定義の順）", () => {
    const d2 = decorSchema.parse({
      ...def,
      boxes: [
        [0, 2, 0, 2, 2, 2, "#aaaaaa"],
        [2, 0, 0, 2, 2, 2, "#bbbbbb"],
        [4, 0, 0, 2, 2, 2, "#cccccc"],
      ],
    });
    expect(orderedBoxes(d2).map((b) => b[6])).toEqual(["#bbbbbb", "#cccccc", "#aaaaaa"]);
  });

  it("箱が部品の枠を出ている・色が不正・旧形式（rects）の部品は通らない", () => {
    expect(decorSchema.safeParse({ ...def, d: 3 }).success).toBe(false);
    expect(decorSchema.safeParse({ ...def, h: 9 }).success).toBe(false);
    expect(
      decorSchema.safeParse({ ...def, boxes: [[0, 0, 0, 1, 1, 1, "red"]] }).success
    ).toBe(false);
    expect(
      decorSchema.safeParse({ ...def, boxes: [], rects: [[0, 0, 1, 1, "#000000"]] })
        .success
    ).toBe(false);
  });
});

describe("#36: 行動中に色が変わる部品（recolorDuringAct）", () => {
  const light = defaultContent.decor["streaming-set"]!;
  const count = (boxes: readonly (readonly unknown[])[], c: string) =>
    boxes.filter((b) => b[6] === c).length;

  it("1: streaming-set の recolorDuringAct は {stream, #bbbbbb, #ffffff} で、検証を通る", () => {
    expect(light.recolorDuringAct).toEqual({
      act: "stream",
      from: "#bbbbbb",
      to: "#ffffff",
    });
    expect(decorSchema.safeParse(light).success).toBe(true);
  });

  it("2: from がどの箱の色にも無いと検証が落ち、メッセージに recolorDuringAct.from が含まれる", () => {
    const r = decorSchema.safeParse({
      ...light,
      recolorDuringAct: { act: "stream", from: "#123456", to: "#ffffff" },
    });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(
        r.error.issues.some((i) => i.message.includes("recolorDuringAct.from"))
      ).toBe(true);
  });

  it("3: from を大文字で書いても検証を通り、#bbbbbb の箱 4 つが #ffffff になる", () => {
    const def = decorSchema.parse({
      ...light,
      recolorDuringAct: { act: "stream", from: "#BBBBBB", to: "#ffffff" },
    });
    const out = boxesFor(def, new Set(["stream"]));
    expect(count(out, "#ffffff")).toBe(4);
    expect(count(out, "#bbbbbb")).toBe(0);
  });

  it("4: 箱のはみ出しと from の誤記を同時に入れると、issue が 2 つとも報告される", () => {
    const r = decorSchema.safeParse({
      ...light,
      h: 13,
      recolorDuringAct: { act: "stream", from: "#123456", to: "#ffffff" },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msgs = r.error.issues.map((i) => i.message);
      expect(msgs.some((m) => m.includes("recolorDuringAct.from"))).toBe(true);
      expect(msgs.some((m) => m.includes("枠を出ている"))).toBe(true);
    }
  });

  it("5: act に 'no-such-act' を書くと検証が落ちる", () => {
    expect(
      decorSchema.safeParse({
        ...light,
        recolorDuringAct: { act: "no-such-act", from: "#bbbbbb", to: "#ffffff" },
      }).success
    ).toBe(false);
  });

  it("6: boxesFor(def, {stream}) は #bbbbbb の 4 箱だけを #ffffff にし、boxesFor(def) は orderedBoxes と同じ。def.boxes は変わらない", () => {
    const before = structuredClone(light.boxes);
    const on = boxesFor(light, new Set(["stream"]));
    expect(count(on, "#ffffff")).toBe(4);
    expect(count(on, "#bbbbbb")).toBe(0);
    expect(count(on, "#555555")).toBe(1);
    expect(boxesFor(light)).toEqual(orderedBoxes(light));
    expect(boxesFor(light, NO_ACTS)).toEqual(orderedBoxes(light));
    expect(boxesFor(light, new Set(["phone"]))).toEqual(orderedBoxes(light));
    expect(light.boxes).toEqual(before);
  });

  it("7: flatRects を引数 1 つで呼ぶと、変更前と同じ結果になる", () => {
    expect(flatRects(light)).toEqual(
      orderedBoxes(light).map(([x, , z, w, , h, c]) => [x, light.h - z - h, w, h, c])
    );
    expect(
      flatRects(light, new Set(["stream"])).filter((r) => r[4] === "#ffffff")
    ).toHaveLength(4);
  });
});
