import { bubbleAnchor, closeupBubbleAnchor } from "@/render";
import type { GameState, Resident } from "@/sim";
import type { ZoomState } from "./zoom";

/** 場面の座標 */
export interface Pos {
  x: number;
  y: number;
}

/**
 * 住人ごとのセリフ。shownAt は画面に初めて描いた実時間（ms）で、まだ描けていなければ null。
 * pos は最後に描いた位置、screen はそれを描いた画面（screenKey）。
 */
export type HeldBubbles = ReadonlyMap<
  number,
  {
    text: string;
    until: number;
    shownAt: number | null;
    pos: Pos | null;
    screen: string | null;
  }
>;

/**
 * いま描いている画面の識別。全体図は "overview"、大写しは "closeup:<部屋>"。
 * 遷移中（zooming / returning）はどの画面でもないので null（吹き出しは描かない）
 */
export function screenKey(zoom: ZoomState): string | null {
  if (zoom.phase === "overview") return "overview";
  if (zoom.phase === "closeup" && zoom.room !== null) return `closeup:${zoom.room}`;
  return null;
}

/** 画面に出す吹き出し（文と、描く位置） */
export type VisibleBubbles = ReadonlyMap<number, { text: string; pos: Pos }>;

/** 吹き出しを画面に出し続ける実時間（ms）。1 倍のときの長さと同じ */
export const bubbleHoldMs = (text: string): number => (2.4 + text.length * 0.11) * 1000;

/**
 * 吹き出しを描ける位置（場面の座標）。全体図は建物の断面、大写しはその部屋の中。
 * 描けない住人（遷移中・別の部屋・階段など）は null
 */
export function bubbleAnchors(
  state: GameState,
  zoom: ZoomState
): ReadonlyMap<number, Pos | null> {
  return new Map(
    state.res.map((r) => {
      if (zoom.phase === "overview") return [r.id, bubbleAnchor(r)] as const;
      if (zoom.phase === "closeup" && zoom.room !== null && r.at === zoom.room)
        return [r.id, closeupBubbleAnchor(state, zoom.room, r)] as const;
      return [r.id, null] as const;
    })
  );
}

/**
 * 実時間 nowMs での吹き出しの表示状態を返す。prev は書き換えない。
 * 読める時間（bubbleHoldMs）は、そのセリフを画面に初めて描いた瞬間（anchors に位置がある最初の呼び出し）から数える。
 * 読める時間が残っているセリフは、最後に描いた画面と今の画面（screen）が違えば、位置と数え始めを捨てて、
 * その画面で描けた時点から数え直す（画面が変わらないまま位置だけ取れなくなったのとは区別する）。
 * すでに読み終えたセリフは数え直さず、ゲーム内で有効（until > t）かつ位置が取れるときだけ出す。
 * 描けている間はゲーム内で期限切れでも、読める時間のあいだ出す。位置が取れなくなっても、読める時間が過ぎるまでは最後の位置で出す。
 * 表示中に同じ住人の次のセリフ（text か until が違うもの）が来ても、読める時間が過ぎるまで今のを残し、
 * 過ぎたらその時点でいちばん新しいセリフに替えて数え直す（間のセリフは出さない）。
 * prev に無い住人（読み込み直後など）は、ゲーム内で期限切れ（until <= t）なら出さない
 */
export function holdBubbles(
  prev: HeldBubbles,
  res: readonly Pick<Resident, "id" | "bubble">[],
  t: number,
  nowMs: number,
  anchors: ReadonlyMap<number, Pos | null>,
  screen: string | null = "overview"
): { held: HeldBubbles; visible: VisibleBubbles } {
  const held = new Map<
    number,
    {
      text: string;
      until: number;
      shownAt: number | null;
      pos: Pos | null;
      screen: string | null;
    }
  >();
  const visible = new Map<number, { text: string; pos: Pos }>();
  for (const r of res) {
    const b = r.bubble;
    if (!b) continue;
    const old = prev.get(r.id);
    if (old === undefined && b.until <= t) continue;
    const fresh = {
      text: b.text,
      until: b.until,
      shownAt: null,
      pos: null,
      screen: null,
    };
    const same = old !== undefined && old.text === b.text && old.until === b.until;
    const holding =
      old !== undefined &&
      old.shownAt !== null &&
      nowMs - old.shownAt < bubbleHoldMs(old.text);
    const kept = old !== undefined && (same || holding) ? old : fresh;
    const reading =
      kept.shownAt !== null && nowMs - kept.shownAt < bubbleHoldMs(kept.text);
    const cur =
      reading && kept.screen !== screen
        ? { ...kept, shownAt: null, pos: null, screen: null }
        : kept;
    const anchor = anchors.get(r.id) ?? null;
    if (cur.shownAt === null) {
      if (anchor === null) {
        held.set(r.id, cur);
        continue;
      }
      held.set(r.id, { ...cur, shownAt: nowMs, pos: anchor, screen });
      visible.set(r.id, { text: cur.text, pos: anchor });
      continue;
    }
    const pos = anchor ?? cur.pos;
    held.set(r.id, { ...cur, pos });
    const stillHolding = nowMs - cur.shownAt < bubbleHoldMs(cur.text);
    if (pos !== null && (stillHolding || (cur.until > t && anchor !== null))) {
      visible.set(r.id, { text: cur.text, pos });
    }
  }
  return { held, visible };
}
