import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, act, fireEvent } from "@testing-library/react";
import { createRng, newGame, type GameState } from "@/sim";
import { saveGame } from "@/save";
import { GameScreen } from "@/ui/GameScreen";
import { Stage } from "@/ui/Stage";
import { bubbleAnchors, bubbleHoldMs, holdBubbles, screenKey } from "@/ui/bubbles";

const NOW = 5_000_000;
let frames: FrameRequestCallback[] = [];

beforeEach(() => {
  localStorage.clear();
  frames = [];
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => frames.push(cb));
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const noop = () => undefined;

function baseState(): GameState {
  const s = newGame(createRng(7));
  return { ...s, t: 5 };
}

describe("B9 Stage の結合", () => {
  it("大写しでも、その部屋の住人の吹き出しだけが出る", () => {
    const s0 = baseState();
    const inRooms = s0.res.filter((x) => typeof x.at === "number");
    const a = inRooms[0];
    // b は a と別の部屋の住人（大写しでは出てはいけない）
    const b = inRooms.find((x) => x.at !== a.at)!;
    const say = new Map([
      [a.id, "ただいま"],
      [b.id, "おやすみ"],
    ]);
    const s: GameState = {
      ...s0,
      res: s0.res.map((x) =>
        say.has(x.id) ? { ...x, bubble: { text: say.get(x.id)!, until: s0.t + 100 } } : x
      ),
    };
    const ui = (zoom: never) => (
      <Stage
        canvasRef={{ current: null }}
        state={s}
        zoom={zoom}
        bubbles={
          holdBubbles(new Map(), s.res, s.t, 0, bubbleAnchors(s, zoom), screenKey(zoom))
            .visible
        }
        onPick={noop}
        onEnterRoom={noop}
        onBack={noop}
      />
    );
    const over = render(ui({ phase: "overview" } as never));
    expect(over.container.querySelectorAll(".bubble").length).toBe(2);
    over.unmount();
    const room = a.at as number;
    const inRoom = s.res.filter((x) => x.at === room).length;
    expect(b.at).not.toBe(room);
    const close = render(ui({ phase: "closeup", room } as never));
    // 吹き出しを持つ住人のうち、その部屋にいる数だけ出る（別の部屋の b は出ない）
    const speakers = s.res.filter((x) => x.bubble !== null && x.at === room).length;
    expect(speakers).toBe(1);
    expect(close.container.querySelectorAll(".bubble").length).toBe(speakers);
    expect(close.container.textContent).not.toContain("おやすみ");
    expect(inRoom).toBeGreaterThan(0);
    expect(close.container.textContent).toContain("ただいま");
  });

  it("画面（ループ）で、ゲーム内で期限切れでも読める時間内なら出て、過ぎたら消える", () => {
    const s0 = newGame(createRng(7));
    const r = s0.res.find((x) => typeof x.at === "number")!;
    const s: GameState = {
      ...s0,
      res: s0.res.map((x) =>
        x.id === r.id ? { ...x, bubble: { text: "ただいま", until: s0.t + 2 } } : x
      ),
    };
    saveGame(localStorage, s, createRng(7).getState(), NOW);
    const now = vi.spyOn(performance, "now").mockReturnValue(0);
    const { container } = render(
      <GameScreen seed={1} storage={localStorage} now={() => NOW} />
    );
    const shown = () => container.textContent?.includes("ただいま") ?? false;
    expect(shown()).toBe(true);
    // 0.25 秒ずつ進める。2 秒でゲーム内はとっくに期限切れだが、読める時間（約 2.84 秒）内
    let t = 0;
    const run = (until: number) => {
      while (t < until) {
        t += 250;
        now.mockReturnValue(t);
        const cb = frames.shift()!;
        act(() => cb(t));
      }
    };
    run(2000);
    expect(shown()).toBe(true);
    run(bubbleHoldMs("ただいま") + 1000);
    expect(shown()).toBe(false);
  });

  it("B19 全体図で吹き出しが出ている状態で部屋を押すと、onUi を待たずに吹き出しが消える", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((q: string) => ({
        matches: false,
        media: q,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
      }))
    );
    const s0 = newGame(createRng(7));
    const r = s0.res.find((x) => typeof x.at === "number")!;
    const s: GameState = {
      ...s0,
      res: s0.res.map((x) =>
        x.id === r.id ? { ...x, bubble: { text: "ただいま", until: s0.t + 100 } } : x
      ),
    };
    saveGame(localStorage, s, createRng(7).getState(), NOW);
    vi.spyOn(performance, "now").mockReturnValue(0);
    const { container, getByRole } = render(
      <GameScreen seed={1} storage={localStorage} now={() => NOW} />
    );
    expect(container.querySelectorAll(".bubble").length).toBeGreaterThan(0);
    const canvas = getByRole("img");
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 320,
      height: 200,
      right: 320,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    // 部屋 1（下の段の中央）を押す。フレームは進めない（onUi は呼ばれない）
    fireEvent.click(canvas, { clientX: 28 + 77 + 37, clientY: 122 + 24 });
    expect(container.querySelector(".stage")!.getAttribute("data-view")).not.toBe(
      "overview"
    );
    expect(container.querySelectorAll(".bubble").length).toBe(0);
  });
});
