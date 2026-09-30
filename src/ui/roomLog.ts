import type { LogEntry } from "@/sim";

/**
 * 大写し中の日誌: その部屋で起きた出来事だけ（新しい順のまま）。
 * 行に残った登場人物の部屋（RoleRef.room）で絞るので、住人が出ていった後も、
 * その部屋の出来事は消えない。日付の区切りと町の変化は、どの部屋の出来事でもないので出さない。
 */
export function roomLog(log: readonly LogEntry[], room: number): LogEntry[] {
  return log.filter(
    (e) =>
      (e.kind === "" || e.kind === "move" || e.kind === "noise") &&
      Object.values(e.roles).some((ref) => ref !== undefined && ref.room === room)
  );
}
