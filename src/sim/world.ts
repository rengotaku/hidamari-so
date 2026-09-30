import { isAwake, isHome, log, pickRes, say, type Ctx } from "./context";
import { JOBS } from "./data";
import { roomNo } from "./layout";
import { chance, clamp, kanji, pick, randi } from "./random";
import { updateRes } from "./behavior";
import type { Resident } from "./types";

const RENT = 28000;
/** 仕送り・年金の日（3 日ごとの 10 時） */
const isAllowanceDay = (h: number, d: number): boolean => h === 10 && d % 3 === 2;

const leaking = (c: Ctx, r: Resident): boolean =>
  c.s.weather === "rain" && r.room >= 3 && isHome(r);

function allowanceDay(c: Ctx): void {
  for (const r of c.s.res) {
    r.money += JOBS[r.job].allowance ?? 0;
    r.money = Math.max(0, r.money - RENT);
  }
}

function onDay(c: Ctx, d: number): void {
  const { s } = c;
  s.weather = chance(c.rng, 0.25) ? "rain" : chance(c.rng, 0.35) ? "cloudy" : "sunny";
  log(c, `── ${d}日目 ──`, "day");
  if (s.weather === "rain" && s.res.some((r) => r.room >= 3))
    log(c, "雨。二階の住人がバケツを並べはじめた");
  for (const r of s.res) {
    if (!r.bathed) r.mood -= 4;
    r.bathed = false;
  }
}

/** 日常の小さな出来事。条件に合わない候補は引き直す */
function ambient(c: Ctx, h: number): void {
  const { s, rng } = c;
  const events: Array<() => boolean> = [
    () => {
      const r = pickRes(c, (x) => x.at === "out");
      if (!r) return false;
      log(c, `${r.sei}さん宛の不在票が、また増えた`);
      return true;
    },
    () => {
      if (!(h >= 6 && h < 10)) return false;
      const old = pickRes(c, (x) => !!JOBS[x.job].old && isHome(x));
      const sus = pickRes(c, (x) => !JOBS[x.job].old);
      if (!sus) return false;
      log(
        c,
        `燃えないゴミが火曜に出ていた。${old ? `${old.sei}さんが犯人を捜している（たぶん${sus.sei}さん）` : `たぶん${sus.sei}さん`}`
      );
      if (old) say(c, old, "誰だ、これ出したのは");
      return true;
    },
    () => {
      const r = pickRes(c, () => true);
      if (!r) return false;
      log(c, `回覧板が${r.sei}さんの部屋で${kanji(randi(rng, 3, 9))}日止まっている`);
      return true;
    },
    () => {
      if (s.weather !== "rain") return false;
      const r = pickRes(c, (x) => isHome(x) && isAwake(x));
      if (!r) return false;
      say(c, r, "あっ、洗濯物！");
      r.mood -= 8;
      log(
        c,
        `${r.sei}さん、雨に気づいたのは洗濯物を干して${kanji(randi(rng, 2, 5))}時間後（コインランドリーは駅の向こう）`
      );
      return true;
    },
    () => {
      const r = pickRes(c, (x) => x.job === "ronin" || x.job === "student");
      if (!r) return false;
      r.money += 5000;
      r.hunger = Math.max(0, r.hunger - 20);
      log(c, `${r.sei}さんに実家から段ボール。米と手紙。手紙は読まずに米だけ出した`);
      return true;
    },
    () => {
      const r = pickRes(c, () => true);
      if (!r) return false;
      log(
        c,
        `${r.sei}さんから旅行のお土産をもらった。${pick(rng, ["謎のキーホルダー", "ご当地ペナント", "賞味期限が明日の饅頭", "「根性」と彫られた木刀"])}`
      );
      return true;
    },
    () => {
      const a = pickRes(c, (x) => isHome(x) && isAwake(x));
      const b = a && pickRes(c, (x) => x !== a && isHome(x) && isAwake(x));
      if (!a || !b) return false;
      a.mood += 6;
      b.mood += 6;
      log(
        c,
        `${a.sei}さんと${b.sei}さん、ゴミ捨て場で${kanji(randi(rng, 5, 40))}分立ち話していた`
      );
      return true;
    },
    () => {
      if (!(h >= 23 || h < 4)) return false;
      const r = pickRes(c, (x) => isHome(x) && isAwake(x));
      if (!r) return false;
      say(c, r, "（ズルズル…）");
      r.hunger = Math.max(0, r.hunger - 30);
      log(c, `${roomNo(r.room)}の換気扇から、深夜のカップ麺の匂い`);
      return true;
    },
  ];
  for (let k = 0; k < 4; k++) if (pick(rng, events)()) return;
}

function onHour(c: Ctx, hAbs: number): void {
  const h = hAbs % 24;
  const d = Math.floor(hAbs / 24) + 1;
  if (h === 0) onDay(c, d);
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
  if (chance(c.rng, 0.16)) ambient(c, h);
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
  for (const r of s.res.slice()) updateRes(c, r, dt);
  if (s.pending.length > 0) {
    const due = s.pending.filter((p) => s.t >= p.at);
    s.pending = s.pending.filter((p) => s.t < p.at);
    for (const p of due) {
      const r = s.res.find((x) => x.id === p.id);
      if (r) say(c, r, p.text);
    }
  }
}
