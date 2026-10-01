import { useEffect, type RefObject } from "react";
import { drawStage, type Scratch } from "@/render";
import { createAwayTracker, type KeyValueStorage } from "@/save";
import { MIN_PER_SEC, SCENE_H, SCENE_W } from "@/sim";
import type { GameEngine } from "./engine";
import { advance, prefersReducedMotion, viewFrame, type ZoomState } from "./zoom";

const UI_INTERVAL_S = 0.3;
const SAVE_INTERVAL_S = 5;

interface Options {
  engine: GameEngine;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  selectedIdRef: RefObject<number | null>;
  /** 部屋の大写しの状態（全体図 / ズーム中 / 大写し / 戻り中）。遷移が終わったら onZoom で知らせる */
  zoomRef: RefObject<ZoomState>;
  onZoom: (z: ZoomState) => void;
  storage: KeyValueStorage;
  now: () => number;
  /** 画面の文字（時計・日誌・プロフィール）を最新の状態に合わせる */
  onUi: () => void;
}

/**
 * 実時間 1 秒 = ゲーム内 2 分で進め、Canvas を描き、定期的に保存する。
 * タブが隠れている間は止まり、戻ったら隠れていた時間ぶんを（上限つきで）進める。
 */
export function useGameLoop({
  engine,
  canvasRef,
  selectedIdRef,
  zoomRef,
  onZoom,
  storage,
  now,
  onUi,
}: Options): void {
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d") ?? null;
    const away = createAwayTracker(now);
    let raf = 0;
    let last: number | null = null;
    let uiAcc = 0;
    let saveAcc = 0;
    let scratch: Scratch | null = null;
    // 寄り・フェードの間だけ使う全体図の下絵。作れない環境では null のまま（直接描く）
    const scratchFor = (): Scratch | null => {
      if (scratch || typeof document === "undefined") return scratch;
      const canvas = document.createElement("canvas");
      canvas.width = SCENE_W;
      canvas.height = SCENE_H;
      const sctx = canvas.getContext("2d");
      if (sctx) scratch = { canvas, ctx: sctx };
      return scratch;
    };

    const frame = (t: number) => {
      // 非表示の間は進めない。戻ったときに一度だけ追いつく
      if (away.hiding()) {
        raf = requestAnimationFrame(frame);
        return;
      }
      const dt = last === null ? 0 : Math.min(0.25, (t - last) / 1000);
      last = t;
      // 大写し中も時間は止めない（遷移や表示の切り替えに関係なく、毎フレーム進める）
      engine.tick(dt * MIN_PER_SEC);
      engine.followDraw(dt);
      const z = advance(zoomRef.current, t, prefersReducedMotion());
      if (z !== zoomRef.current) onZoom(z);
      const vf = viewFrame(z, t);
      if (ctx)
        drawStage(
          ctx,
          engine.state,
          engine.ambient,
          t,
          selectedIdRef.current,
          vf,
          vf.kind === "zoom" || vf.kind === "fade" ? scratchFor() : null,
          engine.drawPos
        );
      uiAcc += dt;
      if (uiAcc > UI_INTERVAL_S) {
        uiAcc = 0;
        onUi();
      }
      saveAcc += dt;
      if (saveAcc > SAVE_INTERVAL_S) {
        saveAcc = 0;
        engine.save(storage, now());
      }
      raf = requestAnimationFrame(frame);
    };

    const goHidden = () => {
      away.hide();
      engine.save(storage, now());
    };
    const onVisibility = () => {
      if (document.hidden) goHidden();
      else {
        engine.resume(away.show());
        last = null;
        onUi();
      }
    };
    // 非表示中は、隠れた時点の状態と時刻の組（goHidden で保存済み）を保つ。ここで保存し直すと留守時間が消える
    const onPageHide = () => {
      if (!away.hiding()) engine.save(storage, now());
    };
    if (document.hidden) goHidden();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [engine, canvasRef, selectedIdRef, zoomRef, onZoom, storage, now, onUi]);
}
