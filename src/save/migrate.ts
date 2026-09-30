import { defaultContent } from "@/content";
import { newLandlord } from "@/sim";

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

/**
 * 部屋の装飾・退去後の部屋・大家の欠けを補う（版は上げない。足す前の保存にはこれらが無い）。
 * 欠けている項目だけを補い、あるものは触らない（壊れた値は検証で落とす）。乱数は使わず、同じ保存からは同じ結果になる。
 * 住人には、その種類の「必ず置くもの」と候補の先頭を装飾として持たせ、住んでいる部屋にはそれがそろった状態で置く。
 * 退去後の部屋はなく、大家は姿を見せていない。
 */
export function fillHouse(env: Raw): Raw {
  const state = env.state;
  if (!isRecord(state)) return env;
  const res = Array.isArray(state.res) ? state.res : [];
  const plans = new Map<unknown, unknown>();
  const fixedRes = res.map((r: unknown) => {
    if (!isRecord(r)) return r;
    let out: Raw = r;
    if (r.decorPlan === undefined) {
      const arch =
        typeof r.job === "string" && Object.hasOwn(defaultContent.archetypes, r.job)
          ? defaultContent.archetypes[r.job]
          : undefined;
      const plan = arch
        ? [...arch.decor.required, ...arch.decor.pool.slice(0, arch.decor.pick[0])]
        : [];
      out = { ...out, decorPlan: plan };
    }
    if (out.settled === undefined)
      out = { ...out, settled: Array.isArray(out.decorPlan) ? out.decorPlan.length : 0 };
    plans.set(out.id, out.decorPlan);
    return out;
  });
  const rooms = Array.isArray(state.rooms) ? state.rooms : [];
  return {
    ...env,
    state: {
      ...state,
      res: fixedRes,
      decor:
        state.decor ??
        [0, 1, 2, 3, 4, 5].map((i) => {
          const plan = plans.get(rooms[i]);
          return { items: Array.isArray(plan) ? [...plan] : [], boxes: 0 };
        }),
      vacancies: state.vacancies ?? [],
      landlord: state.landlord ?? newLandlord(),
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
