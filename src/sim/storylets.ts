import { PLACEHOLDER } from "@/content/schema";
import type {
  ActId,
  Content,
  Effect,
  RoleCond,
  Storylet,
  Trigger,
} from "@/content/schema";
import { dayOf, hourOf, inWin } from "./clock";
import { archOf, getRes, isAwake, pushLog, say, type Ctx } from "./context";
import { roomNo, roomRect } from "./layout";
import { chance, clamp, kanji, randi, type Rng } from "./random";
import { seasonOf } from "./season";
import type { Bond, LogEntry, Resident, RoleRef, Variant } from "./types";

/**
 * 出来事エンジン。何が・いつ・誰に起きるかは content/ の storylet（JSON）が決め、ここは
 * 「条件に合うものを重み付きで選ぶ → 日誌に構造のまま残す → 結果を適用する」だけを担う。
 * 出来事の本文はコードに置かない（表示時に composeEntry が JSON から組み立てる）。
 */

type Role = "a" | "b";
export type Bindings = Partial<Record<Role, Resident>>;

export interface TriggerOpts {
  /** trigger が act-end のときの行動 */
  act?: ActId;
  /** 呼び出し側がすでに決めている役割（a=本人など） */
  fixed?: Bindings;
  /** 本文の {act} {shift} に入る値 */
  vals?: Record<string, string>;
}

/** 1 時間ごとの抽選で、その時間に「日常の出来事」が 1 件起きる確率 */
export const AMBIENT_CHANCE = 0.16;
/** 人生の筋の入口が予約される、入居からの日数の幅（分） */
const ARC_DELAY: [number, number] = [2 * 1440, 6 * 1440];
/** 予約した出来事の条件が合わないとき、1 時間ずつ先送りする回数の上限 */
const MAX_BOOK_TRIES = 72;
export const DEFAULT_AFFINITY = 30;

const STAT_RANGE = {
  mood: [0, 100],
  money: [0, Number.POSITIVE_INFINITY],
  hunger: [0, 100],
  sleepy: [0, 100],
  comfort: [0, 100],
  clutter: [0, 100],
} as const;

/* ---------- 関係（仲の良さ・恋の段階） ---------- */

export function bondOf(bonds: readonly Bond[], x: number, y: number): Bond | undefined {
  const [a, b] = x < y ? [x, y] : [y, x];
  return bonds.find((k) => k.a === a && k.b === b);
}

function ensureBond(c: Ctx, x: number, y: number): Bond {
  const found = bondOf(c.s.bonds, x, y);
  if (found) return found;
  const [a, b] = x < y ? [x, y] : [y, x];
  const bond: Bond = { a, b, affinity: DEFAULT_AFFINITY, stage: "none" };
  c.s.bonds.push(bond);
  return bond;
}

/* ---------- 条件 ---------- */

const inRange = (v: number, r?: { min?: number; max?: number }): boolean =>
  !r || ((r.min === undefined || v >= r.min) && (r.max === undefined || v <= r.max));

function roleOk(c: Ctx, r: Resident, cond: RoleCond | undefined, a?: Resident): boolean {
  if (!cond) return true;
  const { s } = c;
  const tags = archOf(c, r).tags;
  if (cond.archetype && !cond.archetype.includes(r.job)) return false;
  if (cond.notArchetype?.includes(r.job)) return false;
  if (cond.tag && !cond.tag.some((t) => tags.includes(t))) return false;
  if (cond.notTag?.some((t) => tags.includes(t))) return false;
  if (cond.trait && !cond.trait.some((t) => r.traits.includes(t))) return false;
  if (cond.notTrait?.some((t) => r.traits.includes(t))) return false;
  if (cond.floor !== undefined && (r.room < 3 ? 1 : 2) !== cond.floor) return false;
  if (cond.inRoom !== undefined && (r.at === r.room) !== cond.inRoom) return false;
  if (cond.awake !== undefined && isAwake(r) !== cond.awake) return false;
  if (cond.out !== undefined && (r.at === "out") !== cond.out) return false;
  if (cond.noisy !== undefined) {
    const recently = r.noisy !== null && s.t - r.noisy < 1440;
    if (recently !== cond.noisy) return false;
  }
  if (!inRange((s.t - r.since) / 1440, cond.stayDays)) return false;
  if (!inRange(r.money, cond.money)) return false;
  if (a && (cond.affinity || cond.romance)) {
    const bond = bondOf(s.bonds, a.id, r.id);
    if (!inRange(bond?.affinity ?? DEFAULT_AFFINITY, cond.affinity)) return false;
    if (cond.romance && !cond.romance.includes(bond?.stage ?? "none")) return false;
  }
  return true;
}

/** 時間帯・天気・再発の間隔・1 回きり */
function storyOk(c: Ctx, st: Storylet): boolean {
  const { s } = c;
  if (st.once && s.story.done.includes(st.id)) return false;
  const last = Object.hasOwn(s.story.last, st.id) ? s.story.last[st.id] : undefined;
  if (
    last !== undefined &&
    st.cooldownDays !== undefined &&
    s.t - last < st.cooldownDays * 1440
  )
    return false;
  if (st.when.hours && !inWin(hourOf(s.t), st.when.hours[0], st.when.hours[1]))
    return false;
  if (st.when.weather && !st.when.weather.includes(s.weather)) return false;
  if (st.when.season && !st.when.season.includes(seasonOf(dayOf(s.t)))) return false;
  return true;
}

/** 役割の割り当てのうち、条件を満たす組をすべて返す（fixed の役割はその住人に固定） */
function bindingsFor(c: Ctx, st: Storylet, fixed: Bindings = {}): Bindings[] {
  const res = c.s.res;
  const aList: (Resident | undefined)[] = st.roles.a
    ? fixed.a
      ? [fixed.a]
      : res
    : [undefined];
  const bList: (Resident | undefined)[] = st.roles.b
    ? fixed.b
      ? [fixed.b]
      : res
    : [undefined];
  const out: Bindings[] = [];
  for (const a of aList) {
    if (a && !roleOk(c, a, st.roles.a)) continue;
    for (const b of bList) {
      if (b && (b === a || !roleOk(c, b, st.roles.b, a))) continue;
      const one: Bindings = {};
      if (a) one.a = a;
      if (b) one.b = b;
      out.push(one);
    }
  }
  return out;
}

function weightedIndex(rng: Rng, weights: readonly number[]): number {
  let x = rng.next() * weights.reduce((sum, w) => sum + w, 0);
  for (let i = 0; i < weights.length; i++) {
    x -= weights[i]!;
    if (x <= 0) return i;
  }
  return weights.length - 1;
}

/* ---------- 本文 ---------- */

function drawVariant(rng: Rng, st: Storylet, vals: Record<string, string>): Variant {
  const slots: Record<string, number | string> = {};
  for (const [k, [lo, hi]] of Object.entries(st.numbers ?? {}))
    slots[k] = randi(rng, lo, hi);
  for (const [k, list] of Object.entries(st.choices ?? {}))
    slots[k] = Math.floor(rng.next() * list.length);
  for (const [k, v] of Object.entries(vals)) slots[k] = v;
  return { text: Math.floor(rng.next() * st.texts.length), slots };
}

const indexCache = new WeakMap<Content, Map<string, Storylet>>();

export function storyletById(content: Content, id: string): Storylet | undefined {
  let index = indexCache.get(content);
  if (!index) {
    index = new Map(content.storylets.map((s) => [s.id, s]));
    indexCache.set(content, index);
  }
  return index.get(id);
}

/** 日誌の 1 行の本文を組み立てる。日付の見出し・定義が見つからない行は null */
export function composeEntry(content: Content, e: LogEntry): string | null {
  if (e.kind === "day") return null;
  if (e.kind === "town")
    return content.town.find((t) => t.id === e.changeId)?.stages[e.stage]?.log ?? null;
  const st = storyletById(content, e.storyletId);
  if (!st) return null;
  const template = st.texts[e.variant.text] ?? st.texts[0]!;
  return template.replace(PLACEHOLDER, (_m, name: string) => {
    if (name === "a" || name === "b") return e.roles[name]?.sei ?? "";
    if (name === "room") return e.roles.a ? String(roomNo(e.roles.a.room)) : "";
    const slot = e.variant.slots[name];
    // 定義の後から足された差し込みなど、slots に値が無いときは定義から決定的に補う
    const range =
      st.numbers && Object.hasOwn(st.numbers, name) ? st.numbers[name] : undefined;
    if (range)
      return kanji(typeof slot === "number" && Number.isFinite(slot) ? slot : range[0]);
    const list =
      st.choices && Object.hasOwn(st.choices, name) ? st.choices[name] : undefined;
    if (list) return (typeof slot === "number" ? list[slot] : undefined) ?? list[0]!;
    return typeof slot === "string" ? slot : "";
  });
}

/* ---------- 起こす ---------- */

function refOf(r: Resident): RoleRef {
  return { id: r.id, sei: r.sei, room: r.room };
}

/** 出来事を 1 件起こす: 日誌に構造のまま残し、結果を適用する */
function fire(
  c: Ctx,
  st: Storylet,
  b: Bindings,
  vals: Record<string, string> = {}
): void {
  const { s, rng } = c;
  const roles: Partial<Record<Role, RoleRef>> = {};
  if (b.a) roles.a = refOf(b.a);
  if (b.b) roles.b = refOf(b.b);
  pushLog(c, {
    t: s.t,
    kind: st.logKind ?? "",
    storyletId: st.id,
    roles,
    variant: drawVariant(rng, st, vals),
  });
  s.story.last[st.id] = s.t;
  if (st.once && !s.story.done.includes(st.id)) s.story.done.push(st.id);
  // 途中で退去した住人には、以降の効果を適用しない
  const gone = new Set<Resident>();
  for (const e of st.effects) {
    const involved =
      "role" in e
        ? [b[e.role]]
        : e.type === "bond" || e.type === "romance"
          ? [b.a, b.b]
          : [];
    if (involved.some((r) => r && gone.has(r))) continue;
    if (e.type === "moveOut" && b[e.role]) gone.add(b[e.role]!);
    applyEffect(c, e, b);
  }
}

function applyEffect(c: Ctx, e: Effect, b: Bindings): void {
  const { s, rng } = c;
  switch (e.type) {
    case "adjust": {
      const r = b[e.role];
      if (!r) return;
      const [lo, hi] = STAT_RANGE[e.stat];
      r[e.stat] = clamp(r[e.stat] + e.delta, lo, hi);
      return;
    }
    case "bond": {
      if (!b.a || !b.b) return;
      const bond = ensureBond(c, b.a.id, b.b.id);
      bond.affinity = clamp(bond.affinity + e.delta, 0, 100);
      return;
    }
    case "romance": {
      if (!b.a || !b.b) return;
      ensureBond(c, b.a.id, b.b.id).stage = e.stage;
      return;
    }
    case "say": {
      const r = b[e.role];
      if (!r) return;
      if (e.afterMinutes)
        s.pending.push({ id: r.id, text: e.text, at: s.t + e.afterMinutes });
      else say(c, r, e.text);
      return;
    }
    case "book": {
      const next =
        e.next[
          weightedIndex(
            rng,
            e.next.map((n) => n.weight ?? 1)
          )
        ]!;
      const roles: Partial<Record<Role, number>> = {};
      if (b.a) roles.a = b.a.id;
      if (b.b) roles.b = b.b.id;
      s.booked.push({
        id: next.id,
        at: s.t + randi(rng, e.afterMinutes[0], e.afterMinutes[1]),
        roles,
        tries: 0,
      });
      return;
    }
    case "moveOut": {
      const r = b[e.role];
      if (r) moveOut(c, r);
      return;
    }
    case "changeJob": {
      const r = b[e.role];
      if (!r || !Object.hasOwn(c.content.archetypes, e.archetype)) return;
      r.job = e.archetype;
      bookArc(c, r);
      return;
    }
  }
}

/** 住人が出ていく。訪問中の客は自室へ帰し、関係と予約は片付ける */
function moveOut(c: Ctx, r: Resident): void {
  const { s } = c;
  for (const v of s.res) {
    if (v === r || !v.visiting || v.at !== r.room) continue;
    v.visiting = false;
    v.at = v.room;
    v.act = "idle";
    v.until = s.t;
    v.x = roomRect(v.room).x + 62;
    v.tx = v.x;
  }
  s.res = s.res.filter((x) => x !== r);
  if (s.rooms[r.room] === r.id) s.rooms[r.room] = null;
  s.bonds = s.bonds.filter((k) => k.a !== r.id && k.b !== r.id);
  s.pending = s.pending.filter((p) => p.id !== r.id);
}

/* ---------- 選ぶ ---------- */

/** trigger に合い、条件を満たす出来事を重み付きで 1 件選ぶ */
function pickStorylet(
  c: Ctx,
  trigger: Trigger,
  opts: TriggerOpts
): { st: Storylet; roles: Bindings } | null {
  const options: { st: Storylet; bs: Bindings[] }[] = [];
  for (const st of c.content.storylets) {
    if (st.trigger !== trigger) continue;
    if (trigger === "act-end" && st.act !== opts.act) continue;
    if (!storyOk(c, st)) continue;
    const bs = bindingsFor(c, st, opts.fixed);
    if (bs.length > 0) options.push({ st, bs });
  }
  if (options.length === 0) return null;
  const picked =
    options[
      weightedIndex(
        c.rng,
        options.map((o) => o.st.weight)
      )
    ]!;
  return {
    st: picked.st,
    roles: picked.bs[Math.floor(c.rng.next() * picked.bs.length)]!,
  };
}

/** trigger に合う出来事を選んで起こす（chance に外れたら何も起きない）。起きたら true */
export function fireTrigger(c: Ctx, trigger: Trigger, opts: TriggerOpts = {}): boolean {
  const picked = pickStorylet(c, trigger, opts);
  if (!picked) return false;
  if (picked.st.chance < 1 && !chance(c.rng, picked.st.chance)) return false;
  fire(c, picked.st, picked.roles, opts.vals);
  return true;
}

/** id を指定して起こす（新規ゲームの最初の 1 件など）。条件を満たさなければ false */
export function fireStorylet(c: Ctx, id: string, fixed: Bindings = {}): boolean {
  const st = storyletById(c.content, id);
  if (!st || !storyOk(c, st)) return false;
  const bs = bindingsFor(c, st, fixed);
  if (bs.length === 0) return false;
  fire(c, st, bs[Math.floor(c.rng.next() * bs.length)]!);
  return true;
}

/* ---------- 予約 ---------- */

/** 住人の種類がもつ「人生の筋」の入口を、しばらく先に予約する */
export function bookArc(c: Ctx, r: Resident): void {
  const id = archOf(c, r).arc;
  if (!id || !storyletById(c.content, id)) return;
  c.s.booked.push({
    id,
    at: c.s.t + randi(c.rng, ARC_DELAY[0], ARC_DELAY[1]),
    roles: { a: r.id },
    tries: 0,
  });
}

/** 時刻が来た予約を起こす。条件が合わなければ 1 時間ずつ先送りし、住人が出ていっていれば捨てる */
export function processBooked(c: Ctx): void {
  const { s } = c;
  const due = s.booked.filter((k) => k.at <= s.t);
  if (due.length === 0) return;
  s.booked = s.booked.filter((k) => k.at > s.t);
  for (const k of due) {
    const st = storyletById(c.content, k.id);
    if (!st) continue;
    const fixed: Bindings = {};
    const a = getRes(s, k.roles.a ?? null);
    const b = getRes(s, k.roles.b ?? null);
    if ((k.roles.a !== undefined && !a) || (k.roles.b !== undefined && !b)) continue;
    if (a) fixed.a = a;
    if (b) fixed.b = b;
    if (st.once && s.story.done.includes(st.id)) continue;
    const bs = storyOk(c, st) ? bindingsFor(c, st, fixed) : [];
    if (bs.length > 0) {
      if (st.chance >= 1 || chance(c.rng, st.chance)) fire(c, st, bs[0]!);
    } else if (k.tries < MAX_BOOK_TRIES)
      s.booked.push({ ...k, at: s.t + 60, tries: k.tries + 1 });
  }
}
