import { describe, it, expect } from "vitest";
import { createRng, newGame, DAY_MIN } from "@/sim";
import type { GameState, Weather } from "@/sim";
import { drawScene, createAmbient } from "@/render";
import { contrailAt, crowsAt, dayRoll, meteorAt, rainbowAt } from "./sights";

type Ev = { kind: "fill"; color: string; y: number } | { kind: "stroke" };

/** fillRect と stroke が呼ばれた順に記録するだけの偽 Canvas */
function recordingCtx() {
  const events: Ev[] = [];
  const target: Record<string, unknown> = {};
  const gradient = { addColorStop: () => undefined };
  const ctx = new Proxy(target, {
    get(t, prop: string) {
      if (prop === "createRadialGradient") return () => gradient;
      if (prop === "fillRect")
        return (_x: number, y: number) =>
          events.push({ kind: "fill", color: String(t.fillStyle), y });
      if (prop === "stroke") return () => events.push({ kind: "stroke" });
      if (["strokeRect", "beginPath", "moveTo", "quadraticCurveTo"].includes(prop))
        return () => undefined;
      return t[prop];
    },
    set(t, prop: string, value) {
      t[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, events };
}

/** day 日目（1 始まり）の hour 時の状態。t と weather だけ上書きする（season.test.ts の at と同じ） */
function at(day: number, hour: number, weather: Weather): GameState {
  const s = newGame(createRng(11));
  return { ...s, t: (day - 1) * DAY_MIN + Math.round(hour * 60), weather };
}

const WEATHERS: Weather[] = ["sunny", "cloudy", "rain", "snow"];
const DAYS_3Y = Array.from({ length: 54 }, (_, i) => i + 1);
const DAYS_20Y = Array.from({ length: 360 }, (_, i) => i + 1);
const halfHours = Array.from({ length: 48 }, (_, i) => i / 2);

const TRAIL = "#fbfcff";
const PLANE = "#eef1f8";
const CROW = "#15131a";
const METEOR = new Set(["#fff6d0", "#ffe9a8"]);
const RAINBOW = new Set([
  "#e0524a",
  "#e8944a",
  "#ecd45a",
  "#6fbf6a",
  "#5a9ad8",
  "#8a6ac0",
]);
const RAIN = "rgba(170,200,235,0.55)";

const count = (events: Ev[], match: (c: string) => boolean): number =>
  events.filter((e) => e.kind === "fill" && match(e.color)).length;

function paint(s: GameState): Ev[] {
  const { ctx, events } = recordingCtx();
  drawScene(ctx, s, createAmbient(), 4000, null);
  return events;
}

/** その日のうち [from, to) 時を step 分刻みで見て、関数が非 null を返す最初の時刻（時）。無ければ null */
function firstShown(
  fn: (s: GameState) => unknown,
  day: number,
  weather: Weather,
  from: number,
  to: number,
  stepMin: number
): number | null {
  for (let m = from * 60; m < to * 60; m += stepMin)
    if (fn(at(day, m / 60, weather)) !== null) return m / 60;
  return null;
}

describe("空の風景: dayRoll", () => {
  it("A1: 同じ引数なら同じ値で、0 以上 1 未満", () => {
    for (let day = 1; day <= 200; day++) {
      const v = dayRoll(day, "contrail");
      expect(dayRoll(day, "contrail")).toBe(v);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(new Set(DAYS_20Y.map((d) => dayRoll(d, "crows"))).size).toBeGreaterThan(300);
    expect(dayRoll(5, "crows")).not.toBe(dayRoll(5, "meteor"));
  });
});

describe("空の風景: 決定的・条件", () => {
  const fns = { contrailAt, crowsAt, meteorAt, rainbowAt };

  it("A1: 同じ GameState で 2 回呼ぶと 4 つとも同じ結果", () => {
    for (const fn of Object.values(fns))
      for (const day of DAYS_3Y)
        for (const w of WEATHERS)
          for (const h of halfHours) {
            const s = at(day, h, w);
            expect(fn(s)).toEqual(fn(s));
          }
  });

  it("A2: 表1の天気と時刻の外では、どの日でも null", () => {
    const rules: Array<
      [string, (s: GameState) => unknown, Weather[], (h: number) => boolean]
    > = [
      ["contrail", contrailAt, ["sunny"], (h) => h >= 10 && h < 15],
      ["crows", crowsAt, ["sunny", "cloudy"], (h) => h >= 16.5 && h < 18],
      ["meteor", meteorAt, ["sunny"], (h) => h >= 21 || h < 4],
      ["rainbow", rainbowAt, ["rain"], (h) => h >= 16 && h < 17.5],
    ];
    for (const [name, fn, weathers, inHours] of rules)
      for (const day of DAYS_3Y)
        for (const w of WEATHERS)
          for (const h of halfHours)
            if (!weathers.includes(w) || !inHours(h))
              expect(fn(at(day, h, w)), `${name} day${day} ${w} ${h}h`).toBeNull();
  });

  it("A3: 条件を満たす日のうち、出る日の割合が仕様の範囲に入り、1 日以上ある", () => {
    const share = (hit: (day: number) => boolean): number =>
      DAYS_20Y.filter(hit).length / DAYS_20Y.length;
    const any =
      (
        fn: (s: GameState) => unknown,
        w: Weather,
        from: number,
        to: number,
        step: number
      ) =>
      (day: number) =>
        firstShown(fn, day, w, from, to, step) !== null;
    const contrail = share(any(contrailAt, "sunny", 10, 15, 10));
    const crowsSunny = share(any(crowsAt, "sunny", 16.5, 18, 5));
    const crowsCloudy = share(any(crowsAt, "cloudy", 16.5, 18, 5));
    const meteor = share(any(meteorAt, "sunny", 21, 28, 1));
    const rainbow = share(any(rainbowAt, "rain", 16, 17.5, 10));
    expect(contrail).toBeGreaterThanOrEqual(0.35);
    expect(contrail).toBeLessThanOrEqual(0.65);
    for (const crows of [crowsSunny, crowsCloudy]) {
      expect(crows).toBeGreaterThanOrEqual(0.45);
      expect(crows).toBeLessThanOrEqual(0.75);
    }
    expect(meteor).toBeGreaterThanOrEqual(0.35);
    expect(meteor).toBeLessThanOrEqual(0.65);
    expect(rainbow).toBeGreaterThanOrEqual(0.15);
    expect(rainbow).toBeLessThanOrEqual(0.45);
  });
});

describe("空の風景: 進み方", () => {
  const length = (c: NonNullable<ReturnType<typeof contrailAt>>): number =>
    Math.abs(c.x1 - c.x0);

  it("A4: 飛行機雲は伸びたあと、機影が出て、薄くなって消える", () => {
    const day = DAYS_20Y.find(
      (d) => firstShown(contrailAt, d, "sunny", 10, 15, 1) !== null
    )!;
    const t0 = firstShown(contrailAt, day, "sunny", 10, 15, 1)!;
    const early = contrailAt(at(day, t0, "sunny"))!;
    const later = contrailAt(at(day, t0 + 10 / 60, "sunny"))!;
    expect(length(later)).toBeGreaterThan(length(early));
    expect(later.planeX).not.toBeNull();

    // 機影が出たあとの時刻を 5 分刻みで集める
    const after = Array.from({ length: 24 }, (_, i) => t0 + (i * 5) / 60)
      .map((h) => contrailAt(at(day, h, "sunny")))
      .filter((c) => c !== null && c.planeX === null);
    expect(after.length).toBeGreaterThan(3);
    for (let i = 1; i < after.length; i++)
      expect(after[i]!.alpha).toBeLessThan(after[i - 1]!.alpha);
    expect(contrailAt(at(day, t0 + 70 / 60, "sunny"))).toBeNull();
  });

  it("A5: 流れ星は出る夜に 2〜3 回、1 回は 2 分ほど", () => {
    let nights = 0;
    for (const day of DAYS_20Y) {
      const shown = Array.from(
        { length: 420 },
        (_, m) => meteorAt(at(day, 21 + m / 60, "sunny")) !== null
      );
      if (!shown.some(Boolean)) continue;
      nights++;
      const runs: number[] = [];
      shown.forEach((on, m) => {
        if (!on) return;
        if (m > 0 && shown[m - 1]) runs[runs.length - 1]!++;
        else runs.push(1);
      });
      expect(runs.length, `day${day}`).toBeGreaterThanOrEqual(2);
      expect(runs.length, `day${day}`).toBeLessThanOrEqual(3);
      for (const r of runs) {
        expect(r).toBeGreaterThanOrEqual(2);
        expect(r).toBeLessThanOrEqual(3);
      }
    }
    expect(nights).toBeGreaterThan(0);
  });

  it("前夜が晴れで出る夜と決まっていても、0:00〜4:00 に雨なら流れ星は出ない", () => {
    // 前夜（day）に出る夜で、翌日（day + 1）の 1:00〜4:00 に晴れなら出る時刻を持つ日
    const hours = Array.from({ length: 60 }, (_, i) => 24 + i / 20);
    const day = DAYS_20Y.find((d) =>
      hours.some((h) => meteorAt(at(d, h, "sunny")) !== null)
    )!;
    const h = hours.find((x) => meteorAt(at(day, x, "sunny")) !== null)!;
    expect(meteorAt(at(day, h, "sunny"))).not.toBeNull();
    expect(meteorAt(at(day, h, "rain"))).toBeNull();
    expect(meteorAt(at(day, 25, "rain"))).toBeNull();
  });
});

describe("空の風景: 描画", () => {
  it("A6: 虹が出ている時刻は雨粒を描かず、同じ日の 15:30 には描く（天気は変えない）", () => {
    const day = DAYS_20Y.find(
      (d) => firstShown(rainbowAt, d, "rain", 16, 17.5, 10) !== null
    )!;
    const s = at(day, 16.75, "rain");
    expect(rainbowAt(s)).not.toBeNull();
    expect(count(paint(s), (c) => c === RAIN)).toBe(0);
    expect(s.weather).toBe("rain");
    expect(count(paint(at(day, 15.5, "rain")), (c) => c === RAIN)).toBeGreaterThanOrEqual(
      1
    );
  });

  it("A6': 虹の出ない雨の日は、16:30 でも雨粒を描く", () => {
    const day = DAYS_20Y.find(
      (d) => firstShown(rainbowAt, d, "rain", 16, 17.5, 10) === null
    )!;
    expect(count(paint(at(day, 16.5, "rain")), (c) => c === RAIN)).toBeGreaterThanOrEqual(
      1
    );
  });

  it("A7: 飛行機雲は出ている時刻に描かれ、出ていない時刻では描かれない", () => {
    const day = DAYS_20Y.find(
      (d) => firstShown(contrailAt, d, "sunny", 10, 15, 10) !== null
    )!;
    const t0 = firstShown(contrailAt, day, "sunny", 10, 15, 1)!;
    const on = paint(at(day, t0 + 15 / 60, "sunny"));
    expect(count(on, (c) => c === TRAIL)).toBeGreaterThanOrEqual(1);
    expect(count(on, (c) => c === PLANE)).toBeGreaterThanOrEqual(1);
    const off = paint(at(day, 9, "sunny"));
    expect(count(off, (c) => c === TRAIL || c === PLANE)).toBe(0);
  });

  it("A7: カラスは出ている時刻に描かれ、出ていない時刻では描かれない", () => {
    const day = DAYS_20Y.find(
      (d) => firstShown(crowsAt, d, "sunny", 16.5, 18, 5) !== null
    )!;
    const t0 = firstShown(crowsAt, day, "sunny", 16.5, 18, 1)!;
    const s = at(day, t0 + 10 / 60, "sunny");
    const flock = crowsAt(s)!;
    expect(flock.crows.length).toBeGreaterThanOrEqual(5);
    expect(flock.crows.length).toBeLessThanOrEqual(7);
    expect(count(paint(s), (c) => c === CROW)).toBeGreaterThanOrEqual(1);
    expect(count(paint(at(day, 12, "sunny")), (c) => c === CROW)).toBe(0);
  });

  it("A7: 流れ星は出ている時刻に描かれ、出ていない時刻では描かれない", () => {
    const day = DAYS_20Y.find(
      (d) => firstShown(meteorAt, d, "sunny", 21, 28, 1) !== null
    )!;
    const t0 = firstShown(meteorAt, day, "sunny", 21, 28, 1)!;
    expect(
      count(paint(at(day, t0 + 1 / 60, "sunny")), (c) => METEOR.has(c))
    ).toBeGreaterThanOrEqual(1);
    expect(count(paint(at(day, 12, "sunny")), (c) => METEOR.has(c))).toBe(0);
  });

  it("A7: 虹は出ている時刻に描かれ、出ていない時刻では描かれない", () => {
    const day = DAYS_20Y.find(
      (d) => firstShown(rainbowAt, d, "rain", 16, 17.5, 10) !== null
    )!;
    const shown = Array.from({ length: 90 }, (_, m) => 16 + m / 60).find(
      (h) => (rainbowAt(at(day, h, "rain"))?.arc ?? 0) > 0.5
    )!;
    expect(
      count(paint(at(day, shown, "rain")), (c) => RAINBOW.has(c))
    ).toBeGreaterThanOrEqual(1);
    expect(count(paint(at(day, 15.5, "rain")), (c) => RAINBOW.has(c))).toBe(0);
  });

  it("A8: 飛行機雲の塗りは、電線の stroke より前に呼ばれる", () => {
    const day = DAYS_20Y.find(
      (d) => firstShown(contrailAt, d, "sunny", 10, 15, 10) !== null
    )!;
    const t0 = firstShown(contrailAt, day, "sunny", 10, 15, 1)!;
    const events = paint(at(day, t0 + 15 / 60, "sunny"));
    const firstStroke = events.findIndex((e) => e.kind === "stroke");
    expect(firstStroke).toBeGreaterThanOrEqual(0);
    const trailIdx = events.flatMap((e, i) =>
      e.kind === "fill" && e.color === TRAIL ? [i] : []
    );
    expect(trailIdx.length).toBeGreaterThanOrEqual(1);
    for (const i of trailIdx) expect(i).toBeLessThan(firstStroke);
  });
});

describe("空の風景: 飛行機雲の高さ", () => {
  it("飛行機雲が出ている間は、線・機影の塗りの y がすべて 18 未満（電線より上）", () => {
    const day = DAYS_20Y.find(
      (d) => firstShown(contrailAt, d, "sunny", 10, 15, 10) !== null
    )!;
    const t0 = firstShown(contrailAt, day, "sunny", 10, 15, 1)!;
    let checked = 0;
    for (let m = 0; m < 60; m++) {
      const s = at(day, t0 + m / 60, "sunny");
      if (!contrailAt(s)) continue;
      const fills = paint(s).flatMap((e) =>
        e.kind === "fill" && (e.color === TRAIL || e.color === PLANE) ? [e.y] : []
      );
      expect(fills.length).toBeGreaterThanOrEqual(1);
      for (const y of fills) expect(y).toBeLessThan(18);
      checked++;
    }
    expect(checked).toBeGreaterThan(30);
  });
});
