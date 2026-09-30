import { defaultContent, type Archetype, type Content } from "@/content";
import { chooseAct, workNow } from "./behavior";
import type { Ctx } from "./context";
import {
  BLANKET,
  CURTAIN,
  GIVEN_NAMES,
  HAIR,
  OLD_GIVEN_NAMES,
  PANTS,
  SHIRT,
  SKIN,
  SURNAMES,
} from "./data";
import { emptyRoomDecor, furnishNow, newLandlord, planDecor } from "./decor";
import { roomRect } from "./layout";
import { chance, pick, randi, type Rng } from "./random";
import { bookArc, fireStorylet } from "./storylets";
import type { GameState, JobId, Resident, TraitId } from "./types";

const START_T = 17 * 60;
/** 最初から入居している部屋（残りの二部屋は空室） */
const INITIAL_ROOMS = [0, 1, 3, 5] as const;
const OPENING_ID = "opening";

const isOld = (a: Archetype): boolean => a.tags.includes("old");

interface ResidentOption {
  sei?: string;
  mei?: string;
  age?: number;
  traits?: TraitId[];
}

function pickTraits(rng: Rng, arch: Archetype, content: Content): TraitId[] {
  const base: TraitId[] = [pick(rng, arch.traits)];
  const others = Object.keys(content.traits).filter((k) => !base.includes(k));
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
  const j = c.content.archetypes[job]!;
  const used = c.s.res.map((r) => r.sei);
  const sei =
    opt.sei ??
    pick(
      rng,
      SURNAMES.filter((x) => !used.includes(x))
    );
  const traits = opt.traits ?? pickTraits(rng, j, c.content);
  const mei = opt.mei ?? pick(rng, isOld(j) ? OLD_GIVEN_NAMES : GIVEN_NAMES);
  const age = opt.age ?? randi(rng, j.age[0], j.age[1]);
  const look = {
    hair: isOld(j) ? "#d8d4cc" : pick(rng, HAIR),
    skin: pick(rng, SKIN),
    shirt: pick(rng, SHIRT),
    pants: pick(rng, PANTS),
    blanket: pick(rng, BLANKET),
    curtain: pick(rng, CURTAIN),
    bald: isOld(j) && chance(rng, 0.6),
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
    money: j.startMoney,
    mood: 55,
    hunger: randi(rng, 10, 40),
    sleepy: randi(rng, 10, 40),
    comfort: 55,
    clutter: randi(rng, 5, 40),
    decorPlan: planDecor(rng, j),
    settled: 0,
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

export function moveIn(c: Ctx, r: Resident, room: number): void {
  c.s.rooms[room] = r.id;
  r.room = room;
  r.at = room;
  r.x = roomRect(room).x + 40;
  r.tx = r.x;
  c.s.res.push(r);
}

/** 種類を重複なしで n 個抽選する。高齢の住人は階段のない一階へ入れるため先に並べる */
function drawArchetypes(rng: Rng, content: Content, n: number): Archetype[] {
  const pool = Object.values(content.archetypes);
  const drawn: Archetype[] = [];
  while (drawn.length < n && pool.length > 0) {
    const i = Math.floor(rng.next() * pool.length);
    drawn.push(pool.splice(i, 1)[0]!);
  }
  return [...drawn.filter(isOld), ...drawn.filter((a) => !isOld(a))];
}

/**
 * 新しいゲーム。乱数は引数で渡す（固定シードなら常に同じ初期状態になる）。
 * 初期住人（四人）の種類・名前・癖はシードから抽選する。
 */
export function newGame(rng: Rng, content: Content = defaultContent): GameState {
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
    bonds: [],
    booked: [],
    story: { last: {}, done: [] },
    town: {},
    decor: [0, 1, 2, 3, 4, 5].map(emptyRoomDecor),
    vacancies: [],
    landlord: newLandlord(),
  };
  const c: Ctx = { s, rng, quiet: true, content };
  drawArchetypes(rng, content, INITIAL_ROOMS.length).forEach((arch, i) => {
    const r = makeResident(c, s.nextId++, arch.id);
    moveIn(c, r, INITIAL_ROOMS[i]!);
    furnishNow(c, r);
  });
  for (const r of s.res) {
    const sh = workNow(c, r);
    if (sh) {
      r.at = "out";
      r.act = "out";
      r.outPurpose = "work";
      r.shift = { label: sh.label, pay: sh.pay };
    } else chooseAct(c, r);
    bookArc(c, r);
  }
  if (s.res[2]) s.res[2].clutter = 85;
  fireStorylet(c, OPENING_ID);
  return s;
}
