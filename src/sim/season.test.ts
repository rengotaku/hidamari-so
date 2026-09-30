import { describe, it, expect } from "vitest";
import {
  createRng,
  drawWeather,
  newGame,
  seasonDay,
  seasonOf,
  SEASONS,
  step,
} from "@/sim";
import type { Season, Weather } from "@/sim";

const ORDER: Season[] = ["spring", "tsuyu", "summer", "autumn", "winter"];

describe("H1: 季節の算出", () => {
  it("ゲーム内 1〜18 日目は 春 → 梅雨 → 夏 → 秋 → 冬 の順に並び、19 日目で春に戻る", () => {
    const seq = Array.from({ length: 18 }, (_, i) => seasonOf(i + 1));
    // 連続する同じ季節をまとめると、春 → 梅雨 → 夏 → 秋 → 冬 の順に 1 回ずつ
    const collapsed = seq.filter((x, i) => i === 0 || x !== seq[i - 1]);
    expect(collapsed).toEqual(ORDER);
    expect(seasonOf(19)).toBe("spring");
    expect(seasonOf(1)).toBe("spring");
    expect(seasonOf(18)).toBe("winter");
  });

  it("追加: 2 年目・3 年目も同じ並びで、どの季節も 3〜5 日続く", () => {
    for (let d = 1; d <= 18; d++) {
      expect(seasonOf(d + 18)).toBe(seasonOf(d));
      expect(seasonOf(d + 36)).toBe(seasonOf(d));
    }
    for (const sn of SEASONS) {
      const n = Array.from({ length: 18 }, (_, i) => seasonOf(i + 1)).filter(
        (x) => x === sn
      ).length;
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(5);
    }
  });

  it("追加: seasonDay は季節の何日目か（0 始まり）と長さを返す", () => {
    const first = seasonDay(1);
    expect(first).toMatchObject({ season: "spring", index: 0 });
    const idx = Array.from({ length: 18 }, (_, i) => seasonDay(i + 1).index);
    // 季節が変わるたびに 0 に戻る
    expect(idx.filter((i) => i === 0).length).toBe(5);
  });
});

function tally(season: Season, n = 1000): Record<Weather, number> {
  const rng = createRng(20261001);
  const out: Record<Weather, number> = { sunny: 0, cloudy: 0, rain: 0, snow: 0 };
  for (let i = 0; i < n; i++) out[drawWeather(rng, season)]++;
  return out;
}

describe("H2: 季節ごとの天気", () => {
  it("梅雨は雨の割合が他のどの季節より高い", () => {
    const rate = Object.fromEntries(SEASONS.map((sn) => [sn, tally(sn).rain / 1000]));
    for (const sn of SEASONS) {
      if (sn === "tsuyu") continue;
      expect(rate.tsuyu!).toBeGreaterThan(rate[sn]!);
    }
  });

  it("雪が出るのは冬だけ", () => {
    for (const sn of SEASONS) {
      const snow = tally(sn).snow;
      if (sn === "winter") expect(snow).toBeGreaterThan(0);
      else expect(snow).toBe(0);
    }
  });

  it("追加: 合計は常に抽選回数と一致し、同じシードなら同じ結果", () => {
    for (const sn of SEASONS) {
      const t = tally(sn);
      expect(t.sunny + t.cloudy + t.rain + t.snow).toBe(1000);
      expect(tally(sn)).toEqual(t);
    }
  });
});

describe("追加: 季節の節目の日誌", () => {
  it("季節が変わる日に 1 行ずつ、その季節の出来事が日誌に出る", () => {
    const rng = createRng(77);
    let s = newGame(rng);
    const seen: string[] = [];
    for (let i = 0; i < 18 * 4; i++) {
      s = step(s, 360, rng);
      for (const e of s.log)
        if (e.kind !== "day" && e.kind !== "town" && e.storyletId.startsWith("season-")) {
          const key = `${e.storyletId}@${Math.floor(e.t / 1440)}`;
          if (!seen.includes(key)) seen.push(key);
        }
    }
    // 1 日目は開始時刻が夕方なので節目にならない。5 日目（梅雨）以降の 4 つと、19 日目の春
    expect(seen.map((k) => k.split("@")[0])).toEqual([
      "season-tsuyu",
      "season-summer",
      "season-autumn",
      "season-winter",
      "season-spring",
    ]);
  });

  it("雪の出来事は冬の雪の日にしか起きない", () => {
    const rng = createRng(78);
    let s = newGame(rng);
    for (let i = 0; i < 36 * 4; i++) {
      s = step(s, 360, rng);
      for (const e of s.log)
        if (
          e.kind !== "day" &&
          e.kind !== "town" &&
          (e.storyletId === "first-snow" || e.storyletId === "snow-shovel")
        )
          expect(seasonOf(Math.floor(e.t / 1440) + 1)).toBe("winter");
    }
  });
});
