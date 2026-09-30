import { describe, it, expect } from "vitest";
import { createRng, newGame, step, roomRect, SCENE_H, DAY_MIN, YEAR_DAYS } from "@/sim";
import type { GameState, Season, Weather } from "@/sim";
import { drawScene, createAmbient } from "@/render";
import {
  WINDOW_COLS,
  WINDOW_ROWS,
  drawWindowSeason,
  pickShoveler,
  seasonLook,
  seasonPhase,
  shovelerAt,
  snowCover,
  windowSeasonMarks,
} from "./season";

function fakeCtx() {
  const calls = { fillRect: 0 };
  const gradient = { addColorStop: () => undefined };
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get(_t, prop: string) {
      if (prop === "createRadialGradient") return () => gradient;
      if (prop === "fillRect")
        return () => {
          calls.fillRect++;
        };
      if (
        ["strokeRect", "beginPath", "moveTo", "quadraticCurveTo", "stroke"].includes(prop)
      )
        return () => undefined;
      return target[prop];
    },
    set(t, prop: string, value) {
      t[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const FIRST_DAY_OF: Record<Season, number> = {
  spring: 1,
  tsuyu: 5,
  summer: 8,
  autumn: 12,
  winter: 16,
};

/** 季節 season の day 日目（その季節内のオフセット）・時刻 hour の状態。描画だけに使う */
function at(
  season: Season,
  offset: number,
  hour: number,
  weather: Weather,
  snowDays = season === "winter" && weather === "snow" ? 1 : 0
): GameState {
  const rng = createRng(11);
  const s = newGame(rng);
  const day = FIRST_DAY_OF[season] + offset;
  return { ...s, t: (day - 1) * DAY_MIN + hour * 60, weather, snowDays };
}

describe("render: 季節", () => {
  it("どの季節・天気・時刻でも例外なく描ける", () => {
    const weathers: Weather[] = ["sunny", "cloudy", "rain", "snow"];
    for (const season of Object.keys(FIRST_DAY_OF) as Season[])
      for (const w of weathers)
        for (const hour of [3, 7, 12, 19, 23]) {
          const { ctx, calls } = fakeCtx();
          drawScene(ctx, at(season, 1, hour, w), createAmbient(), 4000, null);
          expect(calls.fillRect).toBeGreaterThan(50);
        }
  });

  it("3 年後の町並み・築 50 年でも描け、状態を書き換えない", () => {
    const rng = createRng(20261001);
    let s = newGame(rng);
    for (let i = 0; i < 3 * YEAR_DAYS * 4; i++) s = step(s, 360, rng);
    const before = JSON.stringify(s);
    drawScene(fakeCtx().ctx, s, createAmbient(), 1234, s.res[0]!.id);
    expect(JSON.stringify(s)).toBe(before);
    expect(SCENE_H).toBeGreaterThan(0);
  });

  it("S1〜S2: 冬の初日でも雪が降っていなければ積雪も雪かき役も無い", () => {
    for (const w of ["sunny", "cloudy", "rain"] as Weather[]) {
      const s = at("winter", 0, 7.5, w, 0);
      expect(snowCover(s)).toBe(0);
      expect(shovelerAt(s)).toBeNull();
    }
  });

  it("冬以外には積雪が無い", () => {
    expect(snowCover(at("spring", 1, 12, "sunny"))).toBe(0);
    expect(snowCover(at("autumn", 2, 12, "cloudy"))).toBe(0);
  });

  it("S3: 冬の初日に雪が降ると積雪があり、雪かき役が朝のあいだ右へ進む", () => {
    const s = at("winter", 0, 7.5, "snow", 1);
    expect(snowCover(s)).toBeGreaterThan(0);
    expect(shovelerAt(s)).not.toBeNull();
    expect(shovelerAt(at("winter", 0, 9, "snow", 1))!.x).toBeGreaterThan(
      shovelerAt(at("winter", 0, 7, "snow", 1))!.x
    );
  });

  it("S4: 冬の 2 日目が晴れでも、前日の雪が残り雪かき役が出る", () => {
    const s = at("winter", 1, 7.5, "sunny", 1);
    expect(snowCover(s)).toBeGreaterThan(0);
    expect(shovelerAt(s)).not.toBeNull();
  });

  it("S5: 雪の日数が多いほど積雪が大きく、どちらも 1 以下", () => {
    const one = snowCover(at("winter", 1, 12, "sunny", 1));
    const two = snowCover(at("winter", 1, 12, "sunny", 2));
    expect(two).toBeGreaterThan(one);
    expect(one).toBeLessThanOrEqual(1);
    expect(two).toBeLessThanOrEqual(1);
  });

  it("雪かきは冬の朝だけ。道の担い手は朝のあいだ右へ進む", () => {
    expect(shovelerAt(at("winter", 1, 7, "snow"))).not.toBeNull();
    expect(shovelerAt(at("winter", 1, 12, "snow"))).toBeNull();
    expect(shovelerAt(at("winter", 1, 3, "snow"))).toBeNull();
    expect(shovelerAt(at("summer", 1, 7, "sunny"))).toBeNull();
    expect(shovelerAt(at("winter", 1, 9, "snow"))!.x).toBeGreaterThan(
      shovelerAt(at("winter", 1, 7, "snow"))!.x
    );
  });

  it("衣替え: 冬と夏で上着の色が変わり、元の見た目は書き換えない", () => {
    const look = { shirt: "#c65b4a" };
    expect(seasonLook(look, "winter").shirt).not.toBe(look.shirt);
    expect(seasonLook(look, "summer").shirt).not.toBe(seasonLook(look, "winter").shirt);
    expect(seasonLook(look, "spring")).toBe(look);
    expect(look.shirt).toBe("#c65b4a");
  });

  it("季節の進み具合は 0〜1 で、季節の最初の朝が 0", () => {
    const p0 = seasonPhase(at("spring", 0, 0, "sunny"));
    expect(p0).toEqual({ season: "spring", p: 0 });
    const p1 = seasonPhase(at("winter", 2, 23, "sunny"));
    expect(p1.season).toBe("winter");
    expect(p1.p).toBeGreaterThan(0.9);
    expect(p1.p).toBeLessThanOrEqual(1);
  });
});

describe("雪かき役は屋外を歩いている住人と重ならない", () => {
  /** fillRect のとき fillStyle が color だった回数を数える偽 Canvas */
  type Rect = { x: number; y: number; w: number; h: number };
  function rectsOf(state: GameState, color: string): Rect[] {
    const rects: Rect[] = [];
    const target: Record<string, unknown> = {};
    const ctx = new Proxy(target, {
      get(_t, prop: string) {
        if (prop === "createRadialGradient")
          return () => ({ addColorStop: () => undefined });
        if (prop === "fillRect")
          return (x: number, y: number, w: number, h: number) => {
            if (target.fillStyle === color) rects.push({ x, y, w, h });
          };
        if (
          ["strokeRect", "beginPath", "moveTo", "quadraticCurveTo", "stroke"].includes(
            prop
          )
        )
          return () => undefined;
        return target[prop];
      },
      set(t, prop: string, value) {
        t[prop] = value;
        return true;
      },
    }) as unknown as CanvasRenderingContext2D;
    drawScene(ctx, state, createAmbient(), 4000, null);
    return rects;
  }
  const countColor = (state: GameState, color: string): number =>
    rectsOf(state, color).length;

  function walkingFirst(base: GameState): GameState {
    const res = base.res.map((r, i) =>
      i === 0
        ? {
            ...r,
            look: { ...r.look, hair: "#123456" },
            at: "walking" as const,
            x: 150,
            y: 182,
          }
        : { ...r, look: { ...r.look, hair: "#654321" } }
    );
    return { ...base, res };
  }

  it("冬の朝に住人 0 番が歩いていても、その人は 1 回だけ描かれる", () => {
    const winter = walkingFirst(at("winter", 1, 7.5, "snow"));
    expect(shovelerAt(winter)).not.toBeNull();
    const summer = walkingFirst(at("summer", 1, 7.5, "sunny"));
    const once = countColor(summer, "#123456");
    expect(once).toBeGreaterThan(0);
    expect(countColor(winter, "#123456")).toBe(once);
  });

  it("全員が歩いているときは雪かき役を出さない（二重に描かない）", () => {
    const base = at("winter", 1, 7.5, "snow");
    const res = base.res.map((r) => ({
      ...r,
      look: { ...r.look, hair: "#123456" },
      at: "walking" as const,
      x: 150,
      y: 182,
    }));
    const all = { ...base, res };
    const summer = { ...all, t: at("summer", 1, 7.5, "sunny").t };
    expect(countColor(all, "#123456")).toBe(countColor(summer, "#123456"));
  });
});

describe("pickShoveler: 雪かき役は家にいる人のうち id が最小の人", () => {
  const base = newGame(createRng(11));
  const withAt = (ats: Array<GameState["res"][number]["at"]>) =>
    base.res.map((r, i) => ({ ...r, at: ats[i] ?? ("out" as const) }));

  it("res[0] が out のときは、在室者のうち id が最小の人を返す", () => {
    const res = withAt(["out", 2, 1, 3]);
    const min = Math.min(res[1]!.id, res[2]!.id, res[3]!.id);
    expect(pickShoveler(res)!.id).toBe(min);
  });

  it("全員 out なら null。shovelerAt は非 null のままで道は描かれる", () => {
    expect(pickShoveler(withAt(["out", "out", "out", "out"]))).toBeNull();
    expect(shovelerAt(at("winter", 0, 7.5, "snow", 1))).not.toBeNull();
  });

  it("walking / out / 在室が混ざっていたら在室者を返す", () => {
    const res = withAt(["walking", "out", 4, "walking"]);
    expect(pickShoveler(res)!.id).toBe(res[2]!.id);
  });
});

describe("雪かき役と部屋の二重描画 (b)", () => {
  type Rect = { x: number; y: number; w: number; h: number };
  function rectsOf(state: GameState, color: string): Rect[] {
    const rects: Rect[] = [];
    const target: Record<string, unknown> = {};
    const ctx = new Proxy(target, {
      get(_t, prop: string) {
        if (prop === "createRadialGradient")
          return () => ({ addColorStop: () => undefined });
        if (prop === "fillRect")
          return (x: number, y: number, w: number, h: number) => {
            if (target.fillStyle === color) rects.push({ x, y, w, h });
          };
        if (
          ["strokeRect", "beginPath", "moveTo", "quadraticCurveTo", "stroke"].includes(
            prop
          )
        )
          return () => undefined;
        return target[prop];
      },
      set(t, prop: string, value) {
        t[prop] = value;
        return true;
      },
    }) as unknown as CanvasRenderingContext2D;
    drawScene(ctx, state, createAmbient(), 4000, null);
    return rects;
  }
  const countColor = (state: GameState, color: string): number =>
    rectsOf(state, color).length;
  const inside = (r: Rect, b: Rect): boolean =>
    r.x >= b.x && r.y >= b.y && r.x + r.w <= b.x + b.w && r.y + r.h <= b.y + b.h;
  const hair = (base: GameState, out: boolean): GameState => ({
    ...base,
    res: base.res.map((r, i) =>
      i === 0
        ? {
            ...r,
            look: { ...r.look, hair: "#123456" },
            ...(out ? { at: "out" as const } : { at: r.room }),
          }
        : { ...r, look: { ...r.look, hair: "#654321" } }
    ),
  });

  it("S9: 雪かき中の住人 0 番は、部屋の中ではなく雪かきの位置に 1 人分だけ描かれる", () => {
    const dry = hair(at("winter", 0, 7.5, "sunny", 0), false);
    const snowy = hair(at("winter", 0, 7.5, "sunny", 1), false);
    const room = roomRect(dry.res[0]!.room);
    const dryRects = rectsOf(dry, "#123456");
    const snowyRects = rectsOf(snowy, "#123456");
    expect(dryRects.length).toBeGreaterThan(0);
    expect(dryRects.every((r) => inside(r, room))).toBe(true);
    expect(snowyRects.length).toBe(dryRects.length);
    expect(snowyRects.every((r) => !inside(r, room))).toBe(true);
  });

  it("全員 out でも雪かきの道（#8f8a82）は 1 件以上描かれる", () => {
    const s = at("winter", 0, 7.5, "snow", 1);
    const allOut = { ...s, res: s.res.map((r) => ({ ...r, at: "out" as const })) };
    expect(pickShoveler(allOut.res)).toBeNull();
    expect(countColor(allOut, "#8f8a82")).toBeGreaterThan(0);
  });

  it("描画: res[0] が out のとき、冬 7:30 の雪の日に #123456 の塗りは 0 回", () => {
    expect(countColor(hair(at("winter", 0, 7.5, "snow", 1), true), "#123456")).toBe(0);
  });

  it("二重描画: 雪かき役に選ばれた住人は、その時刻に部屋の中で描かれない", () => {
    const home = hair(at("winter", 0, 7.5, "snow", 1), false);
    expect(pickShoveler(home.res)!.id).toBe(home.res[0]!.id);
    const once = countColor(hair(at("winter", 0, 7.5, "snow", 0), false), "#123456");
    expect(countColor(home, "#123456")).toBe(once);
  });
});

/** 窓の季節の印を切り出す前の drawWindowSeason の式（比べる元。season.ts の実装は使わない） */
function oldWindowSeason(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  x: number,
  y: number
): void {
  const frac = (i: number): number => (Math.imul(i + 1, 2654435761) >>> 0) / 4294967296;
  const PINK = ["#f4b6c8", "#f9d3de", "#eea0b8"];
  const RED = ["#d9893a", "#c2502f", "#e0b040"];
  const P = (px: number, py: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(px), Math.round(py), w, h);
  };
  const { season, p } = seasonPhase(s);
  const dots = (colors: string[], n: number) => {
    for (let i = 0; i < n; i++)
      P(
        x + 7 + Math.floor(frac(i * 5 + 1) * 17),
        y + 9 + Math.floor(frac(i * 5 + 2) * 11),
        1,
        1,
        colors[i % colors.length]!
      );
  };
  if (season === "spring" && p > 0.25 && p < 0.95) dots(PINK, 5);
  else if (season === "autumn") dots(RED, 4);
  else if (season === "summer") P(x + 19, y + 10, 4, 2, "#ffffff");
  const snow = snowCover(s);
  if (snow > 0)
    P(x + 7, y + 21 - Math.round(snow * 2), 18, Math.round(snow * 2) + 1, "#f4f8ff");
}

/** fillRect の (色, x, y, 幅, 高さ) を呼ばれた順に記録する偽 Canvas */
function rectLog() {
  const log: Array<[string, number, number, number, number]> = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(t, prop: string) {
      if (prop === "fillRect")
        return (x: number, y: number, w: number, h: number) =>
          void log.push([String(t.fillStyle), x, y, w, h]);
      return t[prop];
    },
    set(t, prop: string, value) {
      t[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, log };
}

describe("C6-8: 全体図の窓の季節は、切り出す前の式と同じ fillRect の列を出す", () => {
  const cases: Array<[Season, number, Weather, number]> = [
    ["spring", 0, "sunny", 0],
    ["spring", 1, "rain", 0],
    ["spring", 3, "cloudy", 0],
    ["autumn", 0, "sunny", 0],
    ["autumn", 2, "cloudy", 0],
    ["summer", 1, "sunny", 0],
    ["winter", 1, "snow", 1],
    ["winter", 2, "sunny", 3],
  ];
  it("春・秋・夏・冬のどの状態でも、座標・大きさ・色・順序が一致する", () => {
    for (const [season, offset, weather, snowDays] of cases)
      for (const hour of [8, 12, 20])
        for (const room of [0, 4]) {
          const s = at(season, offset, hour, weather, snowDays);
          const { x, y } = roomRect(room);
          const now = rectLog();
          drawWindowSeason(now.ctx, s, x, y);
          const old = rectLog();
          oldWindowSeason(old.ctx, s, x, y);
          expect(now.log).toEqual(old.log);
        }
  });

  it("比べる状態が空ではない（春・秋・夏・冬のそれぞれで、何かが塗られる状態を含む）", () => {
    const painted = new Set<Season>();
    for (const [season, offset, weather, snowDays] of cases)
      for (const hour of [8, 12, 20]) {
        const old = rectLog();
        oldWindowSeason(old.ctx, at(season, offset, hour, weather, snowDays), 0, 0);
        if (old.log.length > 0) painted.add(season);
      }
    expect([...painted].sort()).toEqual(["autumn", "spring", "summer", "winter"]);
  });
});

describe("追加: 窓の季節の印（格子上の純関数）", () => {
  it("どの印も 18×13 の格子の中の整数座標に収まる", () => {
    for (const [season, offset, weather, snowDays] of [
      ["spring", 1, "sunny", 0],
      ["autumn", 1, "sunny", 0],
      ["summer", 1, "sunny", 0],
      ["winter", 1, "snow", 3],
    ] as Array<[Season, number, Weather, number]>) {
      const marks = windowSeasonMarks(at(season, offset, 12, weather, snowDays));
      expect(marks.length).toBeGreaterThan(0);
      for (const m of marks) {
        for (const v of [m.x, m.y, m.w, m.h]) expect(Number.isInteger(v)).toBe(true);
        expect(m.x).toBeGreaterThanOrEqual(0);
        expect(m.y).toBeGreaterThanOrEqual(0);
        expect(m.x + m.w).toBeLessThanOrEqual(WINDOW_COLS);
        expect(m.y + m.h).toBeLessThanOrEqual(WINDOW_ROWS);
      }
    }
  });

  it("梅雨には印が無い", () => {
    expect(windowSeasonMarks(at("tsuyu", 1, 12, "rain"))).toEqual([]);
  });
});
