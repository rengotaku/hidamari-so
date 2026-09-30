import {
  ACTS,
  SCENE_H,
  SCENE_W,
  ROOM_COUNT,
  roomRect,
  type GameState,
  type Resident,
} from "@/sim";

export interface Hit {
  /** 押された住人（空室・誰もいない部屋なら null） */
  residentId: number | null;
  /** 押された部屋（通りを歩いている住人を押したときは、その住人の部屋） */
  room: number | null;
}

/** 場面の座標（0〜320 × 0〜200）から、押されたものを引く */
export function hitTest(s: GameState, x: number, y: number): Hit | null {
  for (const r of s.res) {
    if (r.at === "walking" && Math.abs(r.x - x) < 7 && y > r.y - 18 && y < r.y + 3) {
      return { residentId: r.id, room: r.room };
    }
  }
  for (let i = 0; i < ROOM_COUNT; i++) {
    const rr = roomRect(i);
    if (x >= rr.x && x < rr.x + rr.w && y >= rr.y && y < rr.y + rr.h) {
      const here = s.res
        .filter((r) => r.at === i)
        .sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x));
      const ownerId = s.rooms[i] ?? null;
      const hit = here[0]?.id ?? ownerId;
      return { residentId: hit, room: i };
    }
  }
  return null;
}

/** 吹き出しの位置（場面の座標）。部屋の外にいて歩いていなければ null */
export function bubbleAnchor(r: Resident): { x: number; y: number } | null {
  if (r.at === "walking") return { x: r.x, y: r.y - 16 };
  if (typeof r.at !== "number") return null;
  const rr = roomRect(r.at);
  const pose = r.act in ACTS ? ACTS[r.act as keyof typeof ACTS].pose : "stand";
  if (pose === "lie" && r.at === r.room) return { x: rr.x + 10, y: rr.y + 30 };
  return { x: r.x, y: rr.y + 45 - (pose === "sit" ? 12 : 15) - 1 };
}

/** クリック位置（要素内の px）を場面の座標へ */
export function toScene(
  offsetX: number,
  offsetY: number,
  width: number,
  height: number
): { x: number; y: number } {
  return { x: (offsetX / width) * SCENE_W, y: (offsetY / height) * SCENE_H };
}

/** 場面の座標が部屋の中なら、その部屋番号（通りや屋根は null） */
export function roomAt(x: number, y: number): number | null {
  for (let i = 0; i < ROOM_COUNT; i++) {
    const rr = roomRect(i);
    if (x >= rr.x && x < rr.x + rr.w && y >= rr.y && y < rr.y + rr.h) return i;
  }
  return null;
}

/** キーボードで部屋を開いたときの住人: 部屋の持ち主（いなければ部屋にいる人。空室で誰もいなければ null） */
export function residentOfRoom(s: GameState, room: number): number | null {
  return s.rooms[room] ?? s.res.find((r) => r.at === room)?.id ?? null;
}
