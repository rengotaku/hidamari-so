/** ゲーム内時計。実時間 1 秒 = ゲーム内 2 分。時刻は「1 日目 0:00 からの経過分」で持つ。 */
export const MIN_PER_SEC = 2;
export const DAY_MIN = 1440;
export const START_AGE = 47;
/** 築年数が 1 増えるまでのゲーム内日数 */
export const YEAR_DAYS = 18;

export const hourOf = (t: number): number => (t / 60) % 24;
export const dayOf = (t: number): number => Math.floor(t / DAY_MIN) + 1;

const pad2 = (n: number): string => String(n).padStart(2, "0");

export function formatTime(t: number): string {
  const m = Math.floor(t % DAY_MIN);
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

/** 「3日目 07:05」 */
export const formatClock = (t: number): string => `${dayOf(t)}日目 ${formatTime(t)}`;

/** 日誌の行頭用「3日 07:05」 */
export const formatClockShort = (t: number): string => `${dayOf(t)}日 ${formatTime(t)}`;

export const buildingAge = (t: number, t0: number): number =>
  START_AGE + Math.floor((t - t0) / (YEAR_DAYS * DAY_MIN));

/** 時間帯 [s, e) に h が入るか（日をまたぐ s > e も可） */
export function inWin(h: number, s: number, e: number): boolean {
  return s < e ? h >= s && h < e : h >= s || h < e;
}

/** いまから時刻 e（時）までの分数。ちょうど e のときは 24 時間後 */
export function minutesUntilHour(t: number, e: number): number {
  let dh = e - hourOf(t);
  if (dh <= 0) dh += 24;
  return dh * 60;
}
