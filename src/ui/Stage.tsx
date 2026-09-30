import type { RefObject } from "react";
import { bubbleAnchor, closeupBubbleAnchor, toScene } from "@/render";
import { SCENE_H, SCENE_W, agingOf, buildingAge, type GameState } from "@/sim";
import { RoomPicker } from "./RoomPicker";
import type { ZoomState } from "./zoom";

const pct = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

interface Props {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  state: GameState;
  zoom: ZoomState;
  onPick: (sceneX: number, sceneY: number) => void;
  onEnterRoom: (room: number) => void;
  onBack: () => void;
}

/** 吹き出しの位置（場面の座標）。全体図では建物の断面、大写しではその部屋の中。遷移中は出さない */
function anchorFor(
  state: GameState,
  zoom: ZoomState,
  r: GameState["res"][number]
): { x: number; y: number } | null {
  if (zoom.phase === "overview") return bubbleAnchor(r);
  if (zoom.phase === "closeup" && zoom.room !== null && r.at === zoom.room)
    return closeupBubbleAnchor(state, zoom.room, r);
  return null;
}

/** 建物断面（部屋を押すと大写し）の Canvas と、その上に重ねる吹き出し・キーボード用の部屋の選択領域 */
export function Stage({ canvasRef, state, zoom, onPick, onEnterRoom, onBack }: Props) {
  return (
    <div className="stageWrap">
      <div className="stage" data-view={zoom.phase}>
        <canvas
          ref={canvasRef}
          width={SCENE_W}
          height={SCENE_H}
          role="img"
          aria-label="ひだまり荘の断面図。部屋を押すとその部屋が大きく見える。住人を押すとその人のことがわかる"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;
            const p = toScene(
              e.clientX - rect.left,
              e.clientY - rect.top,
              rect.width,
              rect.height
            );
            onPick(p.x, p.y);
          }}
        />
        <RoomPicker state={state} zoom={zoom} onEnter={onEnterRoom} onBack={onBack} />
        <div className="overlay" aria-hidden="true">
          {zoom.phase === "overview" && (
            <div
              className="sign"
              style={{ opacity: 1 - 0.6 * agingOf(buildingAge(state.t, state.t0)).sign }}
            >
              ひだまり荘
            </div>
          )}
          {state.res.map((r) => {
            if (!r.bubble || r.bubble.until <= state.t) return null;
            const p = anchorFor(state, zoom, r);
            if (!p) return null;
            return (
              <div
                key={r.id}
                className="bubble"
                style={{
                  left: `${pct((p.x / SCENE_W) * 100, 10, 90)}%`,
                  top: `${(p.y / SCENE_H) * 100}%`,
                }}
              >
                {r.bubble.text}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
