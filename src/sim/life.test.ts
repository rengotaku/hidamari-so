import { describe, it, expect } from "vitest";
import { defaultContent, type Content } from "@/content";
import {
  ROOM_COUNT,
  bondOf,
  composeEntry,
  composeParts,
  createRng,
  decideBuyout,
  isBuyoutPending,
  isEnded,
  newGame,
  nightScenes,
  step,
  type GameState,
  type LogEntry,
  type Rng,
} from "@/sim";

type StoryletEntry = Extract<LogEntry, { storyletId: string }>;
const DAY = 1440;

const storyletEntries = (s: GameState): StoryletEntry[] =>
  s.log.filter((e): e is StoryletEntry => "storyletId" in e);

/** 恋の筋だけを有効にした content（他の出来事・入居は起きない） */
const romanceOnly: Content = {
  ...defaultContent,
  storylets: defaultContent.storylets.filter((st) => st.kind === "romance"),
};

/** 50 年の記念日まで進めた状態（待っている間も時間は進む） */
function atAnniversary(seed: number): { s: GameState; rng: Rng } {
  const rng = createRng(seed);
  const s0 = newGame(rng);
  return { s: step(s0, 54 * DAY, rng), rng };
}

describe("C1: 恋の筋（片想い→付き合う→同棲→結婚）", () => {
  it("2 人の仲が最大なら 60 日以内に結婚まで進み、同棲の時点で片方の部屋が空室になる", () => {
    const rng = createRng(20261001);
    let s = newGame(rng, romanceOnly);
    const pair = s.res.filter(
      (r) => !defaultContent.archetypes[r.job]!.tags.includes("old")
    );
    const [x, y] = [pair[0]!, pair[1]!];
    x.age = 30;
    y.age = 30;
    const [lo, hi] = x.id < y.id ? [x.id, y.id] : [y.id, x.id];
    s.bonds = [{ a: lo, b: hi, affinity: 100, stage: "none" }];
    const roomsBefore = [x.room, y.room];
    const emptyBefore = s.rooms.filter((id) => id === null).length;

    const seen: string[] = [];
    let atCohabit: { rooms: (number | null)[]; shared: boolean } | null = null;
    for (let i = 0; i < 60 * 48; i++) {
      s = step(s, 30, rng, { content: romanceOnly });
      const stage = bondOf(s.bonds, x.id, y.id)?.stage;
      if (stage && stage !== seen[seen.length - 1]) {
        seen.push(stage);
        if (stage === "cohabiting") {
          const rx = s.res.find((r) => r.id === x.id)!;
          const ry = s.res.find((r) => r.id === y.id)!;
          atCohabit = { rooms: [...s.rooms], shared: rx.room === ry.room };
        }
      }
    }
    expect(seen).toEqual(
      expect.arrayContaining(["crush", "dating", "cohabiting", "married"])
    );
    const order = ["none", "crush", "dating", "cohabiting", "married"];
    const ranks = seen.map((st) => order.indexOf(st));
    expect([...ranks].sort((p, q) => p - q)).toEqual(ranks);
    expect(atCohabit).not.toBeNull();
    expect(atCohabit!.shared).toBe(true);
    const emptyAt = atCohabit!.rooms.filter((id) => id === null).length;
    expect(emptyAt).toBe(emptyBefore + 1);
    // 空いたのは 2 人の元の部屋のどちらか一方
    const freed = roomsBefore.filter((r) => atCohabit!.rooms[r] === null);
    expect(freed.length).toBe(1);
  });
});

describe("C2: 夜の場面は付き合っている段階以降だけ", () => {
  function together(stage: "crush" | "dating" | "cohabiting" | "married", t: number) {
    const s = newGame(createRng(77));
    const [a, b] = [s.res[0]!, s.res[1]!];
    a.at = a.room;
    a.visiting = false;
    b.at = a.room;
    b.visiting = true;
    s.t = t;
    s.bonds = [{ a: Math.min(a.id, b.id), b: Math.max(a.id, b.id), affinity: 80, stage }];
    return { s, room: a.room };
  }

  it("片想いの 2 人が同じ部屋にいる 23 時でも、夜の場面は発生しない", () => {
    expect(nightScenes(together("crush", 23 * 60).s)).toEqual([]);
  });

  it("追加: 付き合う・同棲・結婚なら 22 時〜 2 時に発生し、昼や別々の部屋では発生しない", () => {
    for (const stage of ["dating", "cohabiting", "married"] as const) {
      const { s, room } = together(stage, 23 * 60);
      expect(nightScenes(s).map((n) => n.room)).toEqual([room]);
      expect(nightScenes({ ...s, t: DAY + 60 }).length).toBe(1);
      expect(nightScenes({ ...s, t: 12 * 60 }).length).toBe(0);
      expect(nightScenes({ ...s, t: 2 * 60 }).length).toBe(0);
      s.res[1]!.at = s.res[1]!.room;
      s.res[1]!.visiting = false;
      expect(nightScenes(s).length).toBe(0);
    }
  });
});

describe("C3: 築 50 年の記念日", () => {
  it("開始から 54 日で記念日のフラグが立ち、その前日までは立たない", () => {
    const rng = createRng(3);
    const s0 = newGame(rng);
    const dayBefore = step(s0, 53 * DAY, rng);
    expect(isBuyoutPending(dayBefore)).toBe(false);
    const justBefore = step(dayBefore, DAY - 1, rng);
    expect(isBuyoutPending(justBefore)).toBe(false);
    expect(justBefore.buyout.phase).toBe("none");
    const onDay = step(justBefore, 1, rng);
    expect(onDay.t - onDay.t0).toBe(54 * DAY);
    expect(isBuyoutPending(onDay)).toBe(true);
  });

  it("追加: 記念日には買収の話と住人の一言が日誌に載り、ダイアログ用の一言が状態に残る", () => {
    const { s } = atAnniversary(3);
    const ids = storyletEntries(s).map((e) => e.storyletId);
    expect(ids).toContain("buyout-offer");
    expect(ids).toContain("buyout-voice");
    expect(s.buyout.voice).not.toBeNull();
    expect(composeEntry(defaultContent, s.buyout.voice!)).toContain("さん");
  });
});

describe("C4: 「売る」で結末", () => {
  it("結末状態になり、以後 step しても状態が進まない", () => {
    const { s, rng } = atAnniversary(4);
    expect(isBuyoutPending(s)).toBe(true);
    const sold = decideBuyout(s, "sell", rng);
    expect(sold.buyout.phase).toBe("sold");
    expect(isEnded(sold)).toBe(true);
    expect(storyletEntries(sold)[0]!.storyletId).toBe("buyout-sold");
    const later = step(sold, 10 * DAY, rng);
    expect(later).toEqual(sold);
    expect(later.t).toBe(sold.t);
    expect(isBuyoutPending(later)).toBe(false);
  });
});

describe("C5: 「断る」で続行", () => {
  it("状態が進み、記念日のフラグは再び立たない", () => {
    const { s, rng } = atAnniversary(5);
    const declined = decideBuyout(s, "decline", rng);
    expect(isBuyoutPending(declined)).toBe(false);
    const later = step(declined, 10 * DAY, rng);
    expect(later.t).toBe(declined.t + 10 * DAY);
    expect(isBuyoutPending(later)).toBe(false);
    expect(isEnded(later)).toBe(false);
    // 築年数が 50 を過ぎ続けても、もう立たない
    const muchLater = step(later, 40 * DAY, rng);
    expect(isBuyoutPending(muchLater)).toBe(false);
    expect(muchLater.buyout.phase).toBe("declined");
  });

  it("追加: 待っていないとき（まだ・済んだあと）の選択は何もしない", () => {
    const rng = createRng(6);
    const fresh = newGame(rng);
    expect(decideBuyout(fresh, "sell", rng)).toBe(fresh);
    const { s } = atAnniversary(6);
    const declined = decideBuyout(s, "decline", rng);
    expect(decideBuyout(declined, "sell", rng)).toBe(declined);
  });
});

describe("C6: 大家の所持金がマイナスでも続く", () => {
  it("30 日進めても例外が出ず、住人の出来事が起き続ける", () => {
    const rng = createRng(66);
    let s = newGame(rng);
    s.landlordMoney = -1_000_000;
    for (let block = 0; block < 3; block++) {
      const from = s.t;
      s = step(s, 10 * DAY, rng);
      const fresh = storyletEntries(s).filter((e) => e.t > from);
      expect(fresh.length, `${block + 1} 区画目`).toBeGreaterThan(0);
    }
    expect(s.t - s.t0).toBe(30 * DAY);
    expect(Number.isFinite(s.landlordMoney)).toBe(true);
    expect(s.res.length).toBeGreaterThan(0);
  });
});

describe("C7: 送別会のあとに退去し、出ていった住人の記録に残る", () => {
  it("送別会の日誌が出てから退去し、最後の出来事つきで記録される", () => {
    const rng = createRng(7);
    let s = newGame(rng);
    const target = s.res[0]!;
    s.booked.push({
      id: "farewell-party",
      at: s.t + 60,
      roles: { a: target.id },
      tries: 0,
    });
    for (let i = 0; i < 6 * 24 && s.res.some((r) => r.id === target.id); i++)
      s = step(s, 60, rng);
    expect(s.res.some((r) => r.id === target.id)).toBe(false);
    expect(s.rooms).not.toContain(target.id);
    const mine = storyletEntries(s).filter((e) => e.roles.a?.id === target.id);
    const party = mine.find((e) => e.storyletId === "farewell-party");
    const left = mine.find((e) => e.storyletId === "moveout-good");
    expect(party).toBeDefined();
    expect(left).toBeDefined();
    expect(party!.t).toBeLessThan(left!.t);
    const record = s.departed.find((d) => d.id === target.id);
    expect(record).toBeDefined();
    expect(record!.sei).toBe(target.sei);
    expect(record!.last?.storyletId).toBe("moveout-good");
    expect(record!.left).toBe(left!.t);
  });
});

describe("追加: 出来事の種類と人生の筋", () => {
  it("固定シードで 60 日進めた日誌に、恋・人生の筋・送別会・ハプニングが 1 件以上ある", () => {
    const rng = createRng(20261001);
    let s = newGame(rng);
    const counts = new Map<string, number>();
    const kindOf = new Map(defaultContent.storylets.map((st) => [st.id, st.kind]));
    let cursor = s.t;
    for (let i = 0; i < 60; i++) {
      s = step(s, DAY, rng);
      for (const e of storyletEntries(s))
        if (e.t > cursor) {
          const key =
            e.storyletId === "farewell-party" ? "farewell" : kindOf.get(e.storyletId)!;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      cursor = s.t;
    }
    // 日誌は新しい 120 件までなので、毎日の差分で数えている
    for (const key of ["romance", "arc", "farewell", "happening"])
      expect(counts.get(key) ?? 0, key).toBeGreaterThan(0);
  });

  it("追加: 出ていった人の名前は日誌の本文から取り出せ（ref）、本文はもとの文と一致する", () => {
    const entry: StoryletEntry = {
      t: 100,
      kind: "",
      storyletId: "visit-gift",
      roles: { a: { id: 1, sei: "佐藤", room: 0 }, b: { id: 2, sei: "鈴木", room: 1 } },
      variant: { text: 0, slots: { gift: 1 } },
    };
    const parts = composeParts(defaultContent, entry)!;
    expect(parts.filter((p) => p.ref).map((p) => p.ref!.id)).toEqual([1, 2]);
    expect(parts.map((p) => p.text).join("")).toBe(composeEntry(defaultContent, entry));
    expect(composeParts(defaultContent, { t: 1, kind: "day" })).toBeNull();
  });

  it("追加: 同棲の片方が出ていっても、部屋は残った人のものになり表が食い違わない", () => {
    const rng = createRng(88);
    const s0 = newGame(rng, romanceOnly);
    const [x, y] = [s0.res[0]!, s0.res[1]!];
    x.age = 30;
    y.age = 30;
    const [lo, hi] = x.id < y.id ? [x.id, y.id] : [y.id, x.id];
    s0.bonds = [{ a: lo, b: hi, affinity: 100, stage: "none" }];
    let s = s0;
    for (let i = 0; i < 40 * 48; i++) {
      s = step(s, 30, rng, { content: romanceOnly });
      for (const r of s.res) {
        expect(
          s.rooms[r.room] === r.id ||
            s.res.some((o) => o.room === r.room && s.rooms[r.room] === o.id)
        ).toBe(true);
      }
    }
    expect(s.rooms.length).toBe(ROOM_COUNT);
  });
});
