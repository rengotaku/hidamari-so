import { defaultContent } from "@/content";
import { composeEntry, dayOf, formatClockShort, type LogEntry } from "@/sim";

const SHOWN = 90;

/** 日誌の 1 行。本文は保存された構造（出来事・役割・言い回し）から、表示のたびに組み立てる */
function line(e: LogEntry, i: number) {
  if (e.kind === "day")
    return (
      <p key={`${e.t}-day`} className="ent day">
        {`── ${dayOf(e.t)}日目 ──`}
      </p>
    );
  const text = composeEntry(defaultContent, e);
  if (text === null) return null;
  const id = e.kind === "town" ? e.changeId : e.storyletId;
  return (
    <p key={`${e.t}-${id}-${i}`} className={`ent ${e.kind}`}>
      <span className="ts">{formatClockShort(e.t)}</span>
      {text}
    </p>
  );
}

export function Journal({ log }: { log: readonly LogEntry[] }) {
  return (
    <div className="journal">
      <div className="note" role="log" aria-label="日誌" tabIndex={0}>
        {log.slice(0, SHOWN).map(line)}
      </div>
    </div>
  );
}
