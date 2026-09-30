import type { Archetype } from "@/content/schema";
import type { Ctx } from "./context";
import { clamp, randi, type Rng } from "./random";
import type { Landlord, Resident, RoleRef, RoomDecor } from "./types";

/** 入居から模様替えが終わる（装飾がそろう）までのゲーム内分 */
export const SETTLE_MIN = 1440;
/** 入居した直後に積まれている段ボールの数 */
export const START_BOXES = 3;
/** 退去が決まってから、次の入居の日までの幅（ゲーム内分） */
export const MOVE_IN_DELAY: [number, number] = [2 * 1440, 4 * 1440];

export const emptyRoomDecor = (): RoomDecor => ({ items: [], boxes: 0 });

export const refOf = (r: Resident): RoleRef => ({ id: r.id, sei: r.sei, room: r.room });

/**
 * 住人の部屋の装飾のセットを抽選する: 種類ごとの「必ず置くもの」と、候補から抽選したもの。
 * 置く順もシードで決まる。同じ種類でも住人ごとに違う部屋になる。
 */
export function planDecor(rng: Rng, arch: Archetype): string[] {
  const { required, pool, pick } = arch.decor;
  const rest = pool.slice();
  const all = [...required];
  for (let n = randi(rng, pick[0], pick[1]); n > 0 && rest.length > 0; n--)
    all.push(rest.splice(Math.floor(rng.next() * rest.length), 1)[0]!);
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [all[i], all[j]] = [all[j]!, all[i]!];
  }
  return all;
}

/** 最初から住んでいる住人: 装飾はもうそろっている */
export function furnishNow(c: Ctx, r: Resident): void {
  c.s.decor[r.room] = { items: [...r.decorPlan], boxes: 0 };
  r.settled = r.decorPlan.length;
}

/** 入居したばかりの住人: 部屋には段ボールだけ。装飾は settleDecor が少しずつ足す */
export function startSettling(c: Ctx, r: Resident): void {
  c.s.decor[r.room] = {
    items: [],
    boxes: r.decorPlan.length === 0 ? 0 : START_BOXES,
  };
  r.settled = 0;
}

/**
 * 入居から経った時間に合わせて、装飾を 1 つずつ足し、段ボールを減らす。
 * この呼び出しで模様替えが終わった住人を返す（日誌に書くのは呼び出し側）。
 */
export function settleDecor(c: Ctx): Resident[] {
  const { s } = c;
  const done: Resident[] = [];
  for (const r of s.res) {
    const total = r.decorPlan.length;
    if (r.settled >= total || s.rooms[r.room] !== r.id) continue;
    const room = s.decor[r.room]!;
    const target = Math.floor(total * clamp((s.t - r.since) / SETTLE_MIN, 0, 1));
    while (r.settled < target) {
      const id = r.decorPlan[r.settled++]!;
      if (!room.items.includes(id)) room.items.push(id);
    }
    room.boxes =
      r.settled >= total
        ? 0
        : START_BOXES - Math.floor((START_BOXES * r.settled) / total);
    if (r.settled >= total) done.push(r);
  }
  return done;
}

/** 部屋に装飾を足す（出来事の結果）。すでにあれば何もしない */
export function addDecor(c: Ctx, room: number, id: string): void {
  const d = c.s.decor[room];
  if (d && !d.items.includes(id)) d.items.push(id);
}

/** 部屋から装飾を外す（出来事の結果）。これから置く予定だった分も取り消す */
export function removeDecor(c: Ctx, r: Resident, id: string): void {
  const d = c.s.decor[r.room];
  if (d) d.items = d.items.filter((x) => x !== id);
  const i = r.decorPlan.indexOf(id);
  if (i >= 0) {
    r.decorPlan.splice(i, 1);
    if (i < r.settled) r.settled--;
  }
}

/** 住人が出ていった部屋を「片付け待ち」にして、次の入居の日を決める */
export function openVacancy(c: Ctx, r: Resident): void {
  c.s.vacancies.push({
    room: r.room,
    former: refOf(r),
    cleared: false,
    moveInAt: c.s.t + randi(c.rng, MOVE_IN_DELAY[0], MOVE_IN_DELAY[1]),
  });
}

/** 姿の見えない（何もしていない）大家 */
export const newLandlord = (): Landlord => ({
  phase: "idle",
  room: -1,
  x: 0,
  y: 0,
  dir: 1,
  path: [],
  pi: 0,
  until: 0,
  escort: null,
});
