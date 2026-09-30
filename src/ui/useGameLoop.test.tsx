import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { loadGame, SAVE_KEY } from "@/save";
import { GameScreen } from "@/ui/GameScreen";

let frames: FrameRequestCallback[] = [];
let clock = 1_000_000;

beforeEach(() => {
  localStorage.clear();
  frames = [];
  clock = 1_000_000;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => frames.push(cb));
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
  vi.restoreAllMocks();
});

/** 保留中のフレームを 1 回ぶん、実時間 ms 進めて実行する */
function runFrame(ms: number, t: number) {
  const cb = frames.shift();
  expect(cb).toBeDefined();
  act(() => cb!(t + ms));
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("追加: 画面のループ", () => {
  it("実時間が進むと画面の時計が進む（1 秒 = ゲーム内 2 分）", () => {
    const { container } = render(
      <GameScreen seed={1} storage={localStorage} now={() => clock} />
    );
    const before = container.querySelector(".clock")!.textContent;
    let t = 0;
    runFrame(0, t); // 最初のフレームは基準を取るだけ
    for (let i = 0; i < 40; i++) {
      t += 250;
      runFrame(0, t); // 0.25 秒 × 40 = 10 秒 = ゲーム内 20 分
    }
    const after = container.querySelector(".clock")!.textContent;
    expect(after).not.toBe(before);
    expect(before).toBe("1日目 17:00");
    expect(after).toBe("1日目 17:20");
  });

  it("5 秒ごとに保存される", () => {
    render(<GameScreen seed={1} storage={localStorage} now={() => clock} />);
    expect(localStorage.getItem(SAVE_KEY)).toBeNull();
    let t = 0;
    runFrame(0, t);
    for (let i = 0; i < 25; i++) {
      t += 250;
      runFrame(0, t);
    }
    expect(loadGame(localStorage)).not.toBeNull();
  });

  it("タブが隠れると保存し、戻ると隠れていた時間ぶん進む", () => {
    const { container } = render(
      <GameScreen seed={1} storage={localStorage} now={() => clock} />
    );
    act(() => setHidden(true));
    expect(loadGame(localStorage)).not.toBeNull();
    clock += 60_000; // 実時間 60 秒 = ゲーム内 120 分
    act(() => setHidden(false));
    expect(container.querySelector(".clock")!.textContent).toBe("1日目 19:00");
  });

  it("画面を閉じるとき（pagehide）に保存される", () => {
    render(<GameScreen seed={1} storage={localStorage} now={() => clock} />);
    window.dispatchEvent(new Event("pagehide"));
    expect(loadGame(localStorage)).not.toBeNull();
  });

  it("非表示 → 60 秒 → pagehide → 再読み込みでも、ゲーム内 120 分が失われない", () => {
    const { unmount } = render(
      <GameScreen seed={1} storage={localStorage} now={() => clock} />
    );
    act(() => setHidden(true));
    clock += 60_000;
    window.dispatchEvent(new Event("pagehide"));
    unmount();
    const { container } = render(
      <GameScreen seed={1} storage={localStorage} now={() => clock} />
    );
    expect(container.querySelector(".clock")!.textContent).toBe("1日目 19:00");
  });

  it("非表示のまま起動 → 60 秒後に表示すると、ゲーム内 120 分進んでいる", () => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    const { container } = render(
      <GameScreen seed={1} storage={localStorage} now={() => clock} />
    );
    // 非表示中はフレームが来ても進まない
    let t = 0;
    for (let i = 0; i < 10; i++) {
      t += 250;
      runFrame(0, t);
    }
    expect(container.querySelector(".clock")!.textContent).toBe("1日目 17:00");
    clock += 60_000;
    act(() => setHidden(false));
    expect(container.querySelector(".clock")!.textContent).toBe("1日目 19:00");
  });
});
