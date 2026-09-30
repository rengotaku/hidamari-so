import { describe, it, expect } from "vitest";
import { defaultContent } from "@/content";
import { createRng, newGame } from "@/sim";
import { onlyJobs } from "./content";

describe("onlyJobs: テスト用の content", () => {
  const ids = ["salaryman", "konbini", "band", "ronin"] as const;

  it("初期住人の種類は指定した種類だけで、archetypes のキー数は元と同じ", () => {
    const content = onlyJobs(ids);
    expect(Object.keys(content.archetypes).length).toBe(
      Object.keys(defaultContent.archetypes).length
    );
    for (let seed = 1; seed <= 10; seed++) {
      const s = newGame(createRng(seed), content);
      for (const r of s.res) expect(ids).toContain(r.job);
    }
  });

  it("元の defaultContent を書き換えない", () => {
    const before = JSON.stringify(defaultContent.archetypes);
    onlyJobs(ids);
    expect(JSON.stringify(defaultContent.archetypes)).toBe(before);
    expect(defaultContent.archetypes.mangaka!.tags).not.toContain("arc-only");
  });
});
