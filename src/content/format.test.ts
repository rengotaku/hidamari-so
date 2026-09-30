// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import * as prettier from "prettier";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");
const contentPath = (name: string) => path.join(root, "content", name);

/** prettier --check と同じ判定（設定は .prettierrc の overrides まで解決する） */
async function isFormatted(filepath: string, source: string): Promise<boolean> {
  const config = await prettier.resolveConfig(filepath);
  return prettier.check(source, { ...config, filepath });
}

describe("content/*.json の整形（#38）", () => {
  const targets = ["archetypes.json", "traits.json", "town.json"];

  it.each(targets)("%s は prettier の整形済み（format:check が通る）", async (name) => {
    const file = contentPath(name);
    expect(await isFormatted(file, readFileSync(file, "utf8"))).toBe(true);
  });

  it("package.json の format / format:check が 3 ファイルを対象にしている", () => {
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    for (const script of ["format", "format:check"]) {
      for (const name of targets) {
        expect(pkg.scripts[script]).toContain(`content/${name}`);
      }
      // 差分が膨らむので storylets と decor は入れない
      expect(pkg.scripts[script]).not.toContain("storylets");
      expect(pkg.scripts[script]).not.toContain("decor");
    }
  });

  describe("negative control: 崩した archetypes.json は整形済みと判定されない", () => {
    const file = contentPath("archetypes.json");
    const source = readFileSync(file, "utf8");

    it("arc 行と decor 行を 1 行に戻すと落ちる", async () => {
      const broken = source.replace(/("arc": "[^"]+",)\n\s+("decor":)/, "$1    $2");
      expect(broken).not.toBe(source);
      expect(await isFormatted(file, broken)).toBe(false);
    });

    it("配列を展開すると落ちる", async () => {
      const broken = source.replace(/"traits": \[([^\]]*)\]/, (_m, inner: string) => {
        const items = inner.split(",").map((s) => `      ${s.trim()}`);
        return `"traits": [\n${items.join(",\n")}\n    ]`;
      });
      expect(broken).not.toBe(source);
      expect(await isFormatted(file, broken)).toBe(false);
    });
  });

  describe("archetypes.json", () => {
    const source = readFileSync(contentPath("archetypes.json"), "utf8");
    const archetypes = JSON.parse(source) as Array<Record<string, unknown>>;

    it('同じ行に 4 つの空白で続くキー（`",    "`）が無い', () => {
      expect(source.split("\n").filter((l) => l.includes('",    "'))).toHaveLength(0);
    });

    it("18 件すべてで arc が decor より前にある", () => {
      expect(archetypes).toHaveLength(18);
      for (const a of archetypes) {
        const keys = Object.keys(a);
        expect(keys.indexOf("arc"), String(a.id)).toBeGreaterThanOrEqual(0);
        expect(keys.indexOf("arc"), String(a.id)).toBeLessThan(keys.indexOf("decor"));
      }
    });
  });
});
