import { describe, it, expect } from "vitest";
import { createRng, newGame, type Point, type Resident } from "@/sim";
import { applyDrawPositions, createDrawPositions, updateDrawPositions } from "./smooth";

const base = (): Resident => newGame(createRng(1)).res[0]!;

const inRoom = (x: number): Resident => ({ ...base(), at: 0, x, y: 100, tx: x });

const PATH: Point[] = [
  [0, 100],
  [100, 100],
  [100, 200],
];

/** 経路 PATH を、先頭から arc ドット進んだところにいる歩行中の住人 */
const walkerAt = (arc: number, hurry = false): Resident => {
  const onFirst = arc <= 100;
  return {
    ...base(),
    at: "walking",
    path: PATH,
    pi: onFirst ? 1 : 2,
    x: onFirst ? arc : 100,
    y: onFirst ? 100 : 100 + (arc - 100),
    hurry,
  };
};

const drawn = (dp: ReturnType<typeof createDrawPositions>, r: Resident): Resident =>
  applyDrawPositions([r], dp)[0]!;

describe("描く位置（#68 事前設計）", () => {
  it("S1: 部屋の中でゲームの中の x が 60 ドット進んでも、0.5 秒後の描く x の進みは 4 ドット以下（0 より大きい）", () => {
    const first = updateDrawPositions(createDrawPositions(), [inRoom(100)], 0);
    const next = updateDrawPositions(first, [inRoom(160)], 0.5);
    const moved = drawn(next, inRoom(160)).x - 100;
    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeLessThanOrEqual(4);
  });

  it("S1': 外の道でゲームの中の位置が経路に沿って 100 ドット進んでも、1 秒後の描く位置の進みは 12 ドット以下で、経路の線分の上", () => {
    const first = updateDrawPositions(createDrawPositions(), [walkerAt(0)], 0);
    const next = updateDrawPositions(first, [walkerAt(100)], 1);
    const d = drawn(next, walkerAt(100));
    expect(d.x).toBeGreaterThan(0);
    expect(d.x).toBeLessThanOrEqual(12);
    expect(d.y).toBeCloseTo(100, 6);
  });

  it("S1' 追加: 急ぎ（hurry）のときの上限は 26 ドット/秒", () => {
    const first = updateDrawPositions(createDrawPositions(), [walkerAt(0, true)], 0);
    const next = updateDrawPositions(first, [walkerAt(100, true)], 1);
    expect(drawn(next, walkerAt(100, true)).x).toBeCloseTo(26, 6);
  });

  it("S1' 追加: 階段の角は経路どおりに曲がる（一直線に突っ切らない）", () => {
    let dp = updateDrawPositions(createDrawPositions(), [walkerAt(0)], 0);
    // ゲームの中は経路の終わり近く（弧長 190）。描く側は 12 ドット/秒で 9 秒追う
    for (let i = 0; i < 90; i++) dp = updateDrawPositions(dp, [walkerAt(190)], 0.1);
    const d = drawn(dp, walkerAt(190));
    // 弧長 108。角（100,100）を過ぎて、x は 100 のまま y だけ進んでいる
    expect(d.x).toBeCloseTo(100, 6);
    expect(d.y).toBeCloseTo(108, 6);
  });

  it("S2: 1 倍の速さで進むと、描く位置はゲームの中の位置と一致する（部屋の中・外の道）", () => {
    // 部屋の中は 8 ドット/秒、外の道は 12 ドット/秒（1 倍の歩き）
    let room = updateDrawPositions(createDrawPositions(), [inRoom(100)], 0);
    let road = updateDrawPositions(createDrawPositions(), [walkerAt(0)], 0);
    for (let i = 1; i <= 10; i++) {
      room = updateDrawPositions(room, [inRoom(100 + i * 0.8)], 0.1);
      road = updateDrawPositions(road, [walkerAt(i * 1.2)], 0.1);
    }
    expect(Math.abs(drawn(room, inRoom(108)).x - 108)).toBeLessThan(0.5);
    const d = drawn(road, walkerAt(12));
    expect(Math.abs(d.x - 12)).toBeLessThan(0.5);
    expect(d.y).toBeCloseTo(100, 6);
  });

  it("S3: at が変わったら、次に描くときにゲームの中の位置へ一致する（部屋→歩行、歩行→部屋、歩行→外出）", () => {
    // 部屋 → 歩行
    let dp = updateDrawPositions(createDrawPositions(), [inRoom(100)], 0);
    dp = updateDrawPositions(dp, [walkerAt(80)], 0.01);
    expect(drawn(dp, walkerAt(80)).x).toBe(80);
    // 歩行 → 部屋（遠く離れていても）
    dp = updateDrawPositions(dp, [inRoom(60)], 0.01);
    expect(drawn(dp, inRoom(60)).x).toBe(60);
    // 部屋 → 歩行 → 外出（描かない。ゲームの中の値のまま）
    dp = updateDrawPositions(dp, [walkerAt(150)], 0.01);
    const out: Resident = { ...walkerAt(190), at: "out" };
    dp = updateDrawPositions(dp, [out], 0.01);
    const o = drawn(dp, out);
    expect([o.x, o.y]).toEqual([out.x, out.y]);
    // 外出 → 歩行（帰宅）は、部屋の前にすぐ現れる
    dp = updateDrawPositions(dp, [walkerAt(5)], 0.01);
    expect(drawn(dp, walkerAt(5)).x).toBe(5);
  });

  it("S6 の元: 時間が止まっていても、実時間が進めば描く位置は追いつく", () => {
    let dp = updateDrawPositions(createDrawPositions(), [inRoom(100)], 0);
    for (let i = 0; i < 20; i++) dp = updateDrawPositions(dp, [inRoom(160)], 0.5);
    expect(drawn(dp, inRoom(160)).x).toBe(160);
  });

  it("追加: 入力の住人は書き換えない（新しい配列を返す）", () => {
    const r = inRoom(100);
    const dp = updateDrawPositions(createDrawPositions(), [r], 0);
    const moved = { ...r, x: 160 };
    const dp2 = updateDrawPositions(dp, [moved], 0.5);
    const out = applyDrawPositions([moved], dp2);
    expect(moved.x).toBe(160);
    expect(out[0]).not.toBe(moved);
  });
});
