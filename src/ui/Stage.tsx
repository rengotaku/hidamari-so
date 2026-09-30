import type { RefObject } from "react";
import { bubbleAnchor, toScene } from "@/render";
import { SCENE_H, SCENE_W, agingOf, buildingAge, type GameState } from "@/sim";

const pct = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

interface Props {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  state: GameState;
  onPick: (sceneX: number, sceneY: number) => void;
}

/** 建物断面の Canvas と、その上に重ねる吹き出し */
export function Stage({ canvasRef, state, onPick }: Props) {
  return (
    <div className="stageWrap">
      <div className="stage">
        <canvas
          ref={canvasRef}
          width={SCENE_W}
          height={SCENE_H}
          role="img"
          aria-label="ひだまり荘の断面図。住人を押すとその人のことがわかる"
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
        <div className="overlay" aria-hidden="true">
          <div
            className="sign"
            style={{ opacity: 1 - 0.6 * agingOf(buildingAge(state.t, state.t0)).sign }}
          >
            ひだまり荘
          </div>
          {state.res.map((r) => {
            if (!r.bubble || r.bubble.until <= state.t) return null;
            const p = bubbleAnchor(r);
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
