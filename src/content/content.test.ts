import { describe, it, expect } from "vitest";
import {
  archetypeSchema,
  defaultContent,
  parseContent,
  storyletSchema,
  traitSchema,
} from "@/content";

// content/ 配下の JSON を生のまま読む（B1 は「ファイルそのもの」を検証する）
const files = import.meta.glob<unknown>("../../content/**/*.json", {
  import: "default",
  eager: true,
});
const fileEntries = Object.entries(files);

const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : [v]);
const storyletFiles = fileEntries.filter(([p]) => p.includes("/content/storylets/"));
const only = (name: string): unknown =>
  fileEntries.find(([p]) => p.endsWith(`/content/${name}`))?.[1];

describe("B1: content/ 配下の全 JSON をスキーマで検証する", () => {
  it("archetypes.json・traits.json・storylets/*.json が存在する", () => {
    expect(only("archetypes.json")).toBeDefined();
    expect(only("traits.json")).toBeDefined();
    expect(storyletFiles.length).toBeGreaterThan(0);
  });

  it("全件がスキーマを通る", () => {
    for (const a of asList(only("archetypes.json")))
      expect(archetypeSchema.safeParse(a).error).toBeUndefined();
    for (const t of asList(only("traits.json")))
      expect(traitSchema.safeParse(t).error).toBeUndefined();
    for (const [, f] of storyletFiles)
      for (const s of asList(f))
        expect(storyletSchema.safeParse(s).error).toBeUndefined();
  });

  it("未知のフィールドを 1 つ足した偽データはエラーになる", () => {
    const arche = asList(only("archetypes.json"))[0] as object;
    const trait = asList(only("traits.json"))[0] as object;
    const story = asList(storyletFiles[0]![1])[0] as object;
    expect(archetypeSchema.safeParse({ ...arche, bogus: 1 }).success).toBe(false);
    expect(traitSchema.safeParse({ ...trait, bogus: 1 }).success).toBe(false);
    expect(storyletSchema.safeParse({ ...story, bogus: 1 }).success).toBe(false);
  });

  it("追加: 読み込み済みのコンテンツ全体が相互参照も含めて整合している", () => {
    expect(Object.keys(defaultContent.archetypes).length).toBeGreaterThanOrEqual(4);
    expect(defaultContent.storylets.length).toBeGreaterThan(0);
    const raw = {
      archetypes: only("archetypes.json"),
      traits: only("traits.json"),
      storylets: storyletFiles.flatMap(([, f]) => asList(f)),
    };
    expect(() => parseContent(raw)).not.toThrow();
  });
});

describe("B2: 本文の差し込みは宣言した役割・値だけを使う", () => {
  it("{a} {b} は roles に宣言があり、その他の差し込みも宣言済みの名前だけ", () => {
    const builtin = new Set(["room", "act", "shift"]);
    for (const st of defaultContent.storylets) {
      for (const text of st.texts) {
        for (const m of text.matchAll(/\{([A-Za-z0-9]+)\}/g)) {
          const name = m[1]!;
          if (name === "a" || name === "b") {
            expect(st.roles[name], `${st.id}: {${name}} が未宣言`).toBeDefined();
          } else {
            const known =
              builtin.has(name) ||
              name in (st.numbers ?? {}) ||
              name in (st.choices ?? {});
            expect(known, `${st.id}: {${name}} が未宣言`).toBe(true);
          }
          if (name === "room")
            expect(st.roles.a, `${st.id}: {room} は a が要る`).toBeDefined();
        }
      }
    }
  });

  it("追加: 宣言していない役割を使う偽データはスキーマが拒否する", () => {
    const base = {
      id: "fake",
      kind: "daily",
      trigger: "hour",
      roles: { a: {} },
      texts: ["{a}さんと{b}さん"],
    };
    expect(storyletSchema.safeParse(base).success).toBe(false);
    expect(storyletSchema.safeParse({ ...base, texts: ["{a}さん"] }).success).toBe(true);
  });
});

describe("追加: 内容の規約", () => {
  it("本文に数字（算用数字・全角数字）が無い", () => {
    for (const st of defaultContent.storylets) {
      const all = [...st.texts, ...Object.values(st.choices ?? {}).flat()];
      for (const t of all) expect(t, st.id).not.toMatch(/[0-9０-９]/);
    }
  });

  it("追加: 未知の archetype を参照する条件は parseContent が拒否する", () => {
    const raw = {
      archetypes: Object.values(defaultContent.archetypes),
      traits: Object.values(defaultContent.traits),
      storylets: [
        {
          id: "bad",
          kind: "daily",
          trigger: "hour",
          roles: { a: { archetype: ["no-such-job"] } },
          texts: ["{a}さん"],
        },
      ],
    };
    expect(() => parseContent(raw)).toThrow();
  });

  it("追加: id の重複は parseContent が拒否する", () => {
    const st = {
      id: "dup",
      kind: "daily",
      trigger: "hour",
      texts: ["何かあった"],
    };
    expect(() =>
      parseContent({
        archetypes: Object.values(defaultContent.archetypes),
        traits: Object.values(defaultContent.traits),
        storylets: [st, st],
      })
    ).toThrow();
  });
});
