import { describe, it, expect } from "vitest";
import { createRng, newGame, step, SCENE_H, DAY_MIN, YEAR_DAYS } from "@/sim";
import type { GameState, Season, Weather } from "@/sim";
import { drawScene, createAmbient } from "@/render";
import { seasonLook, seasonPhase, shovelerAt, snowCover } from "./season";

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
function at(season: Season, offset: number, hour: number, weather: Weather): GameState {
  const rng = createRng(11);
  const s = newGame(rng);
  const day = FIRST_DAY_OF[season] + offset;
  return { ...s, t: (day - 1) * DAY_MIN + hour * 60, weather };
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

  it("冬は積雪があり、他の季節には無い。日を追って増える", () => {
    expect(snowCover(at("spring", 1, 12, "sunny"))).toBe(0);
    expect(snowCover(at("autumn", 2, 12, "cloudy"))).toBe(0);
    const d0 = snowCover(at("winter", 0, 12, "sunny"));
    const d2 = snowCover(at("winter", 2, 12, "sunny"));
    expect(d0).toBeGreaterThan(0);
    expect(d2).toBeGreaterThan(d0);
    expect(d2).toBeLessThanOrEqual(1);
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
