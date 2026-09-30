import { chooseAct, workNow } from "./behavior";
import { log, type Ctx } from "./context";
import {
  BLANKET,
  CURTAIN,
  GIVEN_NAMES,
  HAIR,
  JOBS,
  JOB_TRAITS,
  OLD_GIVEN_NAMES,
  PANTS,
  SHIRT,
  SKIN,
  SURNAMES,
  TRAITS,
} from "./data";
import { roomRect } from "./layout";
import { chance, pick, randi, type Rng } from "./random";
import type { GameState, JobId, Resident, TraitId } from "./types";

const START_T = 17 * 60;

interface ResidentOption {
  sei?: string;
  mei?: string;
  age?: number;
  traits?: TraitId[];
}

function pickTraits(rng: Rng, job: JobId): TraitId[] {
  const base: TraitId[] = [pick(rng, JOB_TRAITS[job])];
  const others = (Object.keys(TRAITS) as TraitId[]).filter((k) => !base.includes(k));
  base.push(pick(rng, others));
  if (chance(rng, 0.4))
    base.push(
      pick(
        rng,
        others.filter((k) => !base.includes(k))
      )
    );
  return base;
}

export function makeResident(
  c: Ctx,
  id: number,
  job: JobId,
  opt: ResidentOption = {}
): Resident {
  const { rng } = c;
  const j = JOBS[job];
  const used = c.s.res.map((r) => r.sei);
  const sei =
    opt.sei ??
    pick(
      rng,
      SURNAMES.filter((x) => !used.includes(x))
    );
  const traits = opt.traits ?? pickTraits(rng, job);
  const mei = opt.mei ?? pick(rng, j.old ? OLD_GIVEN_NAMES : GIVEN_NAMES);
  const age = opt.age ?? randi(rng, j.age[0], j.age[1]);
  const look = {
    hair: j.old ? "#d8d4cc" : pick(rng, HAIR),
    skin: pick(rng, SKIN),
    shirt: pick(rng, SHIRT),
    pants: pick(rng, PANTS),
    blanket: pick(rng, BLANKET),
    curtain: pick(rng, CURTAIN),
    bald: !!j.old && chance(rng, 0.6),
    long: chance(rng, 0.3),
  };
  return {
    id,
    sei,
    mei,
    age,
    job,
    traits,
    look,
    money: j.start,
    mood: 55,
    hunger: randi(rng, 10, 40),
    sleepy: randi(rng, 10, 40),
    comfort: 55,
    clutter: randi(rng, 5, 40),
    room: -1,
    at: -1,
    visiting: false,
    x: 0,
    y: 0,
    tx: 0,
    dir: 1,
    act: "idle",
    lastAct: null,
    until: 0,
    beers: 0,
    bathed: false,
    gym: 0,
    quitGym: false,
    since: c.s.t,
    path: [],
    pi: 0,
    walkMode: null,
    outPurpose: null,
    outUntil: 0,
    outDur: 0,
    hurry: false,
    shift: null,
    late: false,
    lateChecked: false,
    noisy: null,
    bubble: null,
  };
}

function moveIn(c: Ctx, r: Resident, room: number): void {
  c.s.rooms[room] = r.id;
  r.room = room;
  r.at = room;
  r.x = roomRect(room).x + 40;
  r.tx = r.x;
  c.s.res.push(r);
}

/** 新しいゲーム。乱数は引数で渡す（固定シードなら常に同じ初期状態になる） */
export function newGame(rng: Rng): GameState {
  const s: GameState = {
    t: START_T,
    t0: START_T,
    weather: "sunny",
    res: [],
    rooms: [null, null, null, null, null, null],
    log: [],
    nextId: 1,
    lastHour: Math.floor(START_T / 60),
    pending: [],
    noiseHour: -1,
  };
  const c: Ctx = { s, rng, quiet: true };
  const add = (job: JobId, room: number, opt: ResidentOption): void => {
    moveIn(c, makeResident(c, s.nextId++, job, opt), room);
  };
  add("oldman", 0, { sei: "松本", mei: "茂", age: 78, traits: ["neko", "hitorigoto"] });
  add("salaryman", 1, { sei: "田中", mei: "誠", age: 41, traits: ["sake", "mie"] });
  add("band", 3, {
    sei: "佐々木",
    mei: "翔",
    age: 29,
    traits: ["nebou", "katazuke", "sake"],
  });
  add("ronin", 5, { sei: "森", mei: "健太", age: 22, traits: ["samishi", "mikka"] });
  for (const r of s.res) {
    const sh = workNow(c, r);
    if (sh) {
      r.at = "out";
      r.act = "out";
      r.outPurpose = "work";
      r.shift = { label: sh.label, pay: sh.pay };
    } else chooseAct(c, r);
  }
  s.res[2]!.clutter = 85;
  log(c, `今日からこのアパートの大家になった。住人は四人、空室が二つ`, "move");
  return s;
}
