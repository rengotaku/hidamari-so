import type { GameState, LogEntry } from "@/sim";

/**
 * 大写し中の日誌: その部屋の住人が登場する出来事だけ（新しい順のまま）。
 * 日付の区切りと町の変化は、誰の出来事でもないので出さない。
 */
export function roomLog(
  log: readonly LogEntry[],
  s: GameState,
  room: number
): LogEntry[] {
  const ids = new Set(s.res.filter((r) => r.room === room).map((r) => r.id));
  return log.filter(
    (e) =>
      (e.kind === "" || e.kind === "move" || e.kind === "noise") &&
      Object.values(e.roles).some((ref) => ref !== undefined && ids.has(ref.id))
  );
}
