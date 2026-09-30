import { chance, createRng, pick, rand, stepPath, type Point, type Rng } from "@/sim";
import { nightness } from "./sky";
import type { PersonLook } from "./person";

/** 住人ではない通行人と野良猫。見た目だけの演出で、保存もシミュレーションにも関わらない */
export interface Walker {
  look: PersonLook;
  path: Point[];
  pi: number;
  x: number;
  y: number;
  dir: 1 | -1;
  spd: number;
  dog: boolean;
  prop: "bag" | null;
}

export interface Ambient {
  walkers: Walker[];
  cat: { x: number; tx: number };
}

export const createAmbient = (): Ambient => ({ walkers: [], cat: { x: 34, tx: 34 } });

const HAIR = [
  "#2a211c",
  "#3a2a20",
  "#6b4a2b",
  "#1c1c24",
  "#8a5a2b",
  "#b58a4a",
  "#4a2f3a",
  "#d8d4cc",
];
const SKIN = ["#f0c9a0", "#e6b88f", "#d9a57c", "#f3d2b1"];
const SHIRT = [
  "#c65b4a",
  "#4f7fb0",
  "#6f9a5a",
  "#d9c26a",
  "#8a6fb0",
  "#e0e0d8",
  "#d98a4a",
  "#4a4a55",
  "#3f8f8a",
];
const PANTS = ["#3b3f5a", "#4a3d33", "#2e2e36", "#6a6a72", "#35506a"];
const CAT_SPOTS = [34, 34, 60, 120, 200, 250, 290];

/** gameMinutes ぶん進めた新しい Ambient を返す。hour は 0〜24 の時刻 */
export function updateAmbient(
  a: Ambient,
  gameMinutes: number,
  hour: number,
  rng: Rng
): Ambient {
  const walkers = a.walkers
    .map((w) => ({ ...w }))
    .filter((w) => !stepPath(w, gameMinutes, w.spd));
  const n = nightness(hour);
  if (walkers.length < 3 && chance(rng, 0.006 * gameMinutes * (n > 0.7 ? 0.25 : 1))) {
    const ltr = chance(rng, 0.5);
    const path: Point[] = ltr
      ? [
          [-12, 182],
          [334, 182],
        ]
      : [
          [334, 182],
          [-12, 182],
        ];
    walkers.push({
      look: {
        hair: pick(rng, HAIR),
        skin: pick(rng, SKIN),
        shirt: pick(rng, SHIRT),
        pants: pick(rng, PANTS),
        bald: false,
        long: chance(rng, 0.3),
      },
      path,
      pi: 0,
      x: path[0]![0],
      y: path[0]![1],
      dir: ltr ? 1 : -1,
      spd: rand(rng, 4, 7),
      dog: chance(rng, 0.3),
      prop: chance(rng, 0.2) ? "bag" : null,
    });
  }
  const cat = { ...a.cat };
  if (Math.abs(cat.tx - cat.x) < 0.5) {
    if (chance(rng, 0.02 * gameMinutes)) cat.tx = pick(rng, CAT_SPOTS);
  } else
    cat.x +=
      Math.sign(cat.tx - cat.x) * Math.min(Math.abs(cat.tx - cat.x), 3 * gameMinutes);
  return { walkers, cat };
}

/** 描画側だけで使う乱数（固定シード） */
export const ambientRng = (): Rng => createRng(20260930);
