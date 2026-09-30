import { hourOf, inWin } from "./clock";
import type { Ctx } from "./context";
import { newLandlord, refOf, startSettling } from "./decor";
import { chooseAct, stepPath } from "./behavior";
import { makeResident, moveIn } from "./init";
import { exitPath, roomRect } from "./layout";
import { pick } from "./random";
import { bookArc, logStorylet } from "./storylets";
import type { Landlord } from "./types";

/** 大家の歩く速さ（1 分あたりの px。住人の通常の歩き 6 より少しゆっくり） */
const SPEED = 5;
/** 部屋の片付けにかかるゲーム内分 */
export const CLEAR_MIN = 90;
/** 大家が動き出す時間帯 [開始時, 終了時) */
const WORK_HOURS: [number, number] = [8, 19];

/** 通りの左端から部屋の戸口までの道（住人が出ていく道の逆） */
function goTo(L: Landlord, phase: "up" | "escort", room: number): void {
  L.phase = phase;
  L.room = room;
  L.path = exitPath(room).slice().reverse();
  L.pi = 0;
  L.x = L.path[0]![0];
  L.y = L.path[0]![1];
  L.dir = 1;
}

function goHome(L: Landlord): void {
  L.phase = "down";
  L.path = exitPath(L.room);
  L.pi = 0;
  L.x = L.path[0]![0];
  L.y = L.path[0]![1];
}

/** 手が空いたとき: 片付け待ちの部屋があれば片付けに、入居の日が来ていれば住人を連れに行く */
function startJob(c: Ctx): void {
  const { s } = c;
  if (!inWin(hourOf(s.t), WORK_HOURS[0], WORK_HOURS[1])) return;
  const dirty = s.vacancies.find((v) => !v.cleared);
  if (dirty) {
    goTo(s.landlord, "up", dirty.room);
    return;
  }
  // 片付けが済んだ部屋にだけ、新しい住人を入れる（前の住人の装飾が残らない）
  const due = s.vacancies.find((v) => v.cleared && s.t >= v.moveInAt);
  if (!due) return;
  const newcomer = makeResident(
    c,
    s.nextId++,
    pick(c.rng, Object.keys(c.content.archetypes))
  );
  newcomer.room = due.room;
  // 住人の表にはまだ入れない（部屋に着いたら moveIn が居場所を決める）
  newcomer.at = "walking";
  s.landlord.escort = newcomer;
  goTo(s.landlord, "escort", due.room);
}

/** 片付けが終わった: 装飾が空になり、窓に募集の貼り紙が出る */
function finishClearing(c: Ctx): void {
  const { s } = c;
  const L = s.landlord;
  const v = s.vacancies.find((x) => x.room === L.room && !x.cleared);
  s.decor[L.room] = { items: [], boxes: 0 };
  if (v) {
    v.cleared = true;
    logStorylet(c, "room-cleared", v.former);
  }
  goHome(L);
}

/** 新しい住人を部屋に入れる: 段ボールだけの部屋から模様替えが始まる */
function welcome(c: Ctx): void {
  const { s } = c;
  const L = s.landlord;
  const r = L.escort;
  if (r) {
    moveIn(c, r, L.room);
    r.since = s.t;
    startSettling(c, r);
    bookArc(c, r);
    chooseAct(c, r);
    logStorylet(c, "room-move-in", refOf(r));
  }
  s.vacancies = s.vacancies.filter((v) => v.room !== L.room);
  L.escort = null;
  goHome(L);
}

/** 大家を dt（ゲーム内分）だけ動かす */
export function updateLandlord(c: Ctx, dt: number): void {
  const L = c.s.landlord;
  switch (L.phase) {
    case "idle":
      startJob(c);
      return;
    case "clearing":
      if (c.s.t >= L.until) finishClearing(c);
      return;
    case "up":
    case "escort":
    case "down": {
      if (!stepPath(L, dt, SPEED)) return;
      if (L.phase === "down") Object.assign(L, newLandlord());
      else if (L.phase === "escort") welcome(c);
      else {
        // 戸口に着いた: 部屋に入って片付け始める
        const rr = roomRect(L.room);
        L.phase = "clearing";
        L.until = c.s.t + CLEAR_MIN;
        L.x = rr.x + 60;
        L.y = rr.y + 45;
        L.dir = -1;
      }
      return;
    }
  }
}
