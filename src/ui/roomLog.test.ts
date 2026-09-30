import { describe, it, expect } from "vitest";
import {
  createRng,
  newGame,
  step,
  type GameState,
  type LogEntry,
  type StoryletEntry,
} from "@/sim";
import { roomLog } from "./roomLog";

const ref = (id: number, room: number) => ({ id, sei: "試験", room });
const variant = { text: 0, slots: {} };
const entry = (
  t: number,
  storyletId: string,
  roles: StoryletEntry["roles"],
  kind: StoryletEntry["kind"] = ""
): StoryletEntry => ({
  t,
  kind,
  storyletId,
  roles,
  variant,
});
const names = (log: readonly LogEntry[]) =>
  log.map((e) => ("storyletId" in e ? e.storyletId : e.kind));

function played(seed: number, days: number): { s: GameState } {
  const rng = createRng(seed);
  let s = newGame(rng);
  for (let i = 0; i < days * 24; i++) s = step(s, 60, rng);
  return { s };
}

describe("大写し中の日誌", () => {
  it("G6: その部屋で起きた出来事だけが並ぶ（ほかの部屋の出来事・日付・町の変化は出ない）", () => {
    const { s } = played(31337, 12);
    expect(s.log.length).toBeGreaterThan(30);
    let checked = 0;
    for (let room = 0; room < 6; room++) {
      const shown = roomLog(s.log, room);
      for (const e of shown) {
        expect(e.kind === "day" || e.kind === "town").toBe(false);
        const roles = "roles" in e ? Object.values(e.roles) : [];
        expect(roles.some((r) => r && r.room === room)).toBe(true);
        checked++;
      }
      // 絞り込みなので全体より少ない
      expect(shown.length).toBeLessThan(s.log.length);
    }
    expect(checked).toBeGreaterThan(0);
    // 全部屋の合計で、全体のうち登場人物のいる出来事だけが含まれる
    const all = new Set<unknown>();
    for (let room = 0; room < 6; room++) for (const e of roomLog(s.log, room)) all.add(e);
    expect(all.size).toBeLessThan(s.log.length);
  });

  it("追加: 順序（新しい順）を保つ。どの行にも出てこない部屋は空になる", () => {
    const { s } = played(31337, 12);
    for (let room = 0; room < 6; room++) {
      const shown = roomLog(s.log, room);
      for (let i = 1; i < shown.length; i++)
        expect(shown[i - 1]!.t).toBeGreaterThanOrEqual(shown[i]!.t);
    }
    // どの行にも出てこない部屋番号は空になる
    expect(roomLog(s.log, 99)).toEqual([]);
  });
});

describe("追加: 役割 a / b のどちらで登場しても、その部屋の日誌に入る（住人の表に依らない）", () => {
  const log: LogEntry[] = [
    {
      t: 50,
      kind: "",
      storyletId: "x5",
      roles: { a: ref(11, 0), b: ref(22, 1) },
      variant,
    },
    { t: 40, kind: "", storyletId: "x4", roles: { b: ref(22, 1) }, variant },
    { t: 30, kind: "", storyletId: "x3", roles: { a: ref(11, 0) }, variant },
    {
      t: 20,
      kind: "",
      storyletId: "x2",
      roles: { a: ref(33, 2), b: ref(44, 3) },
      variant,
    },
    { t: 10, kind: "day" },
  ];
  const idsOf = (room: number) =>
    roomLog(log, room).map((e) => ("storyletId" in e ? e.storyletId : e.kind));

  it("b だけが部屋 1 の出来事（x4）も、a だけが部屋 0 の出来事（x3）も含まれる", () => {
    expect(idsOf(1)).toEqual(["x5", "x4"]);
    expect(idsOf(0)).toEqual(["x5", "x3"]);
  });

  it("別の部屋の出来事は、a でも b でも含まれない", () => {
    expect(idsOf(2)).toEqual(["x2"]);
    expect(idsOf(3)).toEqual(["x2"]);
    expect(idsOf(4)).toEqual([]);
  });
});

describe("C9: 大写しの日誌は、その部屋で起きた出来事（事前設計）", () => {
  it("1. 部屋 3 で id 3 が登場する 2 行は、新しい順のまま返る（res の中身には依存しない）", () => {
    const log: LogEntry[] = [
      entry(30, "p3", { a: ref(3, 3) }),
      entry(20, "other", { a: ref(9, 5) }),
      entry(10, "p1", { b: ref(3, 3) }),
    ];
    expect(names(roomLog(log, 3))).toEqual(["p3", "p1"]);
  });

  it("2. 転居の前の行は部屋 1 だけ、後の行は部屋 4 だけに出る。同棲の出来事の行は両方の部屋に出る", () => {
    const log: LogEntry[] = [
      entry(30, "after", { a: ref(7, 4) }),
      entry(20, "cohabit", { a: ref(7, 4), b: ref(8, 1) }, "move"),
      entry(10, "before", { a: ref(7, 1) }),
    ];
    expect(names(roomLog(log, 1))).toEqual(["cohabit", "before"]);
    expect(names(roomLog(log, 4))).toEqual(["after", "cohabit"]);
  });

  it("3. a の部屋が 0、b の部屋が 1 の行は部屋 0 と 1 にだけ出る。day と town の行はどの部屋にも出ない", () => {
    const log: LogEntry[] = [
      { t: 40, kind: "town", changeId: "x", stage: 1 },
      entry(30, "pair", { a: ref(1, 0), b: ref(2, 1) }),
      { t: 20, kind: "day" },
    ];
    for (let room = 0; room < 6; room++)
      expect(names(roomLog(log, room))).toEqual(room === 0 || room === 1 ? ["pair"] : []);
  });

  it("4. room-cleared の行（a は退去者の記録で、部屋 3）は部屋 3 に出る", () => {
    const log: LogEntry[] = [entry(10, "room-cleared", { a: ref(5, 3) })];
    expect(names(roomLog(log, 3))).toEqual(["room-cleared"]);
    expect(roomLog(log, 2)).toEqual([]);
  });

  it("5. 統合: 住人のいる部屋で退去させても、退去の直後の件数は直前以上で、退去の行（kind=move）を含む", () => {
    const rng = createRng(31337);
    let s = newGame(rng);
    for (let i = 0; i < 10 * 24; i++) s = step(s, 60, rng);
    // 状態を作る: いちばん出来事の多い部屋の住人に退去を予約する（シードで退去を引き当てない）
    const room = s.res
      .map((r) => r.room)
      .sort((x, y) => roomLog(s.log, y).length - roomLog(s.log, x).length)[0]!;
    const target = s.res.find((r) => r.room === room)!;
    const beforeLen = roomLog(s.log, room).length;
    expect(beforeLen).toBeGreaterThan(0);
    s.booked = [{ id: "moveout-good", at: s.t + 60, roles: { a: target.id }, tries: 0 }];
    for (let i = 0; i < 3 && s.res.some((r) => r.id === target.id); i++)
      s = step(s, 60, rng);
    expect(s.res.some((r) => r.id === target.id)).toBe(false);
    const after = roomLog(s.log, room);
    expect(after.length).toBeGreaterThanOrEqual(beforeLen);
    expect(after.some((e) => e.kind === "move")).toBe(true);
  });
});
