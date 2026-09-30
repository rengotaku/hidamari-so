import { z } from "zod";
import archetypesJson from "../../content/archetypes.json";
import traitsJson from "../../content/traits.json";
import {
  archetypeSchema,
  contentErrors,
  storyletSchema,
  traitSchema,
  type Content,
} from "./schema";

export * from "./schema";

export interface RawContent {
  archetypes: unknown;
  traits: unknown;
  /** storylet の配列（1 ファイルに複数件でも 1 件でもよい） */
  storylets: unknown;
}

const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : [v]);

function indexById<T extends { id: string }>(
  kind: string,
  items: T[]
): Record<string, T> {
  const out: Record<string, T> = {};
  for (const it of items) {
    if (it.id in out) throw new Error(`${kind} の id が重複している: ${it.id}`);
    out[it.id] = it;
  }
  return out;
}

/** 生の JSON を検証して Content にする。不正なら例外（CI・起動時に必ず落ちる） */
export function parseContent(raw: RawContent): Content {
  const archetypes = z.array(archetypeSchema).parse(asList(raw.archetypes));
  const traits = z.array(traitSchema).parse(asList(raw.traits));
  const storylets = z.array(storyletSchema).parse(asList(raw.storylets));
  const dup = new Set<string>();
  for (const s of storylets) {
    if (dup.has(s.id)) throw new Error(`storylet の id が重複している: ${s.id}`);
    dup.add(s.id);
  }
  const content: Content = {
    archetypes: indexById("archetype", archetypes),
    traits: indexById("trait", traits),
    storylets,
  };
  const errs = contentErrors(content);
  if (errs.length > 0) throw new Error(`content の参照エラー:\n${errs.join("\n")}`);
  return content;
}

const storyletFiles = import.meta.glob<unknown>("../../content/storylets/*.json", {
  import: "default",
  eager: true,
});

/** ビルド時に content/ を取り込み、読み込み時に検証する */
export const defaultContent: Content = parseContent({
  archetypes: archetypesJson,
  traits: traitsJson,
  storylets: Object.keys(storyletFiles)
    .sort()
    .flatMap((p) => asList(storyletFiles[p])),
});
