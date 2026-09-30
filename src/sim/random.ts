/** 乱数は引数で注入する。`Math.random` はここでも使わない。 */
export interface Rng {
  next(): number;
}

export interface SeededRng extends Rng {
  /** 現在の内部状態。`createRng(state)` で続きから再開できる */
  getState(): number;
}

/** mulberry32。seed は初期状態そのもの（保存した getState() を渡せば続きから再開できる） */
export function createRng(seed: number): SeededRng {
  let a = seed | 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    getState() {
      return a;
    },
  };
}

export const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

export const rand = (rng: Rng, lo: number, hi: number): number =>
  lo + rng.next() * (hi - lo);

export const randi = (rng: Rng, lo: number, hi: number): number =>
  Math.floor(lo + rng.next() * (hi - lo + 1));

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng.next() * items.length)]!;
}

export const chance = (rng: Rng, p: number): boolean => rng.next() < p;

export function weighted<K extends string>(
  rng: Rng,
  weights: Partial<Record<K, number>>,
  fallback: K
): K {
  const keys = Object.keys(weights) as K[];
  let sum = 0;
  for (const k of keys) sum += weights[k] ?? 0;
  let x = rng.next() * sum;
  for (const k of keys) {
    x -= weights[k] ?? 0;
    if (x <= 0) return k;
  }
  return fallback;
}

const KANJI = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

/** 日誌の文中に算用数字を出さないための漢数字変換（0〜99） */
export function kanji(n: number): string {
  const v = Math.max(0, Math.min(99, Math.round(n)));
  if (v < 10) return KANJI[v]!;
  const tens = Math.floor(v / 10);
  const ones = v % 10;
  return (tens === 1 ? "" : KANJI[tens]!) + "十" + (ones === 0 ? "" : KANJI[ones]!);
}
