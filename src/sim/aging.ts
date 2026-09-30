/** ひだまり荘の経年。築年数が進むほど増える 0〜1 の値（画面に数値は出さず、絵の量に使う） */
export interface Aging {
  /** 屋根のサビ */
  rust: number;
  /** 外壁のツタ */
  ivy: number;
  /** 看板の文字のかすれ */
  sign: number;
}

const ramp = (age: number, from: number, to: number): number =>
  Number.isFinite(age) ? Math.min(1, Math.max(0, (age - from) / (to - from))) : 0;

/** 築 age 年のときの経年。築年数に対して単調に増える */
export const agingOf = (age: number): Aging => ({
  rust: ramp(age, 30, 60),
  ivy: ramp(age, 35, 65),
  sign: ramp(age, 25, 70),
});
