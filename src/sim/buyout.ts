import { defaultContent, type Content } from "@/content";
import { buildingAge } from "./clock";
import type { Ctx } from "./context";
import type { Rng } from "./random";
import { fireStorylet } from "./storylets";
import type { GameState } from "./types";

/** 築年数がこの値になった日が記念日（買収の話が来る） */
export const ANNIVERSARY_AGE = 50;
export type BuyoutChoice = "sell" | "decline";

const OFFER_ID = "buyout-offer";
const VOICE_ID = "buyout-voice";
const SOLD_ID = "buyout-sold";
const DECLINED_ID = "buyout-declined";

/** 記念日のダイアログが出ていて、プレイヤーの返事を待っているか（時間を止める判定に使う） */
export const isBuyoutPending = (s: GameState): boolean => s.buyout.phase === "pending";

/** 売却して結末を迎えたか。以後 step は状態を進めない */
export const isEnded = (s: GameState): boolean => s.buyout.phase === "sold";

/** 築 50 年に達したら、一度だけ記念日のフラグを立てて日誌に載せる（断ったあとは二度と立たない） */
export function checkAnniversary(c: Ctx): void {
  const { s } = c;
  if (s.buyout.phase !== "none" || buildingAge(s.t, s.t0) < ANNIVERSARY_AGE) return;
  s.buyout.phase = "pending";
  fireStorylet(c, OFFER_ID);
  // 住人の一言は、ダイアログにも出せるよう日誌と同じ構造で持つ
  if (fireStorylet(c, VOICE_ID)) {
    const e = s.log[0];
    if (e && "storyletId" in e && e.storyletId === VOICE_ID)
      s.buyout.voice = structuredClone(e);
  }
}

/**
 * 記念日の選択を適用した新しい状態を返す。待っていないとき（まだ・もう済んだ）は何もしない。
 * 売る → 結末（以後 step しても進まない）/ 断る → 続行（記念日は二度と来ない）。
 */
export function decideBuyout(
  state: GameState,
  choice: BuyoutChoice,
  rng: Rng,
  content: Content = defaultContent
): GameState {
  if (!isBuyoutPending(state)) return state;
  const s = structuredClone(state);
  const c: Ctx = { s, rng, quiet: true, content };
  s.buyout.phase = choice === "sell" ? "sold" : "declined";
  fireStorylet(c, choice === "sell" ? SOLD_ID : DECLINED_ID);
  return s;
}
