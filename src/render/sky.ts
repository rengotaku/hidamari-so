import { dayOf, hourOf, seasonOf, type GameState } from "@/sim";
import { mix } from "./palette";
import { seasonSky } from "./season";

const SKY: Array<[number, string]> = [
  [0, "#141a33"],
  [4.5, "#1b2146"],
  [5.5, "#5a4a78"],
  [6.3, "#e59a72"],
  [7.5, "#9cc7e8"],
  [15.5, "#8fc2ea"],
  [17, "#e9b27a"],
  [18, "#c7667a"],
  [19, "#3a3563"],
  [20.5, "#171c3a"],
  [24, "#141a33"],
];

export function skyAt(h: number): string {
  for (let i = 0; i < SKY.length - 1; i++) {
    const a = SKY[i]!;
    const b = SKY[i + 1]!;
    if (h >= a[0] && h <= b[0]) return mix(a[1], b[1], (h - a[0]) / (b[0] - a[0]));
  }
  return SKY[0]![1];
}

/** 0 = 昼、1 = 夜 */
export function nightness(h: number): number {
  if (h >= 7 && h < 16.5) return 0;
  if (h >= 16.5 && h < 20) return (h - 16.5) / 3.5;
  if (h >= 20 || h < 4.5) return 1;
  return 1 - (h - 4.5) / 2.5;
}

export function currentSky(s: GameState): string {
  const sky = seasonSky(skyAt(hourOf(s.t)), seasonOf(dayOf(s.t)));
  if (s.weather === "cloudy") return mix(sky, "#8a8f98", 0.35);
  if (s.weather === "rain") return mix(sky, "#5a6068", 0.5);
  if (s.weather === "snow") return mix(sky, "#aeb6c2", 0.45);
  return sky;
}
