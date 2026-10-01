import { ACTS, roomRect, type GameState, type Resident } from "@/sim";
import { P, shade } from "./palette";
import { drawBackDecor, drawFloorDecor } from "./decor";
import { drawLying, drawPerson } from "./person";
import { drawWindowSeason, shovelingResident } from "./season";

export const STAINS: number[][][] = [0, 1, 2, 3, 4, 5].map((i) => [
  [8 + ((i * 17) % 40), 3, 5, 3],
  [30 + ((i * 29) % 30), 4, 3, 2],
]);

const TV_COLORS = ["#8fd3ff", "#c9f0ff", "#ffe39a", "#b8f0c0"];
const CLUTTER: Array<[number, number, string]> = [
  [20, 43, "bag"],
  [57, 43, "can"],
  [30, 44, "mag"],
  [44, 43, "can"],
  [10, 44, "sock"],
  [62, 41, "bag"],
  [36, 44, "cup"],
  [25, 43, "can"],
];

/** 大家の見た目（禿げ頭に、くすんだ茶の羽織） */
export const LANDLORD_LOOK = {
  hair: "#d8d4cc",
  skin: "#e8c9a0",
  shirt: "#7a6a4a",
  pants: "#4a4438",
  bald: true,
  long: false,
};

/** 部屋にいる人。雪かきで屋外に出ている人は、部屋では描かない（同じ人を 2 回描かない） */
export const roomOccupants = (s: GameState, i: number): Resident[] => {
  const shoveler = shovelingResident(s);
  return s.res.filter((r) => r.at === i && r !== shoveler).sort((a, b) => a.x - b.x);
};

/** 夜で、誰かが起きている部屋は明かりがつく */
export function roomLit(s: GameState, i: number, night: number): boolean {
  if (night < 0.05) return false;
  if (s.landlord.phase === "clearing" && s.landlord.room === i) return true;
  return roomOccupants(s, i).some((o) => o.act !== "sleep" && o.act !== "nap");
}

function drawOwnerBelongings(
  ctx: CanvasRenderingContext2D,
  owner: Resident,
  x: number,
  y: number,
  acts: Set<string>
): void {
  if (owner.traits.includes("mikka")) {
    if (owner.quitGym) {
      P(ctx, x + 48, y + 40, 8, 1, "#777777");
      P(ctx, x + 49, y + 37, 3, 3, "#e0e0d8");
      P(ctx, x + 53, y + 37, 2, 3, "#6f9a5a");
    } else if (!acts.has("workout")) {
      P(ctx, x + 49, y + 43, 6, 1, "#777777");
      P(ctx, x + 48, y + 42, 2, 3, "#444444");
      P(ctx, x + 54, y + 42, 2, 3, "#444444");
    }
  }
}

function drawClutter(
  ctx: CanvasRenderingContext2D,
  owner: Resident,
  x: number,
  y: number
): void {
  const n = Math.min(8, Math.floor(owner.clutter / 12));
  for (let k = 0; k < n; k++) {
    const c = CLUTTER[k]!;
    const cx = x + c[0];
    const cy = y + c[1];
    if (c[2] === "bag") {
      P(ctx, cx, cy - 3, 5, 5, "#e6e6e0");
      P(ctx, cx + 2, cy - 4, 1, 1, "#bbbbbb");
    } else if (c[2] === "can") P(ctx, cx, cy, 2, 3, k % 2 ? "#c9c24a" : "#b9b9c9");
    else if (c[2] === "mag") P(ctx, cx, cy, 5, 2, "#d86a6a");
    else if (c[2] === "sock") P(ctx, cx, cy, 3, 1, "#ffffff");
    else P(ctx, cx, cy, 3, 2, "#f0f0f0");
  }
}

function drawOwnerFurniture(
  ctx: CanvasRenderingContext2D,
  owner: Resident,
  x: number,
  y: number,
  acts: Set<string>,
  occ: Resident[],
  now: number
): void {
  const L = owner.look;
  drawOwnerBelongings(ctx, owner, x, y, acts);
  P(ctx, x + 3, y + 37, 25, 3, "#ece6d8");
  P(ctx, x + 3, y + 40, 25, 1, "#cfc8b8");
  P(ctx, x + 3, y + 35, 5, 2, "#f4f0e6");
  if (!occ.some((o) => o === owner && (o.act === "sleep" || o.act === "nap")))
    P(ctx, x + 13, y + 35, 13, 2, L.blanket);
  const tvOn = acts.has("tv") || acts.has("game");
  P(ctx, x + 46, y + 27, 11, 10, "#8d8a84");
  P(
    ctx,
    x + 47,
    y + 28,
    8,
    7,
    tvOn ? TV_COLORS[Math.floor(now / 450) % TV_COLORS.length]! : "#2c3b3a"
  );
  P(ctx, x + 56, y + 29, 1, 1, "#c44a3a");
  P(ctx, x + 48, y + 37, 2, 1, "#555555");
  P(ctx, x + 53, y + 37, 2, 1, "#555555");
  drawClutter(ctx, owner, x, y);
}

function drawTableThings(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  acts: Set<string>,
  frame: number,
  now: number
): void {
  P(ctx, x + 31, y + 33, 15, 2, "#7b4f2e");
  P(ctx, x + 31, y + 33, 15, 1, "#946340");
  P(ctx, x + 33, y + 35, 1, 4, "#5a3a22");
  P(ctx, x + 43, y + 35, 1, 4, "#5a3a22");
  if (acts.has("ramen") || acts.has("moyashi")) {
    P(ctx, x + 34, y + 30, 3, 3, "#f2efe6");
    P(ctx, x + 34, y + 31, 3, 1, "#c44a3a");
    if (frame) P(ctx, x + 35, y + 28, 1, 1, "#dddddd");
    else P(ctx, x + 34, y + 27, 1, 1, "#dddddd");
  }
  if (acts.has("bento")) {
    P(ctx, x + 38, y + 31, 6, 2, "#e8e0cf");
    P(ctx, x + 39, y + 31, 2, 1, "#c44a3a");
  }
  if (acts.has("study")) {
    P(ctx, x + 37, y + 31, 5, 2, "#4a6fa8");
    P(ctx, x + 38, y + 31, 3, 1, "#f4f0e4");
  }
  if (acts.has("keiba")) {
    P(ctx, x + 36, y + 30, 7, 3, "#d7d2c4");
    P(ctx, x + 38, y + 31, 1, 1, "#c44a3a");
    P(ctx, x + 40, y + 31, 1, 1, "#c44a3a");
  }
  if (acts.has("draw")) {
    P(ctx, x + 35, y + 31, 8, 2, "#fbfaf5");
    P(ctx, x + 36, y + 31, 5, 1, "#555555");
  }
  if (acts.has("cook")) {
    const k = Math.floor(now / 200) % 6;
    P(ctx, x + 56, y + 20 - k, 3, 2, "#8a8a8a");
    P(ctx, x + 54 + (k % 2), y + 15 - k, 4, 2, "#a0a0a0");
  }
  if (acts.has("nimono")) {
    const k = Math.floor(now / 260) % 4;
    P(ctx, x + 56, y + 22 - k, 1, 2, "#e8e8e8");
    P(ctx, x + 58, y + 20 - k, 1, 2, "#e8e8e8");
  }
}

/** 片付け中の大家: 戸口の近くで箒を動かす */
function drawLandlordSweeping(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  frame: number
): void {
  const px = x + 54;
  drawPerson(ctx, LANDLORD_LOOK, px, y + 45, "stand", frame, true, null);
  const sway = frame ? 1 : 0;
  P(ctx, px - 6 - sway, y + 34, 1, 11, "#8a6a3a");
  P(ctx, px - 8 - sway, y + 44, 4, 1, "#c9b070");
}

export function drawRoom(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  i: number,
  now: number,
  sky: string,
  lit: boolean
): void {
  const rr = roomRect(i);
  const { x, y } = rr;
  const id = s.rooms[i] ?? null;
  const owner = id === null ? undefined : s.res.find((r) => r.id === id);
  const occ = roomOccupants(s, i);
  const frame = Math.floor(now / 260) % 2;
  const acts = new Set<string>(occ.map((o) => o.act));
  const wall = "#c9b68f";
  P(ctx, x, y, 74, 48, wall);
  for (let k = 3; k < 74; k += 6) P(ctx, x + k, y + 2, 1, 36, shade(wall, -6));
  P(ctx, x, y, 74, 2, shade(wall, -30));
  for (const st of STAINS[i]!)
    P(ctx, x + st[0]!, y + st[1]!, st[2]!, st[3]!, shade(wall, -18));
  // 窓
  P(ctx, x + 6, y + 8, 20, 15, "#6b4b32");
  P(ctx, x + 7, y + 9, 18, 13, sky);
  P(ctx, x + 16, y + 9, 1, 13, "#6b4b32");
  drawWindowSeason(ctx, s, x, y);
  P(ctx, x + 5, y + 22, 22, 1, "#5a3d28");
  // 退去した部屋は、大家が片付けるまで荷物が残る（募集の貼り紙はまだ出ない）
  const packed = s.vacancies.some((v) => v.room === i && !v.cleared);
  if (owner) {
    P(ctx, x + 7, y + 9, 4, 13, owner.look.curtain);
    P(ctx, x + 21, y + 9, 4, 13, owner.look.curtain);
  } else if (!packed) {
    P(ctx, x + 10, y + 11, 12, 9, "#f4f0e4");
    P(ctx, x + 12, y + 13, 8, 1, "#c44a3a");
    P(ctx, x + 12, y + 15, 6, 1, "#777777");
    P(ctx, x + 12, y + 17, 7, 1, "#777777");
  }
  // 戸・床
  P(ctx, x + 59, y + 12, 12, 28, "#6e5035");
  P(ctx, x + 60, y + 13, 10, 26, "#8c6a48");
  P(ctx, x + 61, y + 26, 1, 1, "#e2c46a");
  P(ctx, x + 62, y + 15, 6, 2, "#e8e2d0");
  P(ctx, x, y + 38, 74, 10, "#b7ae6b");
  P(ctx, x, y + 38, 74, 1, "#8e8547");
  for (const k of [18, 37, 56]) P(ctx, x + k, y + 38, 1, 10, "#9f9656");
  // 電灯
  const lx = x + 37;
  P(ctx, lx, y + 2, 1, 3, "#444444");
  P(ctx, lx - 4, y + 5, 9, 2, lit ? "#fff6d8" : "#bdb9ad");
  if (lit) P(ctx, lx - 3, y + 7, 7, 1, "#fff0b0");
  // 雨漏り
  if (i >= 3 && s.weather === "rain" && owner) {
    P(ctx, x + 44, y + 41, 5, 4, "#6f7f95");
    P(ctx, x + 44, y + 41, 5, 1, "#8a9ab0");
    const dy = (now / 9) % 38;
    P(ctx, x + 46, y + 3 + dy, 1, 2, "#9fc4e8");
  }
  drawBackDecor(ctx, s, i, x, y, acts);
  if (owner) drawOwnerFurniture(ctx, owner, x, y, acts, occ, now);
  drawFloorDecor(ctx, s, i, x, y, acts);
  // ちゃぶ台は住人より奥にあるので、住人より先に描く
  drawTableThings(ctx, x, y, acts, frame, now);
  for (const o of occ) {
    const a = o.act in ACTS ? ACTS[o.act as keyof typeof ACTS] : undefined;
    const moving = Math.abs(o.tx - o.x) > 0.5 && a?.pose !== "lie";
    if (a?.pose === "lie" && o.room === i) {
      drawLying(ctx, o.look, x, s.rooms[i] === o.id ? y : y - 3);
      continue;
    }
    const pose = moving ? "walk" : a?.pose === "lie" ? "stand" : (a?.pose ?? "stand");
    drawPerson(ctx, o.look, o.x, y + 45, pose, frame, o.dir < 0, moving ? null : a?.prop);
  }
  if (s.landlord.phase === "clearing" && s.landlord.room === i) {
    drawLandlordSweeping(ctx, x, y, frame);
  }
  if (lit) {
    ctx.fillStyle = "rgba(255,196,110,0.08)";
    ctx.fillRect(x, y, 74, 48);
  }
}
