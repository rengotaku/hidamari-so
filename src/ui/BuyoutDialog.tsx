import { defaultContent } from "@/content";
import {
  composeEntry,
  type BuyoutChoice,
  type GameState,
  type LogEntry,
  type StoryletEntry,
} from "@/sim";
import "./buyout.css";

/** 買収の話そのものの本文（storylet の 1 番目の言い回し）。日誌と同じ content/ から組み立てる */
function offerText(state: GameState): string {
  const entry: LogEntry = {
    t: state.t,
    kind: "",
    storyletId: "buyout-offer",
    roles: {},
    variant: { text: 0, slots: {} },
  };
  return composeEntry(defaultContent, entry) ?? "";
}

/**
 * 築五十年の記念日のダイアログ。この画面で唯一の操作で、プレイヤーの選択は「売る」「断る」だけ。
 * 待っていないとき（まだ・済んだあと）は何も出さない。
 */
export function BuyoutDialog({
  state,
  onChoose,
}: {
  state: GameState;
  onChoose: (choice: BuyoutChoice) => void;
}) {
  if (state.buyout.phase !== "pending") return null;
  const voice = state.buyout.voice
    ? composeEntry(defaultContent, state.buyout.voice)
    : null;
  return (
    <div className="veil">
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label="築五十年の記念日"
      >
        <h2>築五十年の記念日</h2>
        <p>{offerText(state)}</p>
        {voice ? <p className="voice">{voice}</p> : null}
        <div className="choices">
          <button type="button" onClick={() => onChoose("sell")}>
            売る
          </button>
          <button type="button" onClick={() => onChoose("decline")}>
            断る
          </button>
        </div>
      </div>
    </div>
  );
}

/** 売ったあとの結末。何も操作できない（選択肢を置かない） */
export function Ending({ state }: { state: GameState }) {
  if (state.buyout.phase !== "sold") return null;
  const sold = state.log.find(
    (e): e is StoryletEntry => "storyletId" in e && e.storyletId === "buyout-sold"
  );
  const text = sold ? composeEntry(defaultContent, sold) : null;
  return (
    <div className="veil ending" role="status" aria-label="ひだまり荘の結末">
      <div className="dialog">
        <h2>ひだまり荘</h2>
        {text ? <p>{text}</p> : null}
        <p className="fin">おしまい</p>
      </div>
    </div>
  );
}
