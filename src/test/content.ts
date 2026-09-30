import { defaultContent, type Content } from "@/content";

/**
 * 指定した種類だけが初期住人・新入居者の抽選に残る content を返す。
 * 指定しなかった種類は消さず、tags に arc-only を足して抽選から外す
 * （転職先や arc の参照先を残すため）。元の content は書き換えない。
 */
export function onlyJobs(
  ids: readonly string[],
  base: Content = defaultContent
): Content {
  const archetypes = Object.fromEntries(
    Object.entries(base.archetypes).map(([id, a]) => [
      id,
      ids.includes(id) || a.tags.includes("arc-only")
        ? a
        : { ...a, tags: [...a.tags, "arc-only"] },
    ])
  );
  return { ...base, archetypes };
}
