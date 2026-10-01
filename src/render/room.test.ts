import { describe, expect, it } from "vitest";
import { createRng, newGame, roomRect, type GameState } from "@/sim";
import { defaultContent } from "@/content";
import { drawRoom } from "./room";

interface Fill {
  style: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** fillRect を、そのときの fillStyle と矩形つきで呼ばれた順に記録する偽 Canvas */
function fakeCtx() {
  const fills: Fill[] = [];
  let style = "";
  const ctx = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "fillStyle") return style;
        if (prop === "fillRect")
          return (x: number, y: number, w: number, h: number) =>
            fills.push({ style, x, y, w, h });
        if (prop === "createRadialGradient" || prop === "createLinearGradient")
          return () => ({ addColorStop: () => undefined });
        return () => undefined;
      },
      set(_t, prop, v) {
        if (prop === "fillStyle") style = v as string;
        return true;
      },
    }
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, fills };
}

const overlaps = (a: Fill, b: { x: number; y: number; w: number; h: number }): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe("全体図の部屋の重なり順", () => {
  it("ちゃぶ台の位置にいる住人は、ちゃぶ台より手前に描かれる", () => {
    const base = newGame(createRng(7), defaultContent);
    const i = base.rooms.findIndex((id) => id !== null);
    const ownerId = base.rooms[i]!;
    const { x, y } = roomRect(i);
    // ちゃぶ台（天板 x+31〜x+45）の真ん中に座らせる
    const s: GameState = {
      ...base,
      res: base.res.map((r) =>
        r.id === ownerId ? { ...r, x: x + 38, tx: x + 38, act: "ramen" } : r
      ),
    };
    const owner = s.res.find((r) => r.id === ownerId)!;
    const { ctx, fills } = fakeCtx();
    drawRoom(ctx, s, i, 0, "#9fd0f0", true);

    const table = { x: x + 31, y: y + 33, w: 15, h: 6 };
    const tableIdx = fills.findLastIndex(
      (f) => f.style === "#7b4f2e" && overlaps(f, table)
    );
    const skinIdx = fills.findLastIndex(
      (f) => f.style === owner.look.skin && overlaps(f, table)
    );
    expect(tableIdx).toBeGreaterThanOrEqual(0);
    expect(skinIdx).toBeGreaterThanOrEqual(0);
    expect(skinIdx).toBeGreaterThan(tableIdx);
  });
});
