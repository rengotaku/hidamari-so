import { dayOf } from "./clock";
import { archOf, isHome, pushLog, say, type Ctx } from "./context";
import { chance, clamp } from "./random";
import { updateRes } from "./behavior";
import { drawWeather, seasonDay } from "./season";
import { AMBIENT_CHANCE, fireTrigger, processBooked } from "./storylets";
import { advanceTown } from "./town";
import type { Resident } from "./types";

const RENT = 28000;
/** 仕送り・年金の日（3 日ごとの 10 時） */
const isAllowanceDay = (h: number, d: number): boolean => h === 10 && d % 3 === 2;

const leaking = (c: Ctx, r: Resident): boolean =>
  c.s.weather === "rain" && r.room >= 3 && isHome(r);

function allowanceDay(c: Ctx): void {
  for (const r of c.s.res) {
    r.money += archOf(c, r).allowance ?? 0;
    r.money = Math.max(0, r.money - RENT);
  }
}

function onDay(c: Ctx): void {
  const { s } = c;
  const sd = seasonDay(dayOf(s.t));
  s.weather = drawWeather(c.rng, sd.season);
  pushLog(c, { t: s.t, kind: "day" });
  advanceTown(c);
  if (sd.index === 0) fireTrigger(c, "season-start");
  fireTrigger(c, "day-start");
  for (const r of s.res) {
    if (!r.bathed) r.mood -= 4;
    r.bathed = false;
  }
}

function onHour(c: Ctx, hAbs: number): void {
  const h = hAbs % 24;
  const d = Math.floor(hAbs / 24) + 1;
  if (h === 0) onDay(c);
  if (isAllowanceDay(h, d)) allowanceDay(c);
  for (const r of c.s.res) {
    if (isHome(r))
      r.clutter = clamp(r.clutter + (r.traits.includes("katazuke") ? 1.3 : 0.4), 0, 100);
    r.mood = clamp(r.mood + (50 - r.mood) * 0.06 - (r.hunger > 85 ? 3 : 0), 0, 100);
    const target = clamp(50 + (r.mood - 50) * 0.25, 0, 100);
    r.comfort = clamp(
      r.comfort + (target - r.comfort) * 0.05 - (leaking(c, r) ? 1.2 : 0),
      0,
      100
    );
  }
  processBooked(c);
  if (chance(c.rng, AMBIENT_CHANCE)) fireTrigger(c, "hour");
}

/** dt（ゲーム内分）だけ進める。1 回の dt は 2 分以下にすること */
export function update(c: Ctx, dt: number): void {
  const { s } = c;
  s.t += dt;
  const hAbs = Math.floor(s.t / 60);
  while (s.lastHour < hAbs) {
    s.lastHour++;
    onHour(c, s.lastHour);
  }
  for (const r of s.res.slice()) if (s.res.includes(r)) updateRes(c, r, dt);
  if (s.pending.length > 0) {
    const due = s.pending.filter((p) => s.t >= p.at);
    s.pending = s.pending.filter((p) => s.t < p.at);
    for (const p of due) {
      const r = s.res.find((x) => x.id === p.id);
      if (r) say(c, r, p.text);
    }
  }
}
