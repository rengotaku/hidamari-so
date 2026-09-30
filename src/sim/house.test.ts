import { describe, it, expect } from "vitest";
import { defaultContent, type Content } from "@/content";
import {
  composeEntry,
  createRng,
  newGame,
  planDecor,
  roomNo,
  step,
  SETTLE_MIN,
  START_BOXES,
  type GameState,
  type LogEntry,
  type SeededRng,
} from "@/sim";
import type { Ctx } from "@/sim/context";
import { makeResident } from "@/sim/init";
import { fireStorylet } from "@/sim/storylets";
import { storyletSchema } from "@/content";

/** 大家の出来事（room-*）に、退去・装飾の増減を起こす出来事を足したコンテンツ */
const extra = [
  {
    id: "leave",
    kind: "happening",
    trigger: "book",
    roles: { a: {} },
    texts: ["{a}さんが出ていった"],
    effects: [{ type: "moveOut", role: "a" }],
  },
  {
    id: "gain",
    kind: "happening",
    trigger: "book",
    roles: { a: {} },
    texts: ["{a}さんの部屋に物が増えた"],
    effects: [{ type: "decorAdd", role: "a", decor: "fan" }],
  },
  {
    id: "lose",
    kind: "happening",
    trigger: "book",
    roles: { a: {} },
    texts: ["{a}さんの部屋から物が減った"],
    effects: [{ type: "decorRemove", role: "a", decor: "fan" }],
  },
].map((x) => storyletSchema.parse(x));
const content: Content = {
  ...defaultContent,
  storylets: [
    ...defaultContent.storylets.filter((st) => st.id.startsWith("room-")),
    ...extra,
  ],
};

const fresh = (seed: number): { s: GameState; rng: SeededRng } => {
  const rng = createRng(seed);
  return { s: newGame(rng, content), rng };
};

/** 出来事 id を指定して、住人 a に起こす（状態は複製して返す） */
function fireOn(s: GameState, rng: SeededRng, id: string, residentId: number): GameState {
  const next = structuredClone(s);
  const c: Ctx = { s: next, rng, quiet: true, content };
  const a = next.res.find((r) => r.id === residentId)!;
  expect(fireStorylet(c, id, { a })).toBe(true);
  return next;
}

const go = (s: GameState, rng: SeededRng, minutes: number): GameState =>
  step(s, minutes, rng, { content });

/** cond が真になるまで minutes 分ずつ進める（上限を超えたら null） */
function until(
  s: GameState,
  rng: SeededRng,
  cond: (s: GameState) => boolean,
  limitDays: number,
  minutes = 1
): GameState | null {
  let cur = s;
  for (let i = 0; i < (limitDays * 1440) / minutes; i++) {
    if (cond(cur)) return cur;
    cur = go(cur, rng, minutes);
  }
  return cond(cur) ? cur : null;
}

const entries = (s: GameState, id: string) =>
  s.log.filter(
    (e): e is Extract<LogEntry, { storyletId: string }> =>
      "storyletId" in e && e.storyletId === id
  );

describe("F2: 同じ種類でも、住人ごとに違う装飾の組み合わせになる", () => {
  it("band の住人をシード 1〜10 で生成すると、3 通り以上の組み合わせが出る", () => {
    const combos = new Set<string>();
    for (let seed = 1; seed <= 10; seed++) {
      const { s, rng } = fresh(seed);
      const c: Ctx = { s, rng, quiet: true, content };
      const r = makeResident(c, 99, "band");
      combos.add([...r.decorPlan].sort().join(","));
      // 必ず置くものは、どの住人にも入っている
      for (const id of defaultContent.archetypes.band!.decor.required)
        expect(r.decorPlan).toContain(id);
    }
    expect(combos.size).toBeGreaterThanOrEqual(3);
  });

  it("追加: 抽選は候補の中から重複なく選び、同じシードなら同じ結果になる", () => {
    const arch = defaultContent.archetypes.student!;
    const a = planDecor(createRng(7), arch);
    const b = planDecor(createRng(7), arch);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
    const n = a.length - arch.decor.required.length;
    expect(n).toBeGreaterThanOrEqual(arch.decor.pick[0]);
    expect(n).toBeLessThanOrEqual(arch.decor.pick[1]);
    for (const id of a)
      expect([...arch.decor.required, ...arch.decor.pool]).toContain(id);
  });

  it("追加: 最初から住んでいる住人の部屋には、装飾がそろっている", () => {
    const { s } = fresh(3);
    for (const r of s.res) {
      expect(s.decor[r.room]!.items.sort()).toEqual([...r.decorPlan].sort());
      expect(s.decor[r.room]!.boxes).toBe(0);
    }
  });
});

describe("F3: 退去のあと、大家が片付けて部屋が募集中になる", () => {
  it("片付けが終わると、装飾が空になり、募集中の部屋として日誌にも残る", () => {
    const { s: s0, rng } = fresh(11);
    const who = s0.res[0]!;
    const room = who.room;
    const left = fireOn(s0, rng, "leave", who.id);
    // 退去直後は荷物が残っていて、片付け待ち
    expect(left.rooms[room]).toBeNull();
    expect(left.decor[room]!.items.length).toBeGreaterThan(0);
    expect(left.vacancies).toHaveLength(1);
    expect(left.vacancies[0]!.cleared).toBe(false);

    const done = until(left, rng, (x) => x.vacancies.every((v) => v.cleared), 3, 10);
    expect(done).not.toBeNull();
    const cleaned = done!;
    expect(cleaned.decor[room]).toEqual({ items: [], boxes: 0 });
    expect(cleaned.rooms[room]).toBeNull();
    const v = cleaned.vacancies.find((x) => x.room === room)!;
    expect(v.cleared).toBe(true);
    // 日誌: 大家が {room} 号室を片付けた
    const [e] = entries(cleaned, "room-cleared");
    expect(e).toBeDefined();
    expect(composeEntry(content, e!)).toContain("大家");
    expect(composeEntry(content, e!)).toContain(String(roomNo(room)));
  });

  it("追加: 大家は夜中の退去でも動き出さず、日中(8〜19 時)になってから動く", () => {
    const hourOfT = (t: number) => (t / 60) % 24;
    // 動き出し(idle でなくなった瞬間)の時刻を返す。上限は 1 日半
    const startOf = (from: GameState, rng: SeededRng) => {
      let cur = from;
      for (let i = 0; i < 36 * 60; i++) {
        cur = go(cur, rng, 1);
        if (cur.landlord.phase !== "idle") return cur;
      }
      return null;
    };
    // 退去を起こす時刻: 夜中の 0〜7 時と 20〜23 時、それに日中の 12 時
    for (const [seed, hour] of [
      [12, 0],
      [13, 3],
      [14, 6.5],
      [15, 20],
      [16, 22.5],
      [17, 12],
    ] as const) {
      const { s: s0, rng } = fresh(seed);
      // 開始(17 時)から、退去させたい時刻まで進める
      let s = s0;
      while (Math.abs(hourOfT(s.t) - hour) > 1e-6) s = go(s, rng, 0.5);
      const vacatedHour = hourOfT(s.t);
      const left = fireOn(s, rng, "leave", s.res[0]!.id);
      // 片付けに向かう動き出し
      const up = startOf(left, rng);
      expect(up, `退去 ${vacatedHour} 時`).not.toBeNull();
      expect(up!.landlord.phase).toBe("up");
      const h = hourOfT(up!.t);
      expect(h, `退去 ${vacatedHour} 時の動き出し`).toBeGreaterThanOrEqual(8);
      expect(h).toBeLessThan(19 + 1 / 60);
      // 夜中の退去なら、動き出しは必ず退去より後(同じ夜のうちに動いていない)
      if (hour < 8 || hour >= 19) expect(up!.t - left.t).toBeGreaterThan(30);
    }
    // 入居の日が夜中に来ていても、連れてくるのは日中になってから
    for (const hour of [1, 5, 21]) {
      const { s: s0, rng } = fresh(18);
      const left = fireOn(s0, rng, "leave", s0.res[0]!.id);
      const cleared = until(
        left,
        rng,
        (x) => x.vacancies.every((v) => v.cleared),
        3,
        10
      )!;
      let s = cleared;
      while (Math.abs(hourOfT(s.t) - hour) > 1e-6 || s.landlord.phase !== "idle")
        s = go(s, rng, 0.5);
      s = { ...s, vacancies: s.vacancies.map((v) => ({ ...v, moveInAt: s.t })) };
      const esc = startOf(s, rng);
      expect(esc, `入居日 ${hour} 時`).not.toBeNull();
      expect(esc!.landlord.phase).toBe("escort");
      const h = hourOfT(esc!.t);
      expect(h).toBeGreaterThanOrEqual(8);
      expect(h).toBeLessThan(19 + 1 / 60);
    }
  });
});

describe("F4: 入居した住人の部屋は、1 日ほどかけて装飾が 1 つずつ増える", () => {
  it("0 から段階的に増え、段ボールが減り、ゲーム内 1 日前後でセットがそろう", () => {
    const { s: s0, rng } = fresh(21);
    const room = s0.res[0]!.room;
    const left = fireOn(s0, rng, "leave", s0.res[0]!.id);
    const arrived = until(left, rng, (x) => x.rooms[room] !== null, 8)!;
    expect(arrived).not.toBeNull();
    const r = arrived.res.find((x) => x.room === room)!;
    const total = r.decorPlan.length;
    expect(total).toBeGreaterThanOrEqual(4);
    // 入居の瞬間: 装飾は 0、段ボールだけ
    expect(arrived.decor[room]!.items).toHaveLength(0);
    expect(arrived.decor[room]!.boxes).toBe(START_BOXES);
    expect(entries(arrived, "room-move-in")).toHaveLength(1);

    let cur = arrived;
    const counts: number[] = [];
    const boxes: number[] = [];
    let fullAt: number | null = null;
    for (let i = 0; i < 2 * 1440; i++) {
      cur = go(cur, rng, 1);
      const d = cur.decor[room]!;
      counts.push(d.items.length);
      boxes.push(d.boxes);
      if (fullAt === null && d.items.length === total) fullAt = cur.t - r.since;
    }
    // 途中で一気に全部出ない: 1 分ごとの増加は 1 つまで、途中の段階を通る
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]! - counts[i - 1]!).toBeLessThanOrEqual(1);
      expect(counts[i]!).toBeGreaterThanOrEqual(counts[i - 1]!);
      expect(boxes[i]!).toBeLessThanOrEqual(boxes[i - 1]!);
    }
    expect(new Set(counts.filter((n) => n > 0 && n < total)).size).toBeGreaterThanOrEqual(
      3
    );
    // 1 日前後でそろう（前半のうちにそろってもいけない）
    expect(fullAt).not.toBeNull();
    expect(fullAt!).toBeGreaterThanOrEqual(SETTLE_MIN * 0.8);
    expect(fullAt!).toBeLessThanOrEqual(SETTLE_MIN * 1.2);
    // 半日時点ではまだ半分程度、段ボールも残っている
    expect(counts[720]!).toBeLessThan(total);
    expect(boxes[720]!).toBeGreaterThan(0);
    // そろったら段ボールは無く、中身は住人の装飾のセットと一致し、日誌に残る
    expect(cur.decor[room]!.boxes).toBe(0);
    expect([...cur.decor[room]!.items].sort()).toEqual([...r.decorPlan].sort());
    expect(entries(cur, "room-settled")).toHaveLength(1);
  });
});

describe("F5: 片付けの途中で次の入居が決まっても、片付けが終わってから入居する", () => {
  it("前の住人の装飾は新しい住人の部屋に残らない", () => {
    const { s: s0, rng } = fresh(31);
    const who = s0.res[0]!;
    const room = who.room;
    const oldSet = new Set(who.decorPlan);
    const left = fireOn(s0, rng, "leave", who.id);
    // 大家が部屋に入って片付けている最中まで進める
    let cur = until(
      left,
      rng,
      (x) => x.landlord.phase === "clearing" && x.landlord.room === room,
      3
    )!;
    expect(cur).not.toBeNull();
    expect(cur.vacancies[0]!.cleared).toBe(false);
    // 片付けの途中で、入居がいますぐに決まる
    cur = { ...cur, vacancies: cur.vacancies.map((v) => ({ ...v, moveInAt: cur.t })) };

    const log: string[] = [];
    let arrived: GameState | null = null;
    for (let i = 0; i < 3 * 1440; i++) {
      cur = go(cur, rng, 1);
      // 連れてくる段階に入ったときは、必ず片付けが終わっている
      if (cur.landlord.phase === "escort")
        expect(cur.vacancies.find((v) => v.room === room)!.cleared).toBe(true);
      if (cur.landlord.phase === "clearing") expect(cur.rooms[room]).toBeNull();
      log.push(cur.landlord.phase);
      if (cur.rooms[room] !== null) {
        arrived = cur;
        break;
      }
    }
    expect(arrived).not.toBeNull();
    // 片付け → 連れてくる → 入居 の順
    expect(log).toContain("clearing");
    expect(log.indexOf("escort")).toBeGreaterThan(log.lastIndexOf("clearing"));
    const a = arrived!;
    expect(a.decor[room]!.items).toHaveLength(0);
    for (const id of a.decor[room]!.items) expect(oldSet.has(id)).toBe(false);
    expect(a.decor[room]!.boxes).toBe(START_BOXES);
    // 日誌でも、片付けが入居より先（日誌は新しい順）
    const iClear = a.log.findIndex(
      (e) => "storyletId" in e && e.storyletId === "room-cleared"
    );
    const iMove = a.log.findIndex(
      (e) => "storyletId" in e && e.storyletId === "room-move-in"
    );
    expect(iClear).toBeGreaterThan(iMove);
    expect(iMove).toBeGreaterThanOrEqual(0);
    // 部屋と住人の表も食い違わない
    const newcomer = a.res.find((r) => r.room === room)!;
    expect(a.rooms[room]).toBe(newcomer.id);
    expect(newcomer.id).not.toBe(who.id);
    // 模様替えが終わると、部屋にあるのは新しい住人のセットだけ（前の住人の物は残らない）
    const settled = until(a, rng, (x) => x.decor[room]!.boxes === 0, 2, 10)!;
    expect([...settled.decor[room]!.items].sort()).toEqual(
      [...newcomer.decorPlan].sort()
    );
  });
});

describe("追加: 出来事による装飾の増減", () => {
  it("decorAdd で部屋に装飾が足され、decorRemove で外れて、これから置く予定からも消える", () => {
    const { s: s0, rng } = fresh(41);
    const who = s0.res.find((r) => !r.decorPlan.includes("fan"))!;
    const added = fireOn(s0, rng, "gain", who.id);
    expect(added.decor[who.room]!.items).toContain("fan");
    // 二度足しても重複しない
    const twice = fireOn(added, rng, "gain", who.id);
    expect(twice.decor[who.room]!.items.filter((x) => x === "fan")).toHaveLength(1);
    const removed = fireOn(twice, rng, "lose", who.id);
    expect(removed.decor[who.room]!.items).not.toContain("fan");

    const other = s0.res.find((r) => r.decorPlan.includes("fan"));
    if (other) {
      const r2 = fireOn(s0, rng, "lose", other.id);
      const after = r2.res.find((r) => r.id === other.id)!;
      expect(after.decorPlan).not.toContain("fan");
      expect(after.settled).toBe(after.decorPlan.length);
    }
  });
});

describe("追加: 退去が重なっても壊れない", () => {
  it("二部屋が同時に空いても、大家は順に片付けて入居させ、部屋と住人の表が食い違わない", () => {
    const { s: s0, rng } = fresh(51);
    const [a, b] = s0.res;
    let s = fireOn(s0, rng, "leave", a!.id);
    s = fireOn(s, rng, "leave", b!.id);
    expect(s.vacancies).toHaveLength(2);
    for (let i = 0; i < 12 * 288; i++) {
      s = go(s, rng, 5);
      for (const r of s.res) expect(s.rooms[r.room]).toBe(r.id);
      s.rooms.forEach((id) => {
        if (id !== null) expect(s.res.some((r) => r.id === id)).toBe(true);
      });
    }
    // 十二日後には二部屋とも新しい住人が入り、大家は手が空いている
    expect(s.vacancies).toEqual([]);
    expect(s.landlord.phase).toBe("idle");
    expect(s.rooms[a!.room]).not.toBeNull();
    expect(s.rooms[b!.room]).not.toBeNull();
    expect(entries(s, "room-cleared")).toHaveLength(2);
    expect(entries(s, "room-move-in")).toHaveLength(2);
    expect(new Set(s.res.map((r) => r.id)).size).toBe(s.res.length);
  });
});
