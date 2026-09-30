import { hourOf, dayOf, inWin, minutesUntilHour } from "./clock";
import { hasTrait, isAwake, isHome, log, pickRes, say, type Ctx } from "./context";
import {
  ACTS,
  GIFTS,
  JOBS,
  LEAVE_LINES,
  RETURN_LINES,
  VISITS,
  type ShiftDef,
} from "./data";
import { exitPath, neighbors, roomNo, roomRect, type Point } from "./layout";
import { chance, clamp, kanji, pick, randi, weighted } from "./random";
import type { ActId, HobbyId, OutPurpose, Resident } from "./types";

const ROOM_OF = (r: Resident): number => (typeof r.at === "number" ? r.at : r.room);

/** いま勤務時間にあたるシフト（無ければ null）。日をまたぐ夜勤は始まった日で数える */
export function workNow(c: Ctx, r: Resident): ShiftDef | null {
  const h = hourOf(c.s.t);
  const d = dayOf(c.s.t);
  for (const sh of JOBS[r.job].shifts) {
    const dd = sh.s > sh.e && h < sh.e ? d - 1 : d;
    if (sh.d(dd) && inWin(h, sh.s, sh.e)) return sh;
  }
  return null;
}

/* ---------- 行動の開始と終了 ---------- */

export function startAct(
  c: Ctx,
  r: Resident,
  key: Exclude<ActId, "leave" | "return" | "out">,
  dur?: number
): void {
  const a = ACTS[key];
  r.act = key;
  r.lastAct = key;
  const d = a.dur ?? [20, 60];
  r.until = c.s.t + (dur ?? randi(c.rng, d[0], d[1]));
  const rr = roomRect(ROOM_OF(r));
  if (a.pose === "lie") {
    r.x = rr.x + 6;
    r.tx = r.x;
  } else if (a.pose === "sit") r.tx = rr.x + randi(c.rng, 29, 48);
  else if (key === "cook" || key === "nimono") r.tx = rr.x + randi(c.rng, 52, 57);
  else if (key === "plants") r.tx = rr.x + randi(c.rng, 12, 20);
  else r.tx = rr.x + randi(c.rng, 12, 56);
  if (key === "beer") r.beers += 1;
  if (a.eat) {
    r.hunger = Math.max(0, r.hunger - a.eat[0]);
    r.money = Math.max(0, r.money - a.eat[1]);
  }
  if (a.lines && chance(c.rng, 0.55)) say(c, r, pick(c.rng, a.lines));
}

function startSleep(c: Ctx, r: Resident): void {
  r.beers = 0;
  const wake =
    minutesUntilHour(c.s.t, JOBS[r.job].sleep[1]) +
    (hasTrait(r, "nebou") ? randi(c.rng, 0, 40) : 0);
  startAct(c, r, "sleep", wake);
  if (chance(c.rng, 0.3)) say(c, r, "おやすみ（誰に言うでもなく）");
}

function startEat(c: Ctx, r: Resident): void {
  let k: "ramen" | "bento" | "cook" | "nimono" | "moyashi" = JOBS[r.job].eat;
  if (hasTrait(r, "jisui") && chance(c.rng, 0.5)) k = "cook";
  if (hasTrait(r, "mie") && k !== "nimono") k = "bento";
  if (r.money < 1500) k = "moyashi";
  if (k === "bento" && r.money < 600) k = "ramen";
  startAct(c, r, k);
}

function hobbyPick(c: Ctx, r: Resident): HobbyId {
  const h = hourOf(c.s.t);
  const w: Partial<Record<HobbyId, number>> = { ...JOBS[r.job].hobbies };
  w.stare = (w.stare ?? 0) + 1;
  w.nap = (w.nap ?? 0) + 0.5;
  const evening = h >= 17 || h < 4;
  if (!evening) delete w.beer;
  else if (hasTrait(r, "sake")) w.beer = (w.beer ?? 1) * 3;
  if (hasTrait(r, "mikka") && !r.quitGym) w.workout = 1.5;
  return weighted(c.rng, w, "stare");
}

export function chooseAct(c: Ctx, r: Resident): void {
  if (r.visiting) {
    goHome(c, r);
    return;
  }
  const j = JOBS[r.job];
  const h = hourOf(c.s.t);
  if (inWin(h, j.sleep[0], j.sleep[1])) return startSleep(c, r);
  if (r.sleepy > 88) return startAct(c, r, "nap");
  if (r.hunger > 62) return startEat(c, r);
  if (r.lastAct === "beer" && hasTrait(r, "sake")) {
    if (r.beers >= 2 && chance(c.rng, 0.45)) return startAct(c, r, "drunk");
    if (chance(c.rng, 0.55)) return startAct(c, r, "beer");
  }
  if (!r.bathed && h >= 18 && h < 23.5 && chance(c.rng, 0.3)) {
    startLeave(
      c,
      r,
      "sento",
      pick(c.rng, ["銭湯行ってこよ", "（洗面器を抱えて出発）", "閉まる前に行かないと"]),
      { dur: randi(c.rng, 30, 50) }
    );
    return;
  }
  if (chance(c.rng, hasTrait(r, "samishi") ? 0.16 : 0.04) && startVisit(c, r)) return;
  if (r.money > 700 && chance(c.rng, h >= 21 || h < 3 ? 0.08 : 0.03)) {
    startLeave(
      c,
      r,
      "konbini",
      pick(c.rng, ["ちょっとコンビニ", "（サンダルで出かける）", "アイス買ってこよ"]),
      { dur: randi(c.rng, 10, 25) }
    );
    return;
  }
  if (r.clutter > 70 && chance(c.rng, 0.12)) return startAct(c, r, "clean");
  startAct(c, r, hobbyPick(c, r));
}

function endAct(c: Ctx, r: Resident): void {
  const k = r.act;
  const p = (q: number): boolean => chance(c.rng, q);
  if (k === "clean") {
    r.clutter = 0;
    r.mood += 10;
    log(c, `${r.sei}さんが掃除をした。ゴミ袋${kanji(randi(c.rng, 3, 9))}個`);
  } else if (k === "workout") {
    r.gym++;
    if (hasTrait(r, "mikka") && r.gym >= 3 && !r.quitGym) {
      r.quitGym = true;
      log(
        c,
        `${r.sei}さん、筋トレ${kanji(r.gym)}日目で「明日から本気出す」宣言。ダンベルは物干しになった`
      );
    }
  } else if (k === "drunk") {
    r.beers = 0;
    if (p(0.5))
      log(
        c,
        `${r.sei}さん、酔って廊下で${pick(c.rng, ["一曲歌った", "月に向かって何か叫んだ", "自分の部屋の番号を忘れた", "大家の悪口を言ったあと謝った"])}`,
        "noise"
      );
  } else if (k === "stream" && p(0.3))
    log(
      c,
      `${r.sei}さんの配信、同時視聴者数${kanji(randi(c.rng, 0, 3))}人（うち一人は本人のスマホ）`
    );
  else if (k === "draw" && p(0.25))
    log(
      c,
      `${r.sei}さん、原稿を${kanji(randi(c.rng, 1, 3))}ページ描いて${kanji(randi(c.rng, 4, 9))}ページ消した`
    );
  else if (k === "study" && p(0.25))
    log(c, `${r.sei}さん、参考書の同じページを${kanji(randi(c.rng, 3, 12))}回開いた`);
  else if (k === "cook" && p(0.4))
    log(
      c,
      `${roomNo(r.room)}から焦げた匂い。${pick(c.rng, ["本人いわく「香ばしい」", "火災報知器が鳴る寸前だった", "料理名は「炒め物だったもの」"])}`
    );
  else if (k === "keiba" && p(0.2))
    log(
      c,
      `${r.sei}さん、競馬新聞に赤丸を${kanji(randi(c.rng, 8, 20))}個つけた（全部の馬）`
    );
  else if (k === "guitar" && p(0.2))
    log(
      c,
      `${r.sei}さん、新曲「${pick(c.rng, ["四畳半ブルース", "家賃", "カップ麺の三分", "ひだまり"])}」を作曲。コードは三つ`
    );
}

/* ---------- 訪問と騒音 ---------- */

export function goHome(c: Ctx, v: Resident): void {
  v.visiting = false;
  v.at = v.room;
  const rr = roomRect(v.room);
  v.x = rr.x + 62;
  v.tx = v.x;
  startAct(c, v, "idle");
}

function evictVisitors(c: Ctx, room: number, owner: Resident): void {
  for (const v of c.s.res) if (v !== owner && v.at === room && v.visiting) goHome(c, v);
}

function startVisit(c: Ctx, a: Resident): boolean {
  const { s } = c;
  const b = pickRes(
    c,
    (r) =>
      r !== a &&
      isHome(r) &&
      r.at === r.room &&
      !r.visiting &&
      isAwake(r) &&
      r.act !== "host" &&
      !s.res.some((v) => v !== r && v.at === r.room)
  );
  if (!b) return false;
  const noisyRecently = b.noisy !== null && s.t - b.noisy < 1440;
  const V = pick(
    c.rng,
    VISITS.filter((v) => !v.when || v.when(noisyRecently))
  );
  const dur = randi(c.rng, 20, 60);
  const rr = roomRect(b.room);
  a.visiting = true;
  a.at = b.room;
  a.x = rr.x + 62;
  startAct(c, a, "visit", dur);
  a.tx = rr.x + randi(c.rng, 44, 52);
  startAct(c, b, "host", dur);
  b.tx = rr.x + randi(c.rng, 30, 36);
  say(c, a, V.a);
  s.pending.push({ id: b.id, text: V.b, at: s.t + 3 });
  let text = V.text(a.sei, b.sei);
  if (V.kind === "vent") {
    a.mood += 6;
    b.mood -= 3;
  } else if (V.kind === "loan") {
    if (b.money > 1000 && chance(c.rng, 0.6)) {
      b.money -= 1000;
      a.money += 1000;
      text = `${a.sei}さんが${b.sei}さんに小銭を借りた。${b.sei}さんは結局貸した`;
    } else text = `${a.sei}さんが${b.sei}さんに小銭を借りに行って断られた`;
  } else if (V.kind === "gift") {
    text = `${a.sei}さんが${b.sei}さんに${pick(c.rng, GIFTS)}をお裾分け`;
    b.hunger = Math.max(0, b.hunger - 30);
    b.mood += 8;
    a.mood += 4;
  }
  log(c, text);
  return true;
}

function noiseEvent(c: Ctx, r: Resident): void {
  const { s } = c;
  r.noisy = s.t;
  for (const n of neighbors(ROOM_OF(r))) {
    const id = s.rooms[n];
    const nb =
      id === null || id === undefined ? undefined : s.res.find((x) => x.id === id);
    if (!nb || nb.at !== n) continue;
    if (nb.act === "sleep") {
      say(c, nb, "（壁ドン）");
      nb.comfort -= 3;
      nb.mood -= 4;
      const hr = Math.floor(s.t / 60);
      if (s.noiseHour !== hr) {
        s.noiseHour = hr;
        const label = r.act in ACTS ? ACTS[r.act as keyof typeof ACTS].label : "物音";
        log(c, `${r.sei}さんの${label}で、${nb.sei}さんが壁ドン`, "noise");
      }
      if (chance(c.rng, 0.5))
        s.pending.push({ id: r.id, text: "…すみません", at: s.t + 2 });
    } else if (chance(c.rng, 0.5)) {
      say(c, nb, pick(c.rng, ["うるさいな…", "…またか", "（イヤホンをつける）"]));
      nb.comfort -= 1;
    }
  }
}

/* ---------- 外出と帰宅 ---------- */

export function startLeave(
  c: Ctx,
  r: Resident,
  purpose: OutPurpose,
  line: string,
  o: { dur?: number; hurry?: boolean; shift?: ShiftDef } = {}
): void {
  if (r.at === r.room) evictVisitors(c, r.room, r);
  r.visiting = false;
  r.act = "leave";
  r.at = "walking";
  r.walkMode = "leave";
  r.path = exitPath(r.room);
  r.pi = 0;
  r.x = r.path[0]![0];
  r.y = r.path[0]![1];
  r.outPurpose = purpose;
  r.outDur = o.dur ?? 20;
  r.hurry = !!o.hurry;
  r.shift = o.shift ? { label: o.shift.label, pay: o.shift.pay } : null;
  say(c, r, line);
}

export function startReturn(r: Resident): void {
  r.at = "walking";
  r.walkMode = "return";
  r.act = "return";
  r.path = exitPath(r.room).slice().reverse();
  r.pi = 0;
  r.x = r.path[0]![0];
  r.y = r.path[0]![1];
}

/** 経路に沿って speed * dt だけ進める。終点に着いたら true */
export function stepPath(
  o: { path: Point[]; pi: number; x: number; y: number; dir: 1 | -1 },
  dt: number,
  speed: number
): boolean {
  let left = speed * dt;
  while (left > 0 && o.pi < o.path.length) {
    const p = o.path[o.pi]!;
    const dx = p[0] - o.x;
    const dy = p[1] - o.y;
    const d = Math.hypot(dx, dy);
    if (d <= left) {
      o.x = p[0];
      o.y = p[1];
      left -= d;
      o.pi++;
    } else {
      o.x += (dx / d) * left;
      o.y += (dy / d) * left;
      if (Math.abs(dx) > 0.01) o.dir = dx < 0 ? -1 : 1;
      left = 0;
    }
  }
  return o.pi >= o.path.length;
}

function arrive(c: Ctx, r: Resident): void {
  r.hurry = false;
  if (r.walkMode === "leave") {
    r.at = "out";
    r.act = "out";
    if (r.outPurpose !== "work") r.outUntil = c.s.t + r.outDur;
    return;
  }
  r.at = r.room;
  const rr = roomRect(r.room);
  r.x = rr.x + 64;
  r.tx = r.x;
  const p = r.outPurpose;
  if (p === "work" && r.shift) {
    if (r.shift.pay === "gamble") {
      const g = randi(c.rng, -10, 22) * 1000;
      r.money = Math.max(0, r.money + g);
      if (g >= 10000) {
        say(c, r, "今日は勝った！！");
        log(c, `${r.sei}さん、パチンコで大勝ちした。寿司の出前を取っていた`);
      } else if (g <= -5000) {
        say(c, r, "…");
        log(c, `${r.sei}さん、パチンコで大負けした。帰りの足取りが重い`);
        r.mood -= 10;
      } else say(c, r, "まあ、トントンだな");
    } else {
      r.money += r.shift.pay;
      say(c, r, pick(c.rng, RETURN_LINES));
      if (r.job === "salaryman") r.mood -= 4;
    }
  } else if (p === "konbini") {
    r.hunger = Math.max(0, r.hunger - 45);
    r.money = Math.max(0, r.money - 700);
    r.clutter = clamp(r.clutter + 6, 0, 100);
    say(
      c,
      r,
      pick(c.rng, [
        "ついでにプリンも買った",
        "（レジ袋ガサガサ）",
        "新作のスナック出てた",
      ])
    );
  } else if (p === "sento") {
    r.bathed = true;
    r.money = Math.max(0, r.money - 550);
    r.mood += 8;
    say(
      c,
      r,
      pick(c.rng, ["いい湯だった", "コーヒー牛乳は正義", "番台のおばちゃん元気だった"])
    );
  }
  chooseAct(c, r);
}

/* ---------- 1 人ぶんの更新 ---------- */

export function updateRes(c: Ctx, r: Resident, dt: number): void {
  const { s } = c;
  const asleep = r.act === "sleep" || r.act === "nap";
  r.sleepy = clamp(r.sleepy + (asleep ? -0.3 : 0.065) * dt, 0, 100);
  r.hunger = clamp(r.hunger + 0.07 * dt, 0, 100);
  if (r.at === "walking") {
    if (stepPath(r, dt, r.hurry ? 13 : 6)) arrive(c, r);
    return;
  }
  if (r.at === "out") {
    const sh = workNow(c, r);
    const back =
      r.outPurpose === "work"
        ? !sh || !r.shift || sh.label !== r.shift.label
        : s.t >= r.outUntil;
    if (back) startReturn(r);
    return;
  }
  const sh = workNow(c, r);
  if (sh) {
    if (r.act === "sleep" && !r.lateChecked) {
      r.lateChecked = true;
      if (hasTrait(r, "nebou") && chance(c.rng, 0.4)) {
        r.late = true;
        r.until = s.t + randi(c.rng, 30, 100);
        say(c, r, "…（目覚ましを止める）");
      }
    }
    const over = r.act === "sleep" && r.late && s.t < r.until;
    if (!over) {
      const late = r.late;
      r.late = false;
      if (late)
        log(
          c,
          `${r.sei}さん、${sh.label}に寝坊。${pick(c.rng, ["寝ぐせのまま階段を駆け下りた", "靴を片方しか履いていなかった", "パンをくわえて走っていった"])}`
        );
      startLeave(c, r, "work", late ? "遅刻だーーっ！" : pick(c.rng, LEAVE_LINES), {
        shift: sh,
        hurry: late,
      });
      return;
    }
  } else r.lateChecked = false;
  if (!asleep) {
    const d = r.tx - r.x;
    if (Math.abs(d) > 0.3) {
      r.x += Math.sign(d) * Math.min(Math.abs(d), 4 * dt);
      r.dir = d < 0 ? -1 : 1;
    }
  }
  const a = r.act in ACTS ? ACTS[r.act as keyof typeof ACTS] : undefined;
  const bubbleOn = r.bubble !== null && r.bubble.until > s.t;
  if (
    a?.lines &&
    !bubbleOn &&
    chance(c.rng, (hasTrait(r, "hitorigoto") ? 0.03 : 0.014) * dt)
  )
    say(c, r, pick(c.rng, a.lines));
  if (a?.noise && chance(c.rng, 0.012 * a.noise * dt)) noiseEvent(c, r);
  if (s.t >= r.until) {
    endAct(c, r);
    if (isHome(r)) chooseAct(c, r);
  }
}
