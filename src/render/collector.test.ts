import { describe, it, expect } from "vitest";
import { createRng, newGame, step, roomRect, ROOM_COUNT } from "@/sim";
import type { GameState, StoryletEntry } from "@/sim";
import { defaultContent, type Content } from "@/content";
import { drawScene, createAmbient } from "@/render";
import {
  ARRIVE_MIN,
  COLLECTOR_LOOK,
  VISIT_MIN,
  collectorVisit,
  doorX,
  drawCollector,
} from "./collector";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

/** fillRect の呼び出しを、そのときの fillStyle つきで記録する偽 Canvas */
function recordingCtx() {
  const rects: Rect[] = [];
  const state: Record<string, unknown> = { fillStyle: "" };
  const ctx = new Proxy(state, {
    get(_t, prop: string) {
      if (prop === "fillRect")
        return (x: number, y: number, w: number, h: number) =>
          rects.push({ x, y, w, h, color: String(state.fillStyle) });
      if (prop === "createRadialGradient")
        return () => ({ addColorStop: () => undefined });
      if (
        ["strokeRect", "beginPath", "moveTo", "quadraticCurveTo", "stroke"].includes(prop)
      )
        return () => undefined;
      return state[prop];
    },
    set(t, prop: string, value) {
      t[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, rects };
}

const SUIT = COLLECTOR_LOOK.shirt;
const suitRects = (rects: Rect[]) => rects.filter((r) => r.color === SUIT);

/** 取り立て屋の出来事が elapsed 分前に room の住人に起きた状態 */
function withVisit(
  seed: number,
  room: number,
  elapsed: number,
  storyletId = "collector-knock"
): GameState {
  const rng = createRng(seed);
  const s = step(newGame(rng), 60 * 10, rng);
  const entry: StoryletEntry = {
    t: s.t - elapsed,
    kind: "",
    storyletId,
    roles: { a: { id: 99, sei: "試験", room } },
    variant: { text: 0, slots: {} },
  };
  return { ...s, log: [entry, ...s.log] };
}

describe("Y6: 取り立て屋（来訪者）の描画", () => {
  it("2 階の部屋: ドアの前に立つ人影が廊下に出る", () => {
    for (let room = 3; room < ROOM_COUNT; room++) {
      const s = withVisit(1, room, ARRIVE_MIN + 10);
      const { ctx, rects } = recordingCtx();
      drawCollector(ctx, s, 1000);
      const suit = suitRects(rects);
      expect(suit.length, `room ${room}`).toBeGreaterThan(0);
      for (const r of suit) {
        expect(Math.abs(r.x - doorX(room))).toBeLessThanOrEqual(5);
        expect(r.y).toBeGreaterThan(95);
        expect(r.y).toBeLessThanOrEqual(118);
        expect(r.x).toBeGreaterThan(roomRect(room).x);
      }
    }
  });
  it("1 階の部屋: ドアの前（通り）に出る", () => {
    for (let room = 0; room < 3; room++) {
      const s = withVisit(2, room, ARRIVE_MIN + 10);
      const { ctx, rects } = recordingCtx();
      drawCollector(ctx, s, 1000);
      const suit = suitRects(rects);
      expect(suit.length, `room ${room}`).toBeGreaterThan(0);
      for (const r of suit) {
        expect(Math.abs(r.x - doorX(room))).toBeLessThanOrEqual(5);
        expect(r.y).toBeGreaterThan(160);
        expect(r.y).toBeLessThanOrEqual(180);
      }
    }
  });
  it("到着の途中は階段の上にいる（2 階の部屋）", () => {
    const s = withVisit(3, 3, 5);
    const v = collectorVisit(s)!;
    expect(v.walking).toBe(true);
    // 階段（x=279〜303）の上。地面より上、廊下より下
    expect(v.x).toBeGreaterThan(260);
    expect(v.x).toBeLessThanOrEqual(303);
    expect(v.y).toBeGreaterThan(117);
    expect(v.y).toBeLessThan(175);
    const { ctx, rects } = recordingCtx();
    drawCollector(ctx, s, 1000);
    expect(suitRects(rects).length).toBeGreaterThan(0);
  });
  it("取り立て屋のいない時間には出ない（出来事が無い・時間が過ぎた・collector- 以外）", () => {
    const none = (s: GameState) => {
      const { ctx, rects } = recordingCtx();
      drawCollector(ctx, s, 1000);
      return suitRects(rects).length;
    };
    const rng = createRng(4);
    expect(none(step(newGame(rng), 600, rng))).toBe(0);
    expect(none(withVisit(4, 3, VISIT_MIN))).toBe(0);
    expect(none(withVisit(4, 3, VISIT_MIN + 500))).toBe(0);
    expect(none(withVisit(4, 3, 10, "debt-taken"))).toBe(0);
    expect(collectorVisit(withVisit(4, 3, VISIT_MIN - 1))).not.toBeNull();
  });
  it("drawScene に組み込まれていて、例外なく描ける（昼・夜・雨）", () => {
    for (const seed of [1, 2, 3, 4]) {
      const s = withVisit(seed, seed % ROOM_COUNT, 30);
      const { ctx, rects } = recordingCtx();
      drawScene(ctx, s, createAmbient(), 500 * seed, null);
      expect(rects.length).toBeGreaterThan(50);
      expect(suitRects(rects).length).toBeGreaterThan(0);
    }
  });
  it("描いても状態を書き換えない", () => {
    const s = withVisit(5, 4, 12);
    const before = JSON.stringify(s);
    drawCollector(recordingCtx().ctx, s, 777);
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe("追加: 実際の進行で取り立て屋が来たとき", () => {
  it("collector- の出来事が起きた瞬間から描画でき、例外が出ない", () => {
    let seen = 0;
    for (let seed = 1; seed <= 6 && seen === 0; seed++) {
      const rng = createRng(seed);
      let s = newGame(rng);
      const r = s.res[0]!;
      r.job = "yamikin";
      for (let k = 0; k < 40 * 24 && seen === 0; k++) {
        s = step(s, 60, rng);
        const hit = s.log.find(
          (e) =>
            "storyletId" in e &&
            e.storyletId.startsWith("collector-") &&
            s.t - e.t < VISIT_MIN
        );
        if (hit) {
          const { ctx, rects } = recordingCtx();
          drawScene(ctx, s, createAmbient(), 1234, null);
          expect(suitRects(rects).length).toBeGreaterThan(0);
          seen++;
        }
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});

/** 取り立て屋の出来事を、(何分前, id, 言い回しの番号) の並びで日誌に積んだ状態（新しい順に並べ替える） */
function withVisits(
  seed: number,
  room: number,
  visits: readonly (readonly [number, string, number])[]
): GameState {
  const rng = createRng(seed);
  const s = step(newGame(rng), 60 * 10, rng);
  const entries: StoryletEntry[] = [...visits]
    .sort((a, b) => a[0] - b[0])
    .map(([elapsed, storyletId, text]) => ({
      t: s.t - elapsed,
      kind: "",
      storyletId,
      roles: { a: { id: 99, sei: "試験", room } },
      variant: { text, slots: {} },
    }));
  return { ...s, log: [...entries, ...s.log] };
}

const suitCount = (s: GameState) => {
  const { ctx, rects } = recordingCtx();
  drawCollector(ctx, s, 1000);
  return suitRects(rects).length;
};

describe("C8: 取り立て屋が「去った」言い回しでは人影を出さない", () => {
  it("1. 30 分前の cover[1]（下りていった）では null で、黒い背広の塗りが 0 件", () => {
    const s = withVisits(1, 3, [[30, "collector-cover", 1]]);
    expect(collectorVisit(s)).toBeNull();
    expect(suitCount(s)).toBe(0);
  });
  it("2. 30 分前の cover[0]（まだいる）では非 null で、位置はドアの前", () => {
    const s = withVisits(1, 3, [[30, "collector-cover", 0]]);
    const v = collectorVisit(s);
    expect(v).not.toBeNull();
    expect(v!.walking).toBe(false);
    expect(Math.abs(v!.x - doorX(3))).toBeLessThanOrEqual(5);
    expect(suitCount(s)).toBeGreaterThan(0);
  });
  it("3. 5 分前の note[0] と note[1] ではどちらも null（置いて去った）", () => {
    for (const text of [0, 1]) {
      const s = withVisits(2, 4, [[5, "collector-note", text]]);
      expect(collectorVisit(s), `note[${text}]`).toBeNull();
      expect(suitCount(s), `note[${text}]`).toBe(0);
    }
  });
  it("4. 40 分前に knock、10 分前に cover[1] があれば null（古い knock にさかのぼらない）", () => {
    const s = withVisits(3, 3, [
      [40, "collector-knock", 0],
      [10, "collector-cover", 1],
    ]);
    expect(collectorVisit(s)).toBeNull();
  });
  it("5. 10 分前に cover[1]、5 分前に knock があれば非 null（新しい来訪が優先）", () => {
    const s = withVisits(3, 3, [
      [10, "collector-cover", 1],
      [5, "collector-knock", 0],
    ]);
    expect(collectorVisit(s)).not.toBeNull();
  });
  it("6. 範囲外の variant（5）は 0 番として扱う（cover[0] は去っていないので非 null）", () => {
    const s = withVisits(4, 3, [[30, "collector-cover", 5]]);
    expect(collectorVisit(s)).not.toBeNull();
  });
  it("10. knock / hide / shout / stairs の全言い回しでは、30 分前に置くと非 null", () => {
    for (const id of [
      "collector-knock",
      "collector-hide",
      "collector-shout",
      "collector-stairs",
    ]) {
      const st = defaultContent.storylets.find((x) => x.id === id)!;
      for (let text = 0; text < st.texts.length; text++) {
        const s = withVisits(5, 3, [[30, id, text]]);
        expect(collectorVisit(s), `${id}[${text}]`).not.toBeNull();
      }
    }
  });
  it("追加: 範囲外の variant は 0 番として去ったかを判定する（0 番が去る定義のとき）", () => {
    const content: Content = {
      ...defaultContent,
      storylets: defaultContent.storylets.map((x) =>
        x.id === "collector-cover" ? { ...x, visitorGone: [0] } : x
      ),
    };
    const s = withVisits(4, 3, [[30, "collector-cover", 5]]);
    expect(collectorVisit(s, content)).toBeNull();
  });
  it("追加: 定義が見つからない collector- の出来事は去ったことにしない", () => {
    const s = withVisits(4, 3, [[30, "collector-unknown", 0]]);
    expect(collectorVisit(s)).not.toBeNull();
  });
});
