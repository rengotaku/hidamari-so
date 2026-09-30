import { boxesFor, defaultContent, MOVING_BOX_ID, NO_ACTS, type Decor } from "@/content";
import {
  ACTS,
  SCENE_H,
  SCENE_W,
  hourOf,
  nightScenes,
  roomRect,
  type GameState,
  type Resident,
} from "@/sim";
import { BOX_BASE, placed } from "./decor";
import { drawNightRect } from "./night";
import { P, shade } from "./palette";
import { drawFigure, type Face, type Pose } from "./person";
import { LANDLORD_LOOK, roomOccupants, STAINS } from "./room";
import { WINDOW_COLS, WINDOW_ROWS, windowSeasonMarks } from "./season";
import { currentSky, nightness } from "./sky";

/**
 * 部屋の大写し（2.5D）。奥の壁・床・左右の壁を斜め上から見た形で描き、家具と人は奥から手前の順に重ねる。
 * 座標は部屋の中の比率: x は左右（0〜1）、d は奥の壁から手前（0〜1）、z は床から天井（0〜1）。
 * 装飾は全体図と同じ decor.json の定義（幅・奥行き・高さと色の箱）から箱を立てる。
 * 状態は書き換えない。
 */

const W = SCENE_W;
const H = SCENE_H;
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** 奥の壁（床の線 bF・天井の線 bT）と、いちばん手前の線（fL〜fR・fF）。試作の「大写し」と同じ形 */
const bL = 72;
const bR = 248;
const bT = 16;
const bF = 112;
const fL = -26;
const fR = 346;
const fF = 206;
const WALL_H = bF - bT;
const DEPTH_SCALE = (fR - fL) / (bR - bL);

type Pt = [number, number];
/** 部屋の比率 (x, d, z) から画面の座標 [x, y] と、その奥行きでの拡大率を返す */
function proj(x: number, d: number, z: number): [number, number, number] {
  const L = lerp(bL, fL, d);
  const R = lerp(bR, fR, d);
  const s = lerp(1, DEPTH_SCALE, d);
  return [L + (R - L) * x, lerp(bF, fF, d) - z * WALL_H * s, s];
}

/** 全体図の 1 ドット（部屋は 74 x 48、床から天井まで 38）を、部屋の比率にする */
const KX = 1 / 74;
const KD = 1 / 40;
const KZ = 1 / 38;
/** 人の拡大率。奥行きの拡大率にこれを掛ける（全体図の人の約 2.5 倍から、手前では 4 倍を超える） */
const PERSON = 2.4;

function poly(ctx: CanvasRenderingContext2D, pts: Pt[], c: string): void {
  ctx.fillStyle = c;
  ctx.beginPath();
  pts.forEach((p, k) => {
    const x = Math.round(p[0]);
    const y = Math.round(p[1]);
    if (k === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
}

const pt = (x: number, d: number, z: number): Pt => {
  const p = proj(x, d, z);
  return [p[0], p[1]];
};

/** 奥の壁に貼りつく面 */
function wallRect(
  ctx: CanvasRenderingContext2D,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  c: string
): void {
  poly(ctx, [pt(x0, 0, z0), pt(x1, 0, z0), pt(x1, 0, z1), pt(x0, 0, z1)], c);
}

/** 箱: 部屋の中心側に向いた横の面・正面・上面の 3 面を描く */
function box(
  ctx: CanvasRenderingContext2D,
  x0: number,
  x1: number,
  d0: number,
  d1: number,
  z0: number,
  z1: number,
  c: string
): void {
  if ((x0 + x1) / 2 < 0.5)
    poly(
      ctx,
      [pt(x1, d0, z0), pt(x1, d1, z0), pt(x1, d1, z1), pt(x1, d0, z1)],
      shade(c, -28)
    );
  else
    poly(
      ctx,
      [pt(x0, d0, z0), pt(x0, d1, z0), pt(x0, d1, z1), pt(x0, d0, z1)],
      shade(c, -28)
    );
  poly(
    ctx,
    [pt(x0, d1, z0), pt(x1, d1, z0), pt(x1, d1, z1), pt(x0, d1, z1)],
    shade(c, -14)
  );
  poly(ctx, [pt(x0, d0, z1), pt(x1, d0, z1), pt(x1, d1, z1), pt(x0, d1, z1)], c);
}

/** 装飾の部品 1 つ: 定義の箱（部品の左下奥が原点）を、部屋の比率の位置に立てる */
function drawPart(
  ctx: CanvasRenderingContext2D,
  def: Decor,
  x0: number,
  d0: number,
  z0: number,
  acts: ReadonlySet<string> = NO_ACTS
): void {
  for (const [bx, by, bz, bw, bd, bh, c] of boxesFor(def, acts))
    box(
      ctx,
      x0 + bx * KX,
      x0 + (bx + bw) * KX,
      d0 + by * KD,
      d0 + (by + bd) * KD,
      z0 + bz * KZ,
      z0 + (bz + bh) * KZ,
      c
    );
}

/* ---------- あかり ---------- */

export type LightMode = "day" | "dusk" | "fluorescent" | "lamp" | "off";
/** 机の明かりで過ごす行動 */
const LAMP_ACTS: readonly string[] = ["study", "draw", "keiba"];

/**
 * 部屋のあかりの状態: 昼 / 夕方 / 夜は起きている人がいれば蛍光灯か電気スタンド、誰も起きていなければ消灯。
 * 全体図の roomLit（夜に誰かが起きている部屋は明かりがつく）と同じ判定を使う。
 */
export function lightOf(s: GameState, room: number): LightMode {
  const h = hourOf(s.t);
  const n = nightness(h);
  if (n < 0.05) return "day";
  if (n < 0.5) return h >= 12 ? "dusk" : "day";
  const awake = roomOccupants(s, room).filter(
    (o) => o.act !== "sleep" && o.act !== "nap"
  );
  const sweeping = s.landlord.phase === "clearing" && s.landlord.room === room;
  if (awake.length === 0 && !sweeping) return "off";
  return awake.some((o) => LAMP_ACTS.includes(o.act)) ? "lamp" : "fluorescent";
}

/* ---------- 人の置き場 ---------- */

type Kind = "stand" | "lie-futon";
interface Seat {
  who: Resident;
  kind: Kind;
  pose: Pose;
  /** 画面の座標: 足元の中心 */
  cx: number;
  fy: number;
  scale: number;
  d: number;
  moving: boolean;
}

/** 表情: 寝ている・酔っている・落ち込んでいる・眠そう・機嫌がいい、のどれか（それ以外は素の顔） */
function faceOf(r: Resident): Face {
  if (r.act === "sleep" || r.act === "nap") return "sleepy";
  if (r.act === "drunk" || r.beers >= 3) return "drunk";
  if (r.mood < 35) return "worried";
  if (r.sleepy > 70) return "sleepy";
  if (r.mood > 75) return "grin";
  return "";
}

/** 部屋にいる全員の置き場。来客や宴会で人が増えても、奥行きをずらして全員を映す */
function seatsOf(s: GameState, room: number): Seat[] {
  const rr = roomRect(room);
  const ownerId = s.rooms[room] ?? null;
  const occ = roomOccupants(s, room);
  const n = occ.length;
  return occ.map((o, i) => {
    const def = o.act in ACTS ? ACTS[o.act as keyof typeof ACTS] : undefined;
    const xf = Math.max(0.1, Math.min(0.9, (o.x - rr.x) / 74));
    const lieOnFutons = def?.pose === "lie" && o.id === ownerId;
    if (lieOnFutons) {
      const hp = proj(0.1, 0.43, 0.07);
      const scale = hp[2] * 1.6;
      return {
        who: o,
        kind: "lie-futon",
        pose: "stand",
        cx: hp[0] + 4,
        fy: hp[1] + 9 * scale,
        scale,
        d: 0.43,
        moving: false,
      };
    }
    const d = n === 1 ? 0.8 : 0.6 + (i * 0.26) / (n - 1);
    const p = proj(xf, d, 0);
    const moving = Math.abs(o.tx - o.x) > 0.5 && def?.pose !== "lie";
    const pose: Pose = moving
      ? "walk"
      : def?.pose === "sit" || def?.pose === "lie"
        ? "sit"
        : "stand";
    return {
      who: o,
      kind: "stand",
      pose,
      cx: p[0],
      fy: p[1],
      scale: p[2] * PERSON,
      d,
      moving,
    };
  });
}

const headTop = (q: Seat): number =>
  q.kind === "lie-futon"
    ? q.fy - 14 * q.scale
    : q.fy - (q.pose === "sit" ? 11 : 14) * q.scale;

/** 大写しで部屋にいる人の位置（画面の座標。y は頭のてっぺん）。吹き出しの位置決めにも使う */
export function closeupPlacements(
  s: GameState,
  room: number
): Array<{ id: number; x: number; y: number }> {
  return seatsOf(s, room).map((q) => ({ id: q.who.id, x: q.cx, y: headTop(q) }));
}

/** 大写しでの吹き出しの位置（場面の座標）。この部屋にいない人は null */
export function closeupBubbleAnchor(
  s: GameState,
  room: number,
  r: Resident
): { x: number; y: number } | null {
  const q = seatsOf(s, room).find((x) => x.who.id === r.id);
  return q ? { x: q.cx, y: headTop(q) - 3 } : null;
}

/* ---------- 部屋そのもの ---------- */

const WALL = "#c9b68f";
const TV_COLORS = ["#8fd3ff", "#c9f0ff", "#ffe39a", "#b8f0c0"];
/** 散らかり（owner.clutter 12 ごとに 1 つ）: [x, d, 幅, 高さ, 色] */
const CLUTTER: Array<[number, number, number, number, string]> = [
  [0.8, 0.74, 0.08, 0.08, "#e6e6e0"],
  [0.3, 0.86, 0.06, 0.06, "#c9c24a"],
  [0.44, 0.9, 0.05, 0.02, "#d86a6a"],
  [0.9, 0.6, 0.08, 0.08, "#e6e6e0"],
  [0.2, 0.9, 0.04, 0.03, "#b9b9c9"],
  [0.6, 0.94, 0.05, 0.03, "#f0f0f0"],
  [0.36, 0.8, 0.05, 0.06, "#b9b9c9"],
  [0.72, 0.88, 0.05, 0.03, "#d86a6a"],
];

/** 窓の外（ガラスの部分）: 奥の壁の x 0.095〜0.345、床からの高さ 0.41〜0.81 */
const winRect = { x0: 0.095, x1: 0.345, z0: 0.41, z1: 0.81 };
const RAIN_DROPS = 22;
const SNOW_FLAKES = 26;
/** 雨粒の長さ（窓の高さに対する比率）と、雨・雪が落ちる速さ（窓の高さ/ミリ秒） */
const RAIN_LEN = 0.14;
const RAIN_SPEED = 0.0012;
const SNOW_SPEED = 0.00012;

/** 決定的な 0〜1 の疑似乱数（描画専用） */
const frac = (i: number): number => (Math.imul(i + 1, 2654435761) >>> 0) / 4294967296;

/** 窓の中の比率 (u, v)（左上が 0,0）の位置に、比率 (w, h) の塗りを置く */
function winPatch(
  ctx: CanvasRenderingContext2D,
  u: number,
  v: number,
  w: number,
  h: number,
  c: string
): void {
  const { x0, x1, z0, z1 } = winRect;
  wallRect(
    ctx,
    lerp(x0, x1, u),
    lerp(x0, x1, u + w),
    lerp(z1, z0, v + h),
    lerp(z1, z0, v),
    c
  );
}

/** 窓の外: 空の上に、季節の印（全体図と同じ格子）と、雨・雪の粒を描く。桟とカーテンはこのあとに重ねる */
function drawWindowOutside(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  now: number
): void {
  for (const m of windowSeasonMarks(s))
    winPatch(
      ctx,
      m.x / WINDOW_COLS,
      m.y / WINDOW_ROWS,
      m.w / WINDOW_COLS,
      m.h / WINDOW_ROWS,
      m.color
    );
  if (s.weather === "rain")
    for (let k = 0; k < RAIN_DROPS; k++) {
      const v = (frac(k * 7 + 2) + now * RAIN_SPEED) % (1 - RAIN_LEN);
      winPatch(ctx, frac(k * 5 + 1) * 0.97, v, 0.025, RAIN_LEN, "rgba(170,200,235,0.8)");
    }
  if (s.weather === "snow")
    for (let k = 0; k < SNOW_FLAKES; k++) {
      const v = (frac(k * 11 + 3) + now * SNOW_SPEED * (0.6 + frac(k * 3 + 4))) % 0.95;
      const u = 0.02 + frac(k * 13 + 5) * 0.9 + Math.sin(now / 700 + k) * 0.03;
      winPatch(ctx, u, v, 0.04, 0.05, "#ffffff");
    }
}

function drawShell(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  now: number,
  room: number,
  sky: string,
  ownerCurtain: string | null,
  packed: boolean
): void {
  P(ctx, 0, 0, W, H, "#2a2530");
  poly(ctx, [pt(0, 0, 0), pt(0, 0, 1.2), pt(0, 1, 1.2), pt(0, 1, 0)], shade(WALL, -10));
  poly(ctx, [pt(1, 0, 0), pt(1, 0, 1.2), pt(1, 1, 1.2), pt(1, 1, 0)], shade(WALL, -14));
  // 床（畳）
  poly(ctx, [pt(0, 0, 0), pt(1, 0, 0), pt(1, 1, 0), pt(0, 1, 0)], "#b7ae6b");
  const seam = "#9f9656";
  for (const x of [1 / 3, 2 / 3])
    poly(
      ctx,
      [
        pt(x - 0.004, 0, 0),
        pt(x + 0.004, 0, 0),
        pt(x + 0.004, 1, 0),
        pt(x - 0.004, 1, 0),
      ],
      seam
    );
  poly(ctx, [pt(0, 0.494, 0), pt(1, 0.494, 0), pt(1, 0.506, 0), pt(0, 0.506, 0)], seam);
  // 奥の壁と巾木、染み
  wallRect(ctx, 0, 1, 0, 1, WALL);
  for (const [sx, sy, sw, sh] of STAINS[room]!)
    wallRect(
      ctx,
      sx! * KX,
      (sx! + sw!) * KX,
      (38 - sy! - sh!) * KZ,
      (38 - sy!) * KZ,
      shade(WALL, -18)
    );
  wallRect(ctx, 0, 1, 0, 0.05, shade(WALL, -30));
  // 窓（全体図と同じ位置。外は空の色）
  wallRect(ctx, 0.08, 0.36, 0.39, 0.83, "#6b4b32");
  wallRect(ctx, winRect.x0, winRect.x1, winRect.z0, winRect.z1, sky);
  drawWindowOutside(ctx, s, now);
  wallRect(ctx, 0.218, 0.226, 0.41, 0.81, "#6b4b32");
  if (ownerCurtain) {
    wallRect(ctx, 0.095, 0.15, 0.41, 0.81, ownerCurtain);
    wallRect(ctx, 0.29, 0.345, 0.41, 0.81, ownerCurtain);
  } else if (!packed) {
    // 空室は、窓に募集の貼り紙
    wallRect(ctx, 0.14, 0.3, 0.5, 0.74, "#f4f0e4");
    wallRect(ctx, 0.16, 0.28, 0.66, 0.7, "#c44a3a");
    wallRect(ctx, 0.16, 0.26, 0.58, 0.6, "#777777");
  }
  // 戸（右の壁）
  poly(
    ctx,
    [pt(1, 0.08, 0), pt(1, 0.4, 0), pt(1, 0.4, 0.72), pt(1, 0.08, 0.72)],
    "#6e5035"
  );
  poly(
    ctx,
    [pt(1, 0.1, 0), pt(1, 0.38, 0), pt(1, 0.38, 0.7), pt(1, 0.1, 0.7)],
    "#8c6a48"
  );
}

function drawLamp(ctx: CanvasRenderingContext2D, on: boolean): void {
  const l = proj(0.5, 0.45, 0.9);
  P(ctx, l[0], 0, 1, l[1], "#444444");
  P(ctx, l[0] - 14 * l[2], l[1], 28 * l[2], 4 * l[2], on ? "#fff6d8" : "#cfcabb");
}

function drawDecorBack(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  room: number,
  acts: ReadonlySet<string>
): void {
  for (const { def, cell } of placed(s, room, ["wall", "window", "ceiling"], acts))
    drawPart(
      ctx,
      def,
      cell[0] * KX,
      0,
      (38 - cell[1]) * KZ,
      def.slot === "window" ? NO_ACTS : acts
    );
}

function drawDecorFloor(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  room: number,
  acts: ReadonlySet<string>
): void {
  for (const { def, cell } of placed(s, room, ["floor"], acts))
    drawPart(ctx, def, cell[0] * KX, 0.03, 0, acts);
  const boxDef = defaultContent.decor[MOVING_BOX_ID];
  const n = s.decor[room]?.boxes ?? 0;
  if (boxDef)
    for (let k = 0; k < n; k++)
      drawPart(ctx, boxDef, (BOX_BASE[0] + (boxDef.step?.[0] ?? 0) * k) * KX, 0.58, 0);
}

function drawFurniture(
  ctx: CanvasRenderingContext2D,
  acts: ReadonlySet<string>,
  now: number
): void {
  // テレビ
  box(ctx, 0.73, 0.91, 0.22, 0.4, 0, 0.3, "#8d8a84");
  const tvOn = acts.has("tv") || acts.has("game");
  const sc = proj(0.82, 0.4, 0.15);
  P(
    ctx,
    sc[0] - 9 * sc[2],
    sc[1] - 7 * sc[2],
    18 * sc[2],
    13 * sc[2],
    tvOn ? TV_COLORS[Math.floor(now / 450) % TV_COLORS.length]! : "#2c3b3a"
  );
  // 布団（左手前）
  box(ctx, 0.05, 0.42, 0.34, 0.78, 0, 0.04, "#ece6d8");
  box(ctx, 0.05, 0.14, 0.36, 0.5, 0.04, 0.07, "#f4f0e6");
}

function drawBlanket(
  ctx: CanvasRenderingContext2D,
  owner: Resident,
  sleeping: boolean
): void {
  box(ctx, 0.16, 0.41, 0.42, 0.76, 0.04, sleeping ? 0.1 : 0.07, owner.look.blanket);
}

function drawTable(
  ctx: CanvasRenderingContext2D,
  acts: ReadonlySet<string>,
  now: number
): void {
  box(ctx, 0.47, 0.69, 0.5, 0.7, 0.13, 0.16, "#946340");
  for (const [lx, ld] of [
    [0.49, 0.52],
    [0.67, 0.52],
    [0.49, 0.68],
    [0.67, 0.68],
  ] as const)
    box(ctx, lx - 0.01, lx + 0.01, ld - 0.01, ld + 0.01, 0, 0.13, "#5a3a22");
  const steam = Math.floor(now / 260) % 2;
  if (acts.has("ramen") || acts.has("moyashi")) {
    box(ctx, 0.55, 0.6, 0.57, 0.62, 0.16, 0.22, "#f2efe6");
    const p = proj(0.575, 0.6, 0.26);
    P(ctx, p[0], p[1] - steam * 2, 1, 3, "#dddddd");
  }
  if (acts.has("bento")) box(ctx, 0.54, 0.64, 0.56, 0.64, 0.16, 0.19, "#e8e0cf");
  if (acts.has("study")) box(ctx, 0.52, 0.62, 0.55, 0.64, 0.16, 0.18, "#4a6fa8");
  if (acts.has("keiba")) box(ctx, 0.52, 0.64, 0.55, 0.64, 0.16, 0.17, "#d7d2c4");
  if (acts.has("draw")) box(ctx, 0.52, 0.64, 0.55, 0.64, 0.16, 0.17, "#fbfaf5");
  if (acts.has("cook") || acts.has("nimono")) {
    box(ctx, 0.53, 0.64, 0.55, 0.66, 0.16, 0.21, "#3a3a40");
    const p = proj(0.58, 0.6, 0.26);
    P(ctx, p[0] - 2, p[1] - steam * 2, 1, 3, "#e8e8e8");
    P(ctx, p[0] + 3, p[1] - 2 + steam * 2, 1, 3, "#e8e8e8");
  }
  if (acts.has("beer") || acts.has("drunk"))
    for (let k = 0; k < 3; k++)
      box(ctx, 0.52 + k * 0.04, 0.545 + k * 0.04, 0.56, 0.58, 0.16, 0.23, "#d8c24a");
}

function drawClutter(ctx: CanvasRenderingContext2D, owner: Resident): void {
  const n = Math.min(8, Math.floor(owner.clutter / 12));
  for (let k = 0; k < n; k++) {
    const [x, d, w, h, c] = CLUTTER[k]!;
    box(ctx, x, x + w, d, d + 0.05, 0, h, c);
  }
}

function drawSeat(ctx: CanvasRenderingContext2D, q: Seat, frame: number): void {
  const o = q.who;
  const def = o.act in ACTS ? ACTS[o.act as keyof typeof ACTS] : undefined;
  const face = faceOf(o);
  if (q.kind === "lie-futon") {
    drawFigure(ctx, o.look, q.cx, q.fy, "stand", 3, false, null, {
      scale: q.scale,
      face: face === "drunk" ? "drunk" : "sleepy",
      headOnly: true,
    });
    return;
  }
  drawFigure(
    ctx,
    o.look,
    q.cx,
    q.fy,
    q.pose,
    frame,
    o.dir < 0,
    q.moving ? null : def?.prop,
    {
      scale: q.scale,
      face,
    }
  );
}

/** 明かりの状態に合わせた全体の色合い（窓の外の色は部屋の形の描画で済ませてある） */
function drawLighting(ctx: CanvasRenderingContext2D, light: LightMode): void {
  if (light === "dusk") {
    ctx.fillStyle = "rgba(255,150,80,0.12)";
    ctx.fillRect(0, 0, W, H);
  } else if (light === "fluorescent") {
    ctx.fillStyle = "rgba(220,235,255,0.06)";
    ctx.fillRect(0, 0, W, H);
  } else if (light === "lamp") {
    ctx.fillStyle = "rgba(10,12,35,0.45)";
    ctx.fillRect(0, 0, W, H);
    const p = proj(0.6, 0.6, 0.3);
    const g = ctx.createRadialGradient(p[0], p[1], 2, p[0], p[1], 90);
    g.addColorStop(0, "rgba(255,200,120,0.35)");
    g.addColorStop(1, "rgba(255,200,120,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (light === "off") {
    ctx.fillStyle = "rgba(10,12,35,0.62)";
    ctx.fillRect(0, 0, W, H);
  }
}

/**
 * 部屋 room の大写しを 1 フレーム描く。now は演出用の時計（ミリ秒）。
 * 住人が外出していれば家具と装飾だけの部屋を映し、帰ってくればまた映る。
 */
export function drawCloseup(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  room: number,
  now: number
): void {
  const id = s.rooms[room] ?? null;
  const owner = id === null ? undefined : s.res.find((r) => r.id === id);
  const occ = roomOccupants(s, room);
  const acts = new Set<string>(occ.map((o) => o.act));
  const frame = Math.floor(now / 260) % 2;
  const packed = s.vacancies.some((v) => v.room === room && !v.cleared);
  const light = lightOf(s, room);
  const seats = seatsOf(s, room);
  const sky = currentSky(s);
  const sleeping =
    owner !== undefined &&
    occ.some((o) => o === owner && (o.act === "sleep" || o.act === "nap"));

  drawShell(ctx, s, now, room, sky, owner?.look.curtain ?? null, packed);
  drawLamp(ctx, light === "fluorescent");
  drawDecorBack(ctx, s, room, acts);
  drawDecorFloor(ctx, s, room, acts);
  if (owner) {
    drawFurniture(ctx, acts, now);
    const lying = seats.find((q) => q.kind === "lie-futon");
    if (lying) drawSeat(ctx, lying, frame);
    drawBlanket(ctx, owner, sleeping);
    drawTable(ctx, acts, now);
    drawClutter(ctx, owner);
  }
  for (const q of seats.filter((x) => x.kind === "stand").sort((a, b) => a.d - b.d))
    drawSeat(ctx, q, frame);
  if (s.landlord.phase === "clearing" && s.landlord.room === room) {
    const p = proj(0.88, 0.8, 0);
    drawFigure(ctx, LANDLORD_LOOK, p[0], p[1], "stand", frame, true, null, {
      scale: p[2] * PERSON,
    });
    const b = proj(0.8, 0.8, 0);
    const sway = frame ? 2 : 0;
    P(ctx, b[0] - sway, b[1] - 11 * p[2] * PERSON, 2, 11 * p[2] * PERSON, "#8a6a3a");
    P(ctx, b[0] - 4 - sway, b[1] - 2, 8, 2, "#c9b070");
  }
  drawLighting(ctx, light);
  if (nightScenes(s).some((sc) => sc.room === room))
    drawNightRect(ctx, { x: 0, y: 0, w: W, h: H }, now, 3);
}
