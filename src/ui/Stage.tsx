import type { RefObject } from "react";
import { toScene } from "@/render";
import { SCENE_H, SCENE_W, agingOf, buildingAge, type GameState } from "@/sim";
import { RoomPicker } from "./RoomPicker";
import type { VisibleBubbles } from "./bubbles";
import type { ZoomState } from "./zoom";

const pct = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

interface Props {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  state: GameState;
  zoom: ZoomState;
  /** 画面に出す吹き出し（住人の id → セリフと位置）。出すかどうかはゲームのループ側で決める（bubbles.ts） */
  bubbles: VisibleBubbles;
  onPick: (sceneX: number, sceneY: number) => void;
  onEnterRoom: (room: number) => void;
  onBack: () => void;
}

/** 建物断面（部屋を押すと大写し）の Canvas と、その上に重ねる吹き出し・キーボード用の部屋の選択領域 */
export function Stage({
  canvasRef,
  state,
  zoom,
  bubbles,
  onPick,
  onEnterRoom,
  onBack,
}: Props) {
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
          {[...bubbles].map(([id, { text, pos }]) => (
            <div
              key={id}
              className="bubble"
              style={{
                left: `${pct((pos.x / SCENE_W) * 100, 10, 90)}%`,
                top: `${(pos.y / SCENE_H) * 100}%`,
              }}
            >
              {text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
