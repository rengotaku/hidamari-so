import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { residentOfRoom } from "@/render";
import { ROOM_ORDER, SCENE_H, SCENE_W, roomNo, roomRect, type GameState } from "@/sim";
import { statusText } from "./text";
import type { ZoomState } from "./zoom";

interface Props {
  state: GameState;
  zoom: ZoomState;
  /** Enter / Space で部屋を大写しにする */
  onEnter: (room: number) => void;
  /** 大写しから全体図に戻る */
  onBack: () => void;
}

/** 読み上げ用の名前: 部屋番号と、住人の名前・いまの状態（空室ならそう言う） */
function labelOf(s: GameState, room: number): string {
  const id = residentOfRoom(s, room);
  const r = id === null ? undefined : s.res.find((x) => x.id === id);
  return r
    ? `${roomNo(room)}号室 ${r.sei} ${r.mei}、${statusText(s, r)}`
    : `${roomNo(room)}号室 空室`;
}

function nextRoom(room: number, key: string): number {
  if (key === "ArrowLeft") return room % 3 > 0 ? room - 1 : room;
  if (key === "ArrowRight") return room % 3 < 2 ? room + 1 : room;
  if (key === "ArrowUp") return room < 3 ? room + 3 : room;
  if (key === "ArrowDown") return room >= 3 ? room - 3 : room;
  return room;
}

/**
 * キーボード用の部屋の選択領域。画面に操作ボタンは置かない方針なので、建物の上に透明で重ねる
 * （マウスは素通しで、フォーカスしたときだけ枠が出る）。矢印キーで部屋を移り、Enter / Space で大写し、
 * 大写しでは Enter / Space / Escape で全体に戻る。選択中の部屋番号と住人の名前・状態は aria で読み上げる。
 */
export function RoomPicker({ state, zoom, onEnter, onBack }: Props) {
  const [cursor, setCursor] = useState<number>(ROOM_ORDER[0]);
  const [seenRoom, setSeenRoom] = useState<number | null>(null);
  const refs = useRef<Array<HTMLDivElement | null>>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  // マウスで開いた部屋にも選択を合わせる（描画中の調整）
  if (zoom.room !== null && zoom.room !== seenRoom) {
    setSeenRoom(zoom.room);
    setCursor(zoom.room);
  }

  const closeup = zoom.phase === "closeup";
  const settled = zoom.phase === "overview" || closeup;

  // 遷移が終わって選択領域が現れたら、キーボードで操作していた人のフォーカスを移す
  const prevPhase = useRef(zoom.phase);
  useEffect(() => {
    if (prevPhase.current === zoom.phase) return;
    prevPhase.current = zoom.phase;
    if (!settled) return;
    const active = document.activeElement;
    if (active && active !== document.body && !rootRef.current?.contains(active)) return;
    const el = closeup
      ? rootRef.current?.querySelector<HTMLDivElement>("[role=option]")
      : refs.current[cursor];
    el?.focus();
  }, [zoom.phase, settled, closeup, cursor]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>, room: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (closeup) onBack();
      else onEnter(room);
    } else if (e.key === "Escape") {
      if (closeup) {
        e.preventDefault();
        onBack();
      }
    } else if (!closeup && e.key.startsWith("Arrow")) {
      e.preventDefault();
      const next = nextRoom(room, e.key);
      setCursor(next);
      refs.current[next]?.focus();
    }
  };

  return (
    <div
      className="picker"
      ref={rootRef}
      role="listbox"
      aria-label="部屋"
      aria-busy={!settled}
    >
      {closeup && zoom.room !== null && (
        <div
          role="option"
          aria-selected
          tabIndex={0}
          className="pick closeup"
          aria-label={`${labelOf(state, zoom.room)}。大写し中。Enter で全体に戻る`}
          onKeyDown={(e) => onKey(e, zoom.room!)}
        />
      )}
      {zoom.phase === "overview" &&
        ROOM_ORDER.map((room) => {
          const rr = roomRect(room);
          return (
            <div
              key={room}
              role="option"
              aria-selected={room === cursor}
              tabIndex={room === cursor ? 0 : -1}
              ref={(el) => {
                refs.current[room] = el;
              }}
              className="pick"
              aria-label={labelOf(state, room)}
              style={{
                left: `${(rr.x / SCENE_W) * 100}%`,
                top: `${(rr.y / SCENE_H) * 100}%`,
                width: `${(rr.w / SCENE_W) * 100}%`,
                height: `${(rr.h / SCENE_H) * 100}%`,
              }}
              onKeyDown={(e) => onKey(e, room)}
            />
          );
        })}
    </div>
  );
}
