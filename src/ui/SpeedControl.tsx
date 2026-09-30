import { SPEEDS, type Speed } from "@/save";

const LABELS: Readonly<Record<Speed, string>> = {
  0: "停止",
  1: "1倍",
  4: "4倍",
  15: "15倍",
};

interface Props {
  speed: Speed;
  onChange: (speed: Speed) => void;
}

/** 時間の速さを選ぶ 4 つのボタン。押されている速さを強調する */
export function SpeedControl({ speed, onChange }: Props) {
  return (
    <div className="speed" role="group" aria-label="時間の速さ">
      {SPEEDS.map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={s === speed}
          onClick={() => onChange(s)}
        >
          {LABELS[s]}
        </button>
      ))}
    </div>
  );
}
