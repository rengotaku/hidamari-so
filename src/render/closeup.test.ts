import { describe, it, expect } from "vitest";
import { createRng, newGame, step, type GameState } from "@/sim";
import {
  closeupBubbleAnchor,
  closeupPlacements,
  drawCloseup,
  drawStage,
  lightOf,
  createAmbient,
  type ViewFrame,
} from "@/render";

/** 何を呼んでも例外にならず、fillRect と塗りつぶし（polygon の fill）を数える偽 Canvas */
function countingCtx() {
  const calls = { rects: 0, fills: 0, images: 0 };
  const target: Record<string, unknown> = {};
  const gradient = { addColorStop: () => undefined };
  const ctx = new Proxy(target, {
    get(t, prop: string) {
      if (prop === "createRadialGradient") return () => gradient;
      if (prop === "fillRect") return () => void calls.rects++;
      if (prop === "fill") return () => void calls.fills++;
      if (prop === "drawImage") return () => void calls.images++;
      if (typeof t[prop] === "undefined") return () => undefined;
      return t[prop];
    },
    set(t, prop: string, value) {
      t[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const at = (s: GameState, hour: number): GameState => {
  const c = structuredClone(s);
  c.t = Math.floor(c.t / 1440) * 1440 + hour * 60;
  return c;
};

describe("G5: 大写し中に住人が外出・帰宅する", () => {
  it("G5: 住人が外出すると大写しは空の部屋を映し続け（例外なし）、帰ると部屋に戻ってくる", () => {
    const rng = createRng(4242);
    let s = newGame(rng);
    const watched = s.res[0]!;
    let wentOut = false;
    let cameBack = false;
    for (let i = 0; i < 4 * 24 * 4; i++) {
      s = step(s, 15, rng);
      const r = s.res.find((x) => x.id === watched.id);
      if (!r) break;
      const { ctx } = countingCtx();
      expect(() => drawCloseup(ctx, s, watched.room, i * 250)).not.toThrow();
      const here = closeupPlacements(s, watched.room).some((p) => p.id === r.id);
      if (r.at === "out" || r.at === "walking") {
        wentOut = true;
        expect(here).toBe(false);
      } else if (wentOut && r.at === watched.room) {
        cameBack = true;
        expect(here).toBe(true);
      }
    }
    expect(wentOut).toBe(true);
    expect(cameBack).toBe(true);
  });
});

describe("追加: 外出中も部屋そのものは描かれ続ける", () => {
  it("住人が外出中のコマでも壁・床・装飾が描かれ、住人がいる時より少なく、空室ではない", () => {
    const s = at(newGame(createRng(9)), 12);
    const r = s.res[0]!;
    const room = r.room;
    const total = (x: GameState) => {
      const c = countingCtx();
      drawCloseup(c.ctx, x, room, 0);
      return c.calls.rects + c.calls.fills;
    };
    const home = structuredClone(s);
    home.res.find((x) => x.id === r.id)!.at = room;
    const out = structuredClone(s);
    out.res.find((x) => x.id === r.id)!.at = "out";
    const vacant = structuredClone(s);
    vacant.res = vacant.res.filter((x) => x.room !== room);
    vacant.rooms[room] = null;
    vacant.decor[room] = { items: [], boxes: 0 };
    expect(total(out)).toBeGreaterThan(0);
    expect(total(out)).toBeLessThan(total(home));
    expect(total(out)).toBeGreaterThan(total(vacant));
  });
});

describe("追加: 大写しの描画", () => {
  const base = newGame(createRng(9));

  it("全部屋・全時間帯で例外にならず、何かが描かれる", () => {
    for (let room = 0; room < 6; room++)
      for (let h = 0; h < 24; h += 2) {
        const { ctx, calls } = countingCtx();
        drawCloseup(ctx, at(base, h), room, 1234);
        expect(calls.fills + calls.rects).toBeGreaterThan(20);
      }
  });

  it("空室（誰も住んでいない）も描ける。住人がいると描く量が増える", () => {
    const room = base.res[0]!.room;
    const empty = structuredClone(at(base, 12));
    empty.res = empty.res.filter((r) => r.room !== room);
    empty.rooms[room] = null;
    empty.decor[room] = { items: [], boxes: 0 };
    const a = countingCtx();
    drawCloseup(a.ctx, empty, room, 0);
    const b = countingCtx();
    drawCloseup(b.ctx, at(base, 12), room, 0);
    expect(b.calls.fills + b.calls.rects).toBeGreaterThan(a.calls.fills + a.calls.rects);
  });

  it("装飾を外すと塗る量が減る（装飾は decor.json の 2.5D 定義から描かれる）", () => {
    const s = at(base, 12);
    const room = s.res[0]!.room;
    const bare = structuredClone(s);
    bare.decor[room] = { items: [], boxes: 0 };
    const a = countingCtx();
    drawCloseup(a.ctx, s, room, 0);
    const b = countingCtx();
    drawCloseup(b.ctx, bare, room, 0);
    expect(a.calls.fills).toBeGreaterThan(b.calls.fills);
  });

  it("知らない装飾 id・区画を超える数が入っていても例外にならない", () => {
    const s = structuredClone(at(base, 12));
    const room = s.res[0]!.room;
    s.decor[room] = {
      items: ["no-such", ...Array.from({ length: 12 }, () => "book-tower")],
      boxes: 3,
    };
    const { ctx } = countingCtx();
    expect(() => drawCloseup(ctx, s, room, 0)).not.toThrow();
  });

  it("あかりの状態: 昼・夕方・夜（起きている人がいれば蛍光灯かスタンド、いなければ消灯）", () => {
    const s = at(base, 12);
    const room = s.res[0]!.room;
    expect(lightOf(at(s, 12), room)).toBe("day");
    expect(lightOf(at(s, 17), room)).toBe("dusk");
    const awake = at(s, 23);
    for (const r of awake.res) {
      r.at = r.room;
      r.act = "tv";
    }
    expect(["fluorescent", "lamp"]).toContain(lightOf(awake, room));
    const study = structuredClone(awake);
    study.res.find((r) => r.room === room)!.act = "study";
    expect(lightOf(study, room)).toBe("lamp");
    const asleep = structuredClone(awake);
    for (const r of asleep.res) r.act = "sleep";
    expect(lightOf(asleep, room)).toBe("off");
  });

  it("夜の場面（付き合っている 2 人）の部屋は、大写しでも暗転してハートが出る", () => {
    const s = at(base, 23);
    const [a, b] = [s.res[0]!, s.res[1]!];
    a.at = a.room;
    b.at = a.room;
    b.visiting = true;
    s.bonds = [
      { a: Math.min(a.id, b.id), b: Math.max(a.id, b.id), affinity: 80, stage: "dating" },
    ];
    const plain = structuredClone(s);
    plain.bonds = [];
    const x = countingCtx();
    drawCloseup(x.ctx, s, a.room, 4000);
    const y = countingCtx();
    drawCloseup(y.ctx, plain, a.room, 4000);
    // ハートは 1 ドットずつの矩形なので、場面のある方が矩形が多い
    expect(x.calls.rects).toBeGreaterThan(y.calls.rects);
  });

  it("来客・宴会: 部屋にいる全員が映る", () => {
    const s = at(base, 20);
    const room = s.res[0]!.room;
    for (const r of s.res) {
      r.at = room;
      r.visiting = r.room !== room;
      r.act = "beer";
      r.tx = r.x;
    }
    const ids = closeupPlacements(s, room).map((p) => p.id);
    expect(ids.sort()).toEqual(s.res.map((r) => r.id).sort());
    const pos = closeupPlacements(s, room);
    // 重ならない置き方（同じ位置に 2 人いない）
    const keys = new Set(pos.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`));
    expect(keys.size).toBe(pos.length);
  });

  it("吹き出しの位置: 部屋にいる人には出せて、外出中の人には出せない", () => {
    const s = at(base, 12);
    const r = s.res[0]!;
    r.at = r.room;
    r.act = "tv";
    const p = closeupBubbleAnchor(s, r.room, r);
    expect(p).not.toBeNull();
    expect(p!.x).toBeGreaterThan(0);
    expect(p!.x).toBeLessThan(320);
    expect(p!.y).toBeGreaterThan(0);
    expect(p!.y).toBeLessThan(200);
    r.at = "out";
    expect(closeupBubbleAnchor(s, r.room, r)).toBeNull();
  });
});

describe("追加: 画面の組み立て（drawStage）", () => {
  const s = newGame(createRng(9));
  const frames: ViewFrame[] = [
    { kind: "overview" },
    { kind: "zoom", room: 1, k: 0.5 },
    { kind: "fade", room: 1, k: 0.5 },
    { kind: "closeup", room: 1 },
  ];
  it("どの段階も例外にならない。寄せ・フェードには全体図の下絵（scratch）を使う", () => {
    for (const f of frames) {
      const a = countingCtx();
      const scratch = countingCtx();
      expect(() =>
        drawStage(a.ctx, s, createAmbient(), 500, null, f, {
          canvas: {} as HTMLCanvasElement,
          ctx: scratch.ctx,
        })
      ).not.toThrow();
      if (f.kind === "zoom" || f.kind === "fade")
        expect(a.calls.images).toBeGreaterThan(0);
      if (f.kind === "zoom") expect(scratch.calls.rects).toBeGreaterThan(50);
    }
  });

  it("下絵が作れない環境でも、全体図か大写しを直接描いて落ちない", () => {
    for (const f of frames) {
      const a = countingCtx();
      expect(() =>
        drawStage(a.ctx, s, createAmbient(), 500, null, f, null)
      ).not.toThrow();
      expect(a.calls.rects + a.calls.fills).toBeGreaterThan(0);
    }
  });
});
