import { describe, it, expect } from "vitest";
import {
  DAY_MIN,
  createRng,
  newGame,
  step,
  type GameState,
  type Season,
  type Weather,
} from "@/sim";
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

describe("#36: 大写しの行動中の色替え", () => {
  it("9: stream の方が #ffffff が 4 多く、#bbbbbb が 4 少ない（phone と比べる）", () => {
    const fillsWith = (act: "stream" | "phone") => {
      const s = at(newGame(createRng(9)), 12);
      const room = s.res[0]!.room;
      const r = s.res[0]!;
      r.at = room;
      r.act = act;
      s.decor[room] = { items: ["streaming-set"], boxes: 0 };
      const fills: string[] = [];
      let style = "";
      const target: Record<string, unknown> = {};
      const ctx = new Proxy(target, {
        get(t, prop: string) {
          if (prop === "createRadialGradient")
            return () => ({ addColorStop: () => undefined });
          if (prop === "fill") return () => fills.push(style);
          if (prop === "fillRect") return () => fills.push(style);
          if (typeof t[prop] === "undefined") return () => undefined;
          return t[prop];
        },
        set(t, prop: string, value) {
          t[prop] = value;
          if (prop === "fillStyle") style = String(value);
          return true;
        },
      }) as unknown as CanvasRenderingContext2D;
      drawCloseup(ctx, s, room, 0);
      return fills;
    };
    const n = (f: string[], c: string) => f.filter((x) => x === c).length;
    const stream = fillsWith("stream");
    const phone = fillsWith("phone");
    expect(n(stream, "#ffffff") - n(phone, "#ffffff")).toBe(4);
    expect(n(phone, "#bbbbbb") - n(stream, "#bbbbbb")).toBe(4);
  });
});

/** 塗りを (色, 頂点の列) で呼ばれた順に記録する偽 Canvas。polygon の fill も fillRect も拾う */
function fillLog() {
  type Fill = { color: string; pts: Array<[number, number]> };
  const log: Fill[] = [];
  let path: Array<[number, number]> = [];
  const state: Record<string, unknown> = {};
  const gradient = { addColorStop: () => undefined };
  const ctx = new Proxy(state, {
    get(t, prop: string) {
      if (prop === "createRadialGradient") return () => gradient;
      if (prop === "beginPath") return () => void (path = []);
      if (prop === "moveTo" || prop === "lineTo")
        return (x: number, y: number) => void path.push([x, y]);
      if (prop === "fill")
        return () => void log.push({ color: String(t.fillStyle), pts: path });
      if (prop === "fillRect")
        return (x: number, y: number, w: number, h: number) =>
          void log.push({
            color: String(t.fillStyle),
            pts: [
              [x, y],
              [x + w, y + h],
            ],
          });
      if (typeof t[prop] === "undefined") return () => undefined;
      return t[prop];
    },
    set(t, prop: string, value) {
      t[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, log };
}

const RAIN = "rgba(170,200,235,0.8)";
const PETALS = ["#f4b6c8", "#f9d3de", "#eea0b8"];
const SNOW_COVER = "#f4f8ff";
const FLAKE = "#ffffff";
/** 窓の外の範囲（奥の壁の 0.095〜0.345 × 床からの高さ 0.41〜0.81 を、画面の座標にしたもの） */
const WIN = {
  x0: 72 + 176 * 0.095,
  x1: 72 + 176 * 0.345,
  y0: 112 - 96 * 0.81,
  y1: 112 - 96 * 0.41,
};

const FIRST_DAY: Record<Season, number> = {
  spring: 1,
  tsuyu: 5,
  summer: 8,
  autumn: 12,
  winter: 16,
};

/** 季節 season の offset 日目・正午の状態。雪の日数は snowDays で固定する */
function inSeason(
  season: Season,
  offset: number,
  weather: Weather,
  snowDays = 0
): GameState {
  const s = newGame(createRng(9));
  return {
    ...s,
    t: (FIRST_DAY[season] + offset - 1) * DAY_MIN + 12 * 60,
    weather,
    snowDays,
  };
}

/** 部屋を空室にして、窓の外の季節と天気以外に同じ色の塗りが混ざらないようにする */
function vacantRoom(s: GameState, room: number): GameState {
  const c = structuredClone(s);
  c.res = c.res.filter((r) => r.room !== room);
  c.rooms[room] = null;
  c.vacancies = [];
  c.decor[room] = { items: [], boxes: 0 };
  return c;
}

const fillsOf = (s: GameState, room: number, now: number, colors: string[]) => {
  const { ctx, log } = fillLog();
  drawCloseup(ctx, s, room, now);
  return log.filter((f) => colors.includes(f.color));
};

describe("C6: 大写しの窓の外（季節と天気）", () => {
  const room = newGame(createRng(9)).res[0]!.room;

  it("C6-1: 雨の日は雨の塗りが 1 件以上あり、曇りの日は 0 件", () => {
    const rain = vacantRoom(inSeason("summer", 1, "rain"), room);
    const cloudy = vacantRoom(inSeason("summer", 1, "cloudy"), room);
    expect(fillsOf(rain, room, 0, [RAIN]).length).toBeGreaterThanOrEqual(1);
    expect(fillsOf(cloudy, room, 0, [RAIN]).length).toBe(0);
  });

  it("C6-2: now=0 と now=500 で雨の頂点の並びが違う（雨が動く）", () => {
    const s = vacantRoom(inSeason("summer", 1, "rain"), room);
    const a = fillsOf(s, room, 0, [RAIN]).map((f) => f.pts);
    const b = fillsOf(s, room, 500, [RAIN]).map((f) => f.pts);
    expect(a.length).toBeGreaterThan(0);
    expect(b).not.toEqual(a);
  });

  it("C6-3: 春（進み具合 0.25〜0.95）には花びらの色の塗りがあり、夏には無い", () => {
    const spring = vacantRoom(inSeason("spring", 1, "sunny"), room);
    const summer = vacantRoom(inSeason("summer", 1, "sunny"), room);
    expect(fillsOf(spring, room, 0, PETALS).length).toBeGreaterThanOrEqual(1);
    expect(fillsOf(summer, room, 0, PETALS).length).toBe(0);
  });

  it("C6-4: 冬で積雪があれば窓枠の雪の塗りがあり、春には無い", () => {
    const winter = vacantRoom(inSeason("winter", 1, "sunny", 2), room);
    const spring = vacantRoom(inSeason("spring", 1, "sunny"), room);
    expect(fillsOf(winter, room, 0, [SNOW_COVER]).length).toBeGreaterThanOrEqual(1);
    expect(fillsOf(spring, room, 0, [SNOW_COVER]).length).toBe(0);
  });

  it("C6-5: 雪の日は雪の粒（白）の塗りが 1 件以上ある", () => {
    const snow = vacantRoom(inSeason("winter", 1, "snow", 2), room);
    expect(fillsOf(snow, room, 0, [FLAKE]).length).toBeGreaterThanOrEqual(1);
  });

  it("C6-6: 季節と天気の塗りの頂点は、すべて窓の範囲（誤差 1px）に収まる", () => {
    const states: Array<[GameState, string[]]> = [
      [inSeason("summer", 1, "rain"), [RAIN]],
      [inSeason("spring", 1, "sunny"), PETALS],
      [inSeason("autumn", 1, "sunny"), ["#d9893a", "#c2502f", "#e0b040"]],
      [inSeason("winter", 1, "snow", 3), [SNOW_COVER, FLAKE]],
    ];
    for (const [s, colors] of states)
      for (const now of [0, 500, 1777, 9000]) {
        const fills = fillsOf(vacantRoom(s, room), room, now, colors);
        expect(fills.length).toBeGreaterThan(0);
        for (const f of fills)
          for (const [x, y] of f.pts) {
            expect(x).toBeGreaterThanOrEqual(WIN.x0 - 1);
            expect(x).toBeLessThanOrEqual(WIN.x1 + 1);
            expect(y).toBeGreaterThanOrEqual(WIN.y0 - 1);
            expect(y).toBeLessThanOrEqual(WIN.y1 + 1);
          }
      }
  });

  it("C6-7: 空室の貼り紙も、住人のいる部屋のカーテンも、雨の塗りより後に描かれる", () => {
    const rain = inSeason("summer", 1, "rain");
    const inWindow = (f: { pts: Array<[number, number]> }) =>
      f.pts.every(
        ([x, y]) =>
          x >= WIN.x0 - 1 && x <= WIN.x1 + 1 && y >= WIN.y0 - 1 && y <= WIN.y1 + 1
      );

    const vacant = fillLog();
    drawCloseup(vacant.ctx, vacantRoom(rain, room), room, 0);
    const lastRain = vacant.log.map((f) => f.color).lastIndexOf(RAIN);
    const poster = vacant.log.findIndex((f) => f.color === "#f4f0e4" && inWindow(f));
    expect(lastRain).toBeGreaterThanOrEqual(0);
    expect(poster).toBeGreaterThan(lastRain);

    const home = structuredClone(rain);
    const owner = home.res.find((r) => r.id === home.rooms[room])!;
    const lived = fillLog();
    drawCloseup(lived.ctx, home, room, 0);
    const lastRain2 = lived.log.map((f) => f.color).lastIndexOf(RAIN);
    const curtain = lived.log.findIndex(
      (f) => f.color === owner.look.curtain && inWindow(f)
    );
    expect(lastRain2).toBeGreaterThanOrEqual(0);
    expect(curtain).toBeGreaterThan(lastRain2);
  });
});
