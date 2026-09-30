import { defaultContent } from "@/content";
import { composeParts, dayOf, formatClockShort, type LogEntry } from "@/sim";

const SHOWN = 90;

/** 日誌の 1 行。本文は保存された構造（出来事・役割・言い回し）から、表示のたびに組み立てる */
function line(e: LogEntry, i: number, onName: (residentId: number) => void) {
  if (e.kind === "day")
    return (
      <p key={`${e.t}-day`} className="ent day">
        {`── ${dayOf(e.t)}日目 ──`}
      </p>
    );
  const parts = composeParts(defaultContent, e);
  if (parts === null) return null;
  const id = e.kind === "town" ? e.changeId : e.storyletId;
  return (
    <p key={`${e.t}-${id}-${i}`} className={`ent ${e.kind}`}>
      <span className="ts">{formatClockShort(e.t)}</span>
      {parts.map((p, k) => {
        const ref = p.ref;
        if (!ref) return p.text;
        // 名前を押すと、その人のプロフィール（出ていった人なら最後の出来事つき）が出る
        return (
          <span
            key={k}
            className="name"
            role="link"
            tabIndex={0}
            onClick={() => onName(ref.id)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                onName(ref.id);
              }
            }}
          >
            {p.text}
          </span>
        );
      })}
    </p>
  );
}

export function Journal({
  log,
  onName,
}: {
  log: readonly LogEntry[];
  onName: (residentId: number) => void;
}) {
  return (
    <div className="journal">
      <div className="note" role="log" aria-label="日誌" tabIndex={0}>
        {log.slice(0, SHOWN).map((e, i) => line(e, i, onName))}
      </div>
    </div>
  );
}
