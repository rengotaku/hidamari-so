import { describe, it, expect } from "vitest";

// sim 層のソース（テスト以外）を生の文字列として読む
const modules = import.meta.glob<string>(["./*.ts", "!./*.test.ts"], {
  query: "?raw",
  import: "default",
  eager: true,
});
const sources = Object.entries(modules);

describe("追加: シミュレーション層の純粋性", () => {
  it("ソースが 1 つ以上ある", () => {
    expect(sources.length).toBeGreaterThan(5);
  });

  for (const [file, code] of sources) {
    it(`${file} は React・DOM・Canvas・Math.random・Date.now に依存しない`, () => {
      expect(code).not.toMatch(/from\s+["']react/);
      expect(code).not.toMatch(/from\s+["']@\/(ui|render|save)/);
      expect(code).not.toMatch(
        /\b(document|window|localStorage|HTMLCanvasElement|CanvasRenderingContext2D)\b/
      );
      expect(code).not.toMatch(/Math\.random\s*\(/);
      expect(code).not.toMatch(/Date\.now\s*\(/);
      expect(code).not.toMatch(/new Date\s*\(/);
    });
  }
});
