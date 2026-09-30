import { describe, it, expect } from "vitest";
import { createRng, newGame } from "@/sim";
import {
  holdBubbles,
  bubbleHoldMs,
  type HeldBubbles,
  type Pos,
  bubbleAnchors,
  screenKey,
} from "@/ui/bubbles";

type R = Parameters<typeof holdBubbles>[1][number];
const res = (text: string | null, until: number, id = 1): R => ({
  id,
  bubble: text === null ? null : { text, until },
});
const EMPTY: HeldBubbles = new Map();
const P: Pos = { x: 10, y: 20 };
/** 住人 1・2 の位置が取れている状態（既定） */
const AT: ReadonlyMap<number, Pos | null> = new Map([
  [1, P],
  [2, P],
]);
const hold = (
  prev: HeldBubbles,
  rs: readonly R[],
  t: number,
  nowMs: number,
  anchors: ReadonlyMap<number, Pos | null> = AT
) => holdBubbles(prev, rs, t, nowMs, anchors);

describe("holdBubbles", () => {
  it("B1 15 倍でも読める時間は残る", () => {
    const a = hold(EMPTY, [res("ただいま", 10)], 5, 0);
    const b = hold(a.held, [res("ただいま", 10)], 100, 1000);
    expect(b.visible.get(1)?.text).toBe("ただいま");
  });

  it("B2 読める時間が過ぎたら消える", () => {
    const a = hold(EMPTY, [res("ただいま", 10)], 5, 0);
    const b = hold(a.held, [res("ただいま", 10)], 100, bubbleHoldMs("ただいま") + 1);
    expect(b.visible.has(1)).toBe(false);
  });

  it("B3 次のセリフが来ても、読める時間が過ぎるまで今のを残す", () => {
    const a = hold(EMPTY, [res("ただいま", 10)], 5, 0);
    const b = hold(a.held, [res("おやすみ", 110)], 100, 500);
    expect(b.visible.get(1)?.text).toBe("ただいま");
    const shownAt = bubbleHoldMs("ただいま") + 1;
    const c = hold(b.held, [res("おやすみ", 110)], 105, shownAt);
    expect(c.visible.get(1)?.text).toBe("おやすみ");
    const d = hold(
      c.held,
      [res("おやすみ", 110)],
      200,
      shownAt + bubbleHoldMs("おやすみ") - 1
    );
    expect(d.visible.get(1)?.text).toBe("おやすみ");
  });

  it("B4 同じ文でも言い直しなら数え直す", () => {
    const a = hold(EMPTY, [res("ただいま", 10)], 5, 0);
    const b = hold(a.held, [res("ただいま", 300)], 290, 2000);
    expect(b.visible.get(1)?.text).toBe("ただいま");
    const c = hold(
      b.held,
      [res("ただいま", 300)],
      400,
      2000 + bubbleHoldMs("ただいま") - 1
    );
    expect(c.visible.get(1)?.text).toBe("ただいま");
  });

  it("B5 ゲーム内で有効なら実時間に関係なく出す（停止中など）", () => {
    const a = hold(EMPTY, [res("…", 10)], 5, 0);
    const b = hold(a.held, [res("…", 10)], 5, 60_000);
    expect(b.visible.get(1)?.text).toBe("…");
  });

  it("B6 いなくなった住人は出さない", () => {
    const a = hold(EMPTY, [res("ただいま", 10)], 5, 0);
    const b = hold(a.held, [], 100, 1000);
    expect(b.visible.has(1)).toBe(false);
    expect(b.held.has(1)).toBe(false);
  });

  it("B7 bubble が無い住人は出さない", () => {
    const a = hold(EMPTY, [res(null, 0)], 5, 0);
    expect(a.visible.has(1)).toBe(false);
    expect(a.held.has(1)).toBe(false);
  });

  it("B8 prev を書き換えない", () => {
    const a = hold(EMPTY, [res("ただいま", 10), res("やあ", 10, 2)], 5, 0);
    const before = [...a.held.entries()].map(([k, v]) => [k, { ...v }]);
    hold(a.held, [res("おやすみ", 110)], 100, 500);
    expect([...a.held.entries()]).toEqual(before);
  });

  it("B10 間のセリフは出さない", () => {
    const a = hold(EMPTY, [res("ただいま", 10)], 5, 0);
    const b = hold(a.held, [res("A", 20)], 15, 300);
    const c = hold(b.held, [res("B", 30)], 25, 600);
    const seen = [a, b, c].map((x) => x.visible.get(1)?.text);
    expect(seen).toEqual(["ただいま", "ただいま", "ただいま"]);
    const d = hold(c.held, [res("B", 30)], 26, bubbleHoldMs("ただいま") + 1);
    expect(d.visible.get(1)?.text).toBe("B");
    expect(seen).not.toContain("A");
  });

  it("B11 until だけ同じで文が違えば新しいセリフ", () => {
    const a = hold(EMPTY, [res("ただいま", 10)], 5, 0);
    const b = hold(a.held, [res("おかえり", 10)], 6, 1000);
    expect(b.visible.get(1)?.text).toBe("ただいま");
    const c = hold(b.held, [res("おかえり", 10)], 7, bubbleHoldMs("ただいま") + 1);
    expect(c.visible.get(1)?.text).toBe("おかえり");
  });

  it("B12 読み込み直後にゲーム内で期限切れのセリフは出さない", () => {
    const a = hold(EMPTY, [res("ただいま", 10)], 10, 0);
    expect(a.visible.has(1)).toBe(false);
    const b = hold(EMPTY, [res("ただいま", 11)], 10, 0);
    expect(b.visible.get(1)?.text).toBe("ただいま");
  });

  it("B13 位置が取れない間は数え始めない", () => {
    const NONE = new Map<number, Pos | null>([[1, null]]);
    const a = hold(EMPTY, [res("ちょっとコンビニ", 10)], 5, 0, NONE);
    expect(a.visible.has(1)).toBe(false);
    const b = hold(a.held, [res("ちょっとコンビニ", 10)], 100, 1_000_000, NONE);
    expect(b.visible.has(1)).toBe(false);
    expect(b.held.get(1)?.shownAt).toBeNull();
    const start = 2_000_000;
    const c = hold(b.held, [res("ちょっとコンビニ", 10)], 100, start);
    expect(c.visible.get(1)?.text).toBe("ちょっとコンビニ");
    const d = hold(
      c.held,
      [res("ちょっとコンビニ", 10)],
      100,
      start + bubbleHoldMs("ちょっとコンビニ") - 1
    );
    expect(d.visible.get(1)?.text).toBe("ちょっとコンビニ");
    const e = hold(
      d.held,
      [res("ちょっとコンビニ", 10)],
      100,
      start + bubbleHoldMs("ちょっとコンビニ")
    );
    expect(e.visible.has(1)).toBe(false);
  });

  it("B14 位置が取れなくなっても、読める時間までは最後の位置で出る", () => {
    const NONE = new Map<number, Pos | null>([[1, null]]);
    const last: Pos = { x: 33, y: 44 };
    const a = hold(EMPTY, [res("銭湯行ってこよ", 10)], 5, 0, new Map([[1, last]]));
    expect(a.visible.get(1)).toEqual({ text: "銭湯行ってこよ", pos: last });
    const b = hold(a.held, [res("銭湯行ってこよ", 10)], 100, 500, NONE);
    expect(b.visible.get(1)).toEqual({ text: "銭湯行ってこよ", pos: last });
    const c = hold(
      b.held,
      [res("銭湯行ってこよ", 10)],
      100,
      bubbleHoldMs("銭湯行ってこよ") - 1,
      NONE
    );
    expect(c.visible.get(1)?.pos).toEqual(last);
    const d = hold(
      c.held,
      [res("銭湯行ってこよ", 10)],
      100,
      bubbleHoldMs("銭湯行ってこよ"),
      NONE
    );
    expect(d.visible.has(1)).toBe(false);
  });

  it("B15 大写しで別の部屋の住人のセリフは、全体図に戻った時点から数え始める", () => {
    const s = newGame(createRng(7));
    const inRoom = s.res.filter((x) => typeof x.at === "number");
    const a = inRoom[0];
    const other = inRoom.find((x) => x.at !== a.at)!;
    const withB = {
      ...s,
      res: s.res.map((x) =>
        x.id === other.id ? { ...x, bubble: { text: "おやすみ", until: s.t + 100 } } : x
      ),
    };
    const closeup = { phase: "closeup", room: a.at as number } as never;
    const away = bubbleAnchors(withB, closeup);
    expect(away.get(other.id) ?? null).toBeNull();
    const h1 = holdBubbles(EMPTY, withB.res, withB.t, 0, away);
    expect(h1.visible.has(other.id)).toBe(false);
    const h2 = holdBubbles(h1.held, withB.res, withB.t, 100_000, away);
    expect(h2.visible.has(other.id)).toBe(false);
    const back = bubbleAnchors(withB, { phase: "overview" } as never);
    const h3 = holdBubbles(h2.held, withB.res, withB.t, 200_000, back);
    expect(h3.visible.get(other.id)?.text).toBe("おやすみ");
    const h4 = holdBubbles(
      h3.held,
      withB.res,
      withB.t + 500,
      200_000 + bubbleHoldMs("おやすみ") - 1,
      back
    );
    expect(h4.visible.get(other.id)?.text).toBe("おやすみ");
  });
  /** 住人 a が部屋にいて、別の部屋 room2 もある状態。a が言っている */
  const scene = () => {
    const s = newGame(createRng(7));
    const inRoom = s.res.filter((x) => typeof x.at === "number");
    const a = inRoom[0];
    const other = inRoom.find((x) => x.at !== a.at)!;
    const state = {
      ...s,
      res: s.res.map((x) =>
        x.id === a.id ? { ...x, bubble: { text: "ただいま", until: s.t + 100 } } : x
      ),
    };
    return { state, a, roomA: a.at as number, roomB: other.at as number };
  };
  const at = (
    state: ReturnType<typeof scene>["state"],
    prev: HeldBubbles,
    zoom: { phase: string; room: number | null },
    nowMs: number
  ) => {
    const z = { ...zoom, since: 0 } as never;
    return holdBubbles(
      prev,
      state.res,
      state.t,
      nowMs,
      bubbleAnchors(state, z),
      screenKey(z)
    );
  };

  it("B16a 描く前に画面を離れて戻ったら、戻った時点から数える", () => {
    const { state, a, roomB } = scene();
    const h1 = at(state, EMPTY, { phase: "closeup", room: roomB }, 0);
    expect(h1.visible.has(a.id)).toBe(false);
    expect(h1.held.get(a.id)?.shownAt).toBeNull();
    const start = 100_000;
    const h2 = at(state, h1.held, { phase: "overview", room: null }, start);
    expect(h2.visible.has(a.id)).toBe(true);
    expect(h2.held.get(a.id)?.shownAt).toBe(start);
    const h3 = at(
      state,
      h2.held,
      { phase: "overview", room: null },
      start + bubbleHoldMs("ただいま") - 1
    );
    expect(h3.visible.has(a.id)).toBe(true);
  });

  it("B16b 描いて読む途中で画面を離れたら、戻った時点から数え直す", () => {
    const { state, a, roomB } = scene();
    const h1 = at(state, EMPTY, { phase: "overview", room: null }, 0);
    expect(h1.visible.has(a.id)).toBe(true);
    expect(h1.held.get(a.id)?.shownAt).toBe(0);
    const h2 = at(state, h1.held, { phase: "zooming", room: roomB }, 100);
    expect(h2.visible.has(a.id)).toBe(false);
    const h3 = at(state, h2.held, { phase: "closeup", room: roomB }, 200);
    expect(h3.visible.has(a.id)).toBe(false);
    expect(h3.held.get(a.id)?.shownAt).toBeNull();
    expect(h3.held.get(a.id)?.pos).toBeNull();
    const start = 100_000;
    const h4 = at(state, h3.held, { phase: "overview", room: null }, start);
    expect(h4.visible.has(a.id)).toBe(true);
    const h5 = at(
      state,
      h4.held,
      { phase: "overview", room: null },
      start + bubbleHoldMs("ただいま") - 1
    );
    expect(h5.visible.has(a.id)).toBe(true);
  });

  it("B17 大写しで描いた吹き出しは、全体図へ戻る遷移中は出ない", () => {
    const { state, a, roomA } = scene();
    const h1 = at(state, EMPTY, { phase: "closeup", room: roomA }, 0);
    expect(h1.visible.has(a.id)).toBe(true);
    const h2 = at(state, h1.held, { phase: "returning", room: roomA }, 100);
    expect(h2.visible.has(a.id)).toBe(false);
    const h3 = at(state, h2.held, { phase: "returning", room: roomA }, 300);
    expect(h3.visible.has(a.id)).toBe(false);
  });

  it("B18 読み終えて期限切れになったセリフは、大写しにして全体図に戻っても出ない", () => {
    const { state, a, roomA } = scene();
    const h1 = at(state, EMPTY, { phase: "overview", room: null }, 0);
    expect(h1.visible.has(a.id)).toBe(true);
    const late = bubbleHoldMs("ただいま") + 1000;
    const expired = { ...state, t: state.t + 101 };
    const atExp = (
      prev: HeldBubbles,
      zoom: { phase: string; room: number | null },
      ms: number
    ) => at(expired, prev, zoom, ms);
    const h2 = atExp(h1.held, { phase: "overview", room: null }, late);
    expect(h2.visible.has(a.id)).toBe(false);
    const h3 = atExp(h2.held, { phase: "closeup", room: roomA }, late + 100);
    expect(h3.visible.has(a.id)).toBe(false);
    const h4 = atExp(h3.held, { phase: "overview", room: null }, late + 200);
    expect(h4.visible.has(a.id)).toBe(false);
    const h5 = atExp(h4.held, { phase: "overview", room: null }, late + 100_000);
    expect(h5.visible.has(a.id)).toBe(false);
  });
});
