import { describe, it, expect } from "vitest";
import { defaultContent, parseContent, townChangeSchema } from "@/content";

const base = {
  id: "t",
  slot: "east",
  startYear: 0,
  chance: 1,
  stages: [
    { look: "lot" },
    { look: "fence", afterDays: 0 },
    { look: "mansion", afterDays: 5 },
  ],
};

describe("H3: 町並みの変化データ", () => {
  it("content/town.json の全件がスキーマを通り、段階は順序どおり", () => {
    expect(defaultContent.town.length).toBeGreaterThan(0);
    for (const t of defaultContent.town) {
      expect(() => townChangeSchema.parse(t)).not.toThrow();
      const days = t.stages.slice(1).map((s) => s.afterDays!);
      for (let i = 1; i < days.length; i++)
        expect(days[i]!).toBeGreaterThan(days[i - 1]!);
    }
  });

  it("段階の順序が逆転したデータは弾かれる", () => {
    expect(townChangeSchema.safeParse(base).success).toBe(true);
    const reversed = {
      ...base,
      stages: [
        { look: "lot" },
        { look: "fence", afterDays: 5 },
        { look: "mansion", afterDays: 1 },
      ],
    };
    expect(townChangeSchema.safeParse(reversed).success).toBe(false);
  });

  it("追加: 同じ日に 2 段階進む・最初の段階に日数がある・未知の look・数字入りの log は弾かれる", () => {
    const bad = [
      {
        ...base,
        stages: [
          { look: "lot" },
          { look: "fence", afterDays: 2 },
          { look: "mansion", afterDays: 2 },
        ],
      },
      {
        ...base,
        stages: [
          { look: "lot", afterDays: 0 },
          { look: "fence", afterDays: 1 },
        ],
      },
      { ...base, stages: [{ look: "lot" }, { look: "castle", afterDays: 1 }] },
      {
        ...base,
        stages: [{ look: "lot" }, { look: "fence", afterDays: 1, log: "3軒建った" }],
      },
      { ...base, stages: [{ look: "lot" }] },
      { ...base, extra: 1 },
    ];
    for (const b of bad) expect(townChangeSchema.safeParse(b).success).toBe(false);
  });

  it("追加: parseContent は town の id 重複を拒否する", () => {
    const raw = {
      archetypes: [],
      traits: [],
      storylets: [],
    };
    expect(() => parseContent({ ...raw, town: [base, base] })).toThrow();
  });
});
