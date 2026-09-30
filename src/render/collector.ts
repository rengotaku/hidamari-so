import {
  roomRect,
  type GameState,
  type Look,
  type Point,
  type StoryletEntry,
} from "@/sim";
import { drawPerson } from "./person";

/**
 * 取り立て屋（来訪者）の描画。住人ではなく、出来事の日誌から「いま来ている」ことを導くだけで、
 * 状態は書き換えない（夜の場面 night.ts と同じ、読み取り専用の派生）。
 * id が COLLECTOR_PREFIX で始まる出来事が起きてから VISIT_MIN 分のあいだ、その部屋の前に黒い背広の人影が出る。
 * 連れて行く場面は描かない（画面外。結果は日誌にだけ残る）。
 */
export const COLLECTOR_PREFIX = "collector-";
/** 出来事から、人影が消えるまでの分 */
export const VISIT_MIN = 60;
/** そのうち、階段を上がる・歩いてくる時間（残りはドアの前に立っている） */
export const ARRIVE_MIN = 20;

export const COLLECTOR_LOOK: Look = {
  hair: "#15151a",
  skin: "#d9b596",
  shirt: "#15151a",
  pants: "#1c1c22",
  blanket: "#15151a",
  curtain: "#15151a",
  bald: false,
  long: false,
};

export interface CollectorVisit {
  room: number;
  x: number;
  y: number;
  walking: boolean;
  /** 進行方向（左向きが -1） */
  dir: 1 | -1;
}

/** ドアの前の x。部屋の右寄り（階段側） */
export const doorX = (room: number): number => roomRect(room).x + 64;

/** 1 階は通り（y=179）、2 階は廊下（y=117）に立つ */
const walkY = (room: number): number => (room < 3 ? 179 : 117);

/** 階段の下から部屋のドアの前までの経路 */
function approach(room: number): Point[] {
  const dx = doorX(room);
  return room < 3
    ? [
        [302, 179],
        [dx, 179],
      ]
    : [
        [302, 172],
        [279, 120],
        [266, 117],
        [dx, 117],
      ];
}

function along(path: readonly Point[], f: number): { p: Point; dir: 1 | -1 } {
  const lens = path
    .slice(1)
    .map((q, i) => Math.hypot(q[0] - path[i]![0], q[1] - path[i]![1]));
  let d = Math.max(0, Math.min(1, f)) * lens.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lens.length; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    if (d <= lens[i]! || i === lens.length - 1) {
      const k = lens[i]! === 0 ? 1 : Math.min(1, d / lens[i]!);
      return {
        p: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k],
        dir: b[0] < a[0] ? -1 : 1,
      };
    }
    d -= lens[i]!;
  }
  return { p: path[path.length - 1]!, dir: -1 };
}

/** いま来ている取り立て屋。いなければ null（直近の出来事 1 件だけを見る） */
export function collectorVisit(s: GameState): CollectorVisit | null {
  for (const e of s.log) {
    if (s.t - e.t >= VISIT_MIN) return null;
    if (!("storyletId" in e) || !e.storyletId.startsWith(COLLECTOR_PREFIX)) continue;
    const ref = (e as StoryletEntry).roles.a;
    if (!ref || e.t > s.t) continue;
    const { p, dir } = along(approach(ref.room), (s.t - e.t) / ARRIVE_MIN);
    return {
      room: ref.room,
      x: p[0],
      y: s.t - e.t < ARRIVE_MIN ? p[1] : walkY(ref.room),
      walking: s.t - e.t < ARRIVE_MIN,
      dir,
    };
  }
  return null;
}

/** 黒い背広の人影を描く。now は演出用の時計（ミリ秒） */
export function drawCollector(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  now: number
): void {
  const v = collectorVisit(s);
  if (!v) return;
  drawPerson(
    ctx,
    COLLECTOR_LOOK,
    v.x,
    v.y,
    v.walking ? "walk" : "stand",
    Math.floor(now / 180) % 2,
    v.dir < 0,
    null
  );
}
