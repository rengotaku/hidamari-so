import { describe, it, expect } from "vitest";
import {
  DECOR_CAPACITY,
  MOVING_BOX_ID,
  archetypeSchema,
  contentErrors,
  decorSchema,
  defaultContent,
  parseContent,
  type Content,
} from "@/content";
import archetypesJson from "../../content/archetypes.json";
import decorJson from "../../content/decor.json";
import traitsJson from "../../content/traits.json";

const storyletFiles = import.meta.glob<unknown>("../../content/storylets/*.json", {
  import: "default",
  eager: true,
});

describe("F1: decor.json と全 archetype をスキーマで検証する", () => {
  it("decor.json の全件と archetypes.json の全件がスキーマを通る", () => {
    expect(decorJson.length).toBeGreaterThan(0);
    for (const d of decorJson) expect(decorSchema.safeParse(d).error).toBeUndefined();
    for (const a of archetypesJson)
      expect(archetypeSchema.safeParse(a).error).toBeUndefined();
  });

  it("archetype が参照する装飾 id は、すべて decor.json に存在する", () => {
    const ids = new Set(decorJson.map((d) => d.id));
    let refs = 0;
    for (const a of archetypesJson)
      for (const id of [...a.decor.required, ...a.decor.pool]) {
        refs++;
        expect(ids.has(id), `${a.id} の ${id}`).toBe(true);
      }
    expect(refs).toBeGreaterThan(20);
    // 読み込み済みのコンテンツ全体の整合（参照・置き場所の数）にも誤りが無い
    expect(contentErrors(defaultContent)).toEqual([]);
  });

  it("装飾 id が存在しない偽データ・未知のフィールドはエラーになる", () => {
    const bogus = archetypesJson.map((a, i) =>
      i === 0 ? { ...a, decor: { ...a.decor, pool: [...a.decor.pool, "no-such"] } } : a
    );
    expect(() =>
      parseContent({
        archetypes: bogus,
        traits: traitsJson,
        decor: decorJson,
        storylets: Object.values(storyletFiles).flat(),
      })
    ).toThrow(/no-such/);
    expect(decorSchema.safeParse({ ...decorJson[0], bogus: 1 }).success).toBe(false);
  });
});

describe("追加: 装飾の部品の検証", () => {
  it("箱が部品の枠を出ている・色が不正な部品は通らない", () => {
    const ok = decorJson[0]!;
    expect(decorSchema.safeParse({ ...ok, w: 1 }).success).toBe(false);
    expect(
      decorSchema.safeParse({ ...ok, boxes: [[0, 0, 0, 1, 1, 1, "red"]] }).success
    ).toBe(false);
    expect(decorSchema.safeParse({ ...ok, slot: "sky" }).success).toBe(false);
  });

  it("段ボールの部品がある", () => {
    expect(defaultContent.decor[MOVING_BOX_ID]).toBeDefined();
  });

  it("最悪の抽選でも置き場所の数を超える種類があれば参照エラーになる", () => {
    const floorIds = Object.values(defaultContent.decor)
      .filter((d) => d.slot === "floor" && d.id !== MOVING_BOX_ID)
      .map((d) => d.id);
    expect(floorIds.length).toBeGreaterThan(DECOR_CAPACITY.floor);
    const arch = defaultContent.archetypes.band!;
    const over: Content = {
      ...defaultContent,
      archetypes: {
        ...defaultContent.archetypes,
        band: {
          ...arch,
          decor: {
            required: floorIds.slice(0, DECOR_CAPACITY.floor + 1),
            pool: [],
            pick: [0, 0],
          },
        },
      },
    };
    expect(contentErrors(over).join("\n")).toContain("置き場所");
  });
});
