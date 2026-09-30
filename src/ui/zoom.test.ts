import { describe, it, expect } from "vitest";
import {
  FADE_MS,
  ZOOM_IN_MS,
  advance,
  initialZoom,
  press,
  transitionMs,
  viewFrame,
} from "./zoom";

describe("部屋の大写しの状態遷移（G1〜G4）", () => {
  it("G1: 全体図で部屋を押すと「ズーム中」になり、時間が経つと「大写し」に進む。部屋番号は保持される", () => {
    const z1 = press(initialZoom, 3, 1000, false);
    expect(z1.phase).toBe("zooming");
    expect(z1.room).toBe(3);
    const mid = advance(z1, 1000 + transitionMs(false) - 1, false);
    expect(mid.phase).toBe("zooming");
    const z2 = advance(z1, 1000 + transitionMs(false), false);
    expect(z2.phase).toBe("closeup");
    expect(z2.room).toBe(3);
  });

  it("G2: 大写しをもう一度押すと「戻り中」になり、時間が経つと「全体図」に戻る", () => {
    const closeup = advance(press(initialZoom, 4, 0, false), 5000, false);
    expect(closeup.phase).toBe("closeup");
    const back = press(closeup, null, 6000, false);
    expect(back.phase).toBe("returning");
    expect(back.room).toBe(4);
    const done = advance(back, 6000 + transitionMs(false), false);
    expect(done.phase).toBe("overview");
    expect(done.room).toBeNull();
  });

  it("G3: 遷移の途中に別の場所を押しても、遷移は壊れず二重に始まらない", () => {
    const zooming = press(initialZoom, 1, 1000, false);
    expect(press(zooming, 2, 1100, false)).toEqual(zooming);
    expect(press(zooming, null, 1100, false)).toEqual(zooming);
    expect(press(zooming, 1, 1100, false)).toEqual(zooming);
    const closeup = advance(zooming, 9000, false);
    const returning = press(closeup, null, 9000, false);
    expect(press(returning, 5, 9100, false)).toEqual(returning);
    expect(press(returning, null, 9100, false)).toEqual(returning);
  });

  it("G4: reduced-motion では遷移時間がほぼ 0 で、押すとすぐ大写し・もう一度押すとすぐ全体図", () => {
    expect(transitionMs(true)).toBeLessThanOrEqual(50);
    expect(transitionMs(false)).toBe(ZOOM_IN_MS + FADE_MS);
    const z = press(initialZoom, 2, 0, true);
    expect(z.phase).toBe("closeup");
    expect(z.room).toBe(2);
    const back = press(z, null, 10, true);
    expect(back.phase).toBe("overview");
    expect(back.room).toBeNull();
  });
});

describe("追加: 遷移の描画位置", () => {
  it("押した直後は全体図のまま、ズーム（約0.5秒）→ フェード（約0.6秒）→ 大写しの順に進む", () => {
    const z = press(initialZoom, 0, 0, false);
    expect(viewFrame(z, 0)).toEqual({ kind: "zoom", room: 0, k: 0 });
    const inZoom = viewFrame(z, ZOOM_IN_MS / 2);
    expect(inZoom.kind).toBe("zoom");
    const f = viewFrame(z, ZOOM_IN_MS + FADE_MS / 2);
    expect(f.kind).toBe("fade");
    expect(viewFrame(z, ZOOM_IN_MS + FADE_MS + 500)).toEqual({
      kind: "closeup",
      room: 0,
    });
  });

  it("戻るときは逆順（フェードで全体へ寄せた絵に戻り、ズームアウト）", () => {
    const closeup = advance(press(initialZoom, 5, 0, false), 9000, false);
    const r = press(closeup, null, 10_000, false);
    expect(viewFrame(r, 10_000)).toEqual({ kind: "closeup", room: 5 });
    expect(viewFrame(r, 10_000 + FADE_MS / 2).kind).toBe("fade");
    const last = viewFrame(r, 10_000 + transitionMs(false) - 1);
    expect(last.kind).toBe("zoom");
  });

  it("全体図では何も押されない場所（部屋以外）を押しても変わらない", () => {
    expect(press(initialZoom, null, 0, false)).toEqual(initialZoom);
    expect(viewFrame(initialZoom, 123)).toEqual({ kind: "overview" });
  });

  it("時刻が押した時刻より前（フレーム時刻のずれ）でも範囲を外れない", () => {
    const z = press(initialZoom, 0, 1000, false);
    const f = viewFrame(z, 900);
    expect(f).toEqual({ kind: "zoom", room: 0, k: 0 });
  });
});
