import { SEASON_IDS, type SeasonId } from "@/content/schema";
import { YEAR_DAYS } from "./clock";
import { weighted, type Rng } from "./random";
import type { Weather } from "./types";

export type Season = SeasonId;
export const SEASONS = SEASON_IDS;

/** 各季節の日数（春 → 梅雨 → 夏 → 秋 → 冬）。合計が 1 年（YEAR_DAYS） */
const SPANS: Record<Season, number> = {
  spring: 4,
  tsuyu: 3,
  summer: 4,
  autumn: 4,
  winter: 3,
};

export interface SeasonDay {
  season: Season;
  /** 季節の何日目か（0 始まり。0 なら季節の最初の日） */
  index: number;
  /** その季節の日数 */
  length: number;
}

/** ゲーム内 day 日目（1 始まり）の季節。18 日で一巡する */
export function seasonDay(day: number): SeasonDay {
  let d = (((Math.floor(day) - 1) % YEAR_DAYS) + YEAR_DAYS) % YEAR_DAYS;
  for (const season of SEASONS) {
    if (d < SPANS[season]) return { season, index: d, length: SPANS[season] };
    d -= SPANS[season];
  }
  return { season: "winter", index: 0, length: SPANS.winter };
}

export const seasonOf = (day: number): Season => seasonDay(day).season;

/** 季節ごとの天気の出やすさ（重み）。雪は冬だけ、雨は梅雨に偏る */
const ODDS: Record<Season, Partial<Record<Weather, number>>> = {
  spring: { sunny: 0.5, cloudy: 0.3, rain: 0.2 },
  tsuyu: { sunny: 0.1, cloudy: 0.3, rain: 0.6 },
  summer: { sunny: 0.65, cloudy: 0.2, rain: 0.15 },
  autumn: { sunny: 0.45, cloudy: 0.35, rain: 0.2 },
  winter: { sunny: 0.4, cloudy: 0.3, rain: 0.05, snow: 0.25 },
};

export const drawWeather = (rng: Rng, season: Season): Weather =>
  weighted(rng, ODDS[season], "sunny");
