import { defaultContent } from "@/content";

/** 保存の封筒（{schemaVersion, savedAt, rngState, state}）を JSON のまま扱う */
type Raw = Record<string, unknown>;

const isRecord = (v: unknown): v is Raw =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** 版 1 を版 2 にしたとき、古い日誌の代わりに入れる出来事（content/ の storylet） */
export const NOTEBOOK_REPLACED_ID = "notebook-replaced";

/**
 * v1 → v2: 日誌を「組み立て済みの文字列」から「出来事の構造」に変えた版。
 * 住人・時刻・部屋などはそのまま引き継ぐ。文字列だけの古い日誌は構造にできないので捨て、
 * 代わりに「日誌を新しいノートに替えた」出来事を 1 件入れる。
 * 種類・癖の id が今の content に無ければ、知っている値に寄せる。
 */
function v1ToV2(env: Raw): Raw {
  const state = env.state;
  if (!isRecord(state)) throw new Error("state が無い");
  const archetypeIds = Object.keys(defaultContent.archetypes);
  const traitIds = new Set(Object.keys(defaultContent.traits));
  const res = Array.isArray(state.res) ? state.res : [];
  const fixedRes = res.map((r: unknown) => {
    if (!isRecord(r)) return r;
    const job =
      typeof r.job === "string" && Object.hasOwn(defaultContent.archetypes, r.job)
        ? r.job
        : archetypeIds[0]!;
    const traits = Array.isArray(r.traits)
      ? r.traits.filter((t): t is string => typeof t === "string" && traitIds.has(t))
      : [];
    return { ...r, job, traits };
  });
  const t = typeof state.t === "number" ? state.t : 0;
  return {
    ...env,
    schemaVersion: 2,
    state: {
      ...state,
      res: fixedRes,
      log: [
        {
          t,
          kind: "",
          storyletId: NOTEBOOK_REPLACED_ID,
          roles: {},
          variant: { text: 0, slots: {} },
        },
      ],
      bonds: [],
      booked: [],
      story: { last: { [NOTEBOOK_REPLACED_ID]: t }, done: [NOTEBOOK_REPLACED_ID] },
    },
  };
}

/** 登録表: 版 N の保存を版 N+1 にする関数。版を上げるときはここに 1 件足す */
export const MIGRATIONS: Readonly<Record<number, (env: Raw) => Raw>> = {
  1: v1ToV2,
};

/**
 * 古い版の保存を、最新の版まで 1 段ずつ移す。
 * 版が整数でない・1 未満・最新より新しい・途中の移行が無いときは null（呼び出し側で新規ゲームにする）。
 */
export function migrateSave(raw: unknown, latest: number): Raw | null {
  if (!isRecord(raw)) return null;
  let env: Raw = raw;
  const first = env.schemaVersion;
  if (
    typeof first !== "number" ||
    !Number.isInteger(first) ||
    first < 1 ||
    first > latest
  )
    return null;
  let v: number = first;
  while (v < latest) {
    const step = MIGRATIONS[v];
    if (!step) return null;
    try {
      env = step(env);
    } catch {
      return null;
    }
    if (env.schemaVersion !== v + 1) return null;
    v = v + 1;
  }
  return env;
}
