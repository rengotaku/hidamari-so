import { describe, it, expect } from "vitest";
import readme from "../../content/README.md?raw";
import { defaultContent, type Content } from "@/content";
import {
  createRng,
  isBuyoutPending,
  newGame,
  step,
  type GameState,
  type StoryletEntry,
} from "@/sim";

const DAY = 1440;

/** 記念日の 2 時間前の状態（開始から 54 日の 120 分前） */
function nearAnniversary(seed: number): {
  s: GameState;
  rng: ReturnType<typeof createRng>;
} {
  const rng = createRng(seed);
  const s = step(newGame(rng), 54 * DAY - 120, rng);
  expect(isBuyoutPending(s)).toBe(false);
  return { s, rng };
}

describe("記念日が立った瞬間に step が止まる", () => {
  it("刻み 2 分・30 分・一度に 240 分のどれで進めても、記念日が立った時点の状態が一致する", () => {
    const seed = 2026;
    const run = (chunk: number) => {
      const { s, rng } = nearAnniversary(seed);
      let cur = s;
      for (let i = 0; i < 400 && !isBuyoutPending(cur); i++) cur = step(cur, chunk, rng);
      return cur;
    };
    const a = run(2);
    expect(isBuyoutPending(a)).toBe(true);
    expect(a.t - a.t0).toBe(54 * DAY);
    for (const chunk of [30, 240]) {
      const b = run(chunk);
      expect(b.t, `刻み ${chunk}`).toBe(a.t);
      expect(b).toEqual(a);
    }
  });

  it("記念日の一言を言った住人は、ダイアログが開く時点でまだ住んでいる（多くの種で確認）", () => {
    for (let seed = 1; seed <= 12; seed++) {
      const { s, rng } = nearAnniversary(seed);
      const at = step(s, 240, rng);
      expect(isBuyoutPending(at), `seed ${seed}`).toBe(true);
      expect(at.t - at.t0, `seed ${seed}`).toBe(54 * DAY);
      const voice = at.buyout.voice;
      if (voice) expect(at.res.some((r) => r.id === voice.roles.a?.id)).toBe(true);
    }
  });
});

describe("家賃は 1 部屋につき 1 回だけ集金する", () => {
  /** 2 日目 9:58 の状態。次の 2 分で家賃の集金日（10 時）になる。x は id が小さい方 */
  function beforeRentDay(share: boolean, yMoney: number) {
    const rng = createRng(77);
    const s = newGame(rng);
    const [x, y] = [...s.res.slice(0, 2)].sort((p, q) => p.id - q.id) as [
      (typeof s.res)[number],
      (typeof s.res)[number],
    ];
    for (const r of s.res) r.money = 1_000_000;
    y.job = "konbini"; // 仕送りの無い種類
    y.money = yMoney;
    if (share) {
      s.rooms[y.room] = null;
      y.room = x.room;
    }
    s.t = DAY + 9 * 60 + 58;
    s.lastHour = Math.floor(s.t / 60);
    return { s, rng, x, y };
  }
  const lateOnly: Content = {
    ...defaultContent,
    storylets: defaultContent.storylets
      .filter((st) => st.id === "rent-late-excuse")
      .map((st) => ({ ...st, chance: 1, cooldownDays: undefined })),
  };
  const collected = (c: ReturnType<typeof beforeRentDay>): number =>
    step(c.s, 2, c.rng, { content: lateOnly }).landlordMoney - c.s.landlordMoney;

  it("同棲前は 2 人分、同棲後は同じ部屋の 2 人で 1 人分（差は家賃 1 人分）", () => {
    const dA = collected(beforeRentDay(false, 1_000_000));
    const dB = collected(beforeRentDay(true, 1_000_000));
    expect(dA - dB).toBe(28000);
  });

  it("同じ部屋の id が小さい方だけが払い、もう一方は持ち金 0 でも滞納の日誌が出ない", () => {
    const b = beforeRentDay(true, 0);
    const after = step(b.s, 2, b.rng, { content: lateOnly });
    const late = after.log.filter(
      (e): e is StoryletEntry => "storyletId" in e && e.storyletId === "rent-late-excuse"
    );
    expect(late.some((e) => e.roles.a?.id === b.y.id)).toBe(false);
    // 別々の部屋なら、同じ持ち金 0 で滞納の日誌が出る（この検証が空振りでないこと）
    const a = beforeRentDay(false, 0);
    const afterA = step(a.s, 2, a.rng, { content: lateOnly });
    expect(
      afterA.log.some(
        (e) =>
          "storyletId" in e &&
          e.storyletId === "rent-late-excuse" &&
          e.roles.a?.id === a.y.id
      )
    ).toBe(true);
  });
});

describe("本文と効果の一致・README", () => {
  it("結婚祝いの宴会の本文は財布やお金に触れない（効果が財布を動かさないため）", () => {
    const st = defaultContent.storylets.find((x) => x.id === "wedding-party")!;
    expect(st.effects.some((e) => e.type === "adjust" && e.stat === "money")).toBe(false);
    for (const t of st.texts) expect(t).not.toMatch(/財布|円|お金|所持金/);
  });

  it("README が足した項目（恋の段階・効果・条件・trigger・タグ）に追従している", () => {
    for (const word of [
      "cohabiting",
      "`purse`",
      "`away`",
      "`cohabit`",
      "`party`",
      "`age`",
      "`mood`",
      "`single`",
      "ゲーム開始からの日数",
      "`rent-late`",
      "`arc-only`",
    ])
      expect(readme, word).toContain(word);
    expect(readme).toMatch(/none.*crush.*dating.*cohabiting.*married/s);
    // 削除した trigger が表に残っていない
    expect(readme).not.toContain("`move-in`");
  });
});
