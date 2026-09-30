import { formatClockShort, type LogEntry } from "@/sim";

const SHOWN = 90;

export function Journal({ log }: { log: readonly LogEntry[] }) {
  return (
    <div className="journal">
      <div className="note" role="log" aria-label="日誌" tabIndex={0}>
        {log.slice(0, SHOWN).map((e) => (
          <p key={`${e.t}-${e.text}`} className={`ent ${e.kind}`}>
            {e.kind !== "day" && <span className="ts">{formatClockShort(e.t)}</span>}
            {e.text}
          </p>
        ))}
      </div>
    </div>
  );
}
