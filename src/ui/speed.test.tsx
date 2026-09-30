import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, within, cleanup, act } from "@testing-library/react";
import { SAVE_KEY, loadGame } from "@/save";
import { GameEngine, MAX_TICK_MINUTES } from "@/ui/engine";
import { GameScreen } from "@/ui/GameScreen";

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

const open = (seed = 7) => GameEngine.open(localStorage, seed, 1000);

describe("時間の速さ（#14 事前設計）", () => {
  it("S1: 同じ実時間ぶん tick すると、速さ 4 は速さ 1 の 4 倍進む", () => {
    const a = open();
    const b = open();
    b.setSpeed(4);
    const t0 = a.state.t;
    a.tick(10);
    b.tick(10);
    expect(a.state.t - t0).toBe(10);
    expect(b.state.t - t0).toBe(40);
  });

  it("S2: 速さ 15 でも速さ 1 と日誌の出来事が完全に一致する", () => {
    const slow = open();
    const fast = open();
    fast.setSpeed(15);
    // 3 日ぶん。速さ 1 は 2 分ずつ、速さ 15 は 1 tick 30 分（内部の 1 刻み 2 分で割り切れる）
    for (let i = 0; i < 2160; i++) slow.tick(2);
    for (let i = 0; i < 144; i++) fast.tick(2);
    expect(fast.state.t).toBe(slow.state.t);
    expect(slow.state.log.length).toBeGreaterThan(3);
    expect(fast.state.log).toEqual(slow.state.log);
    expect(fast.state).toEqual(slow.state);
  });

  it("S3: 速さ 0 では時刻・住人・日誌が変わらない", () => {
    const e = open();
    e.tick(600);
    e.setSpeed(0);
    const before = structuredClone(e.state);
    e.tick(1000);
    e.tick(1000);
    expect(e.state).toEqual(before);
  });

  it("S4: 停止中に実時間が進んでも、1 倍に戻した瞬間に一気に進まない", () => {
    const e = open();
    e.setSpeed(0);
    const t0 = e.state.t;
    for (let i = 0; i < 50; i++) e.tick(30);
    e.setSpeed(1);
    e.tick(2);
    expect(e.state.t - t0).toBe(2);
  });

  it("S5: 速さ 4 で保存すると、読み込んで 4 が復元される", () => {
    const e = open();
    e.setSpeed(4);
    e.save(localStorage, 2000);
    expect(GameEngine.open(localStorage, 1, 2000).speed).toBe(4);
  });

  it("S6: 速さの項目が無い古い保存は 1 倍で始まり、v2 のまま読める", () => {
    const e = open();
    e.save(localStorage, 2000);
    const env = JSON.parse(localStorage.getItem(SAVE_KEY)!);
    delete env.speed;
    localStorage.setItem(SAVE_KEY, JSON.stringify(env));
    expect(env.schemaVersion).toBe(2);
    const loaded = loadGame(localStorage);
    expect(loaded).not.toBeNull();
    expect(loaded!.speed).toBe(1);
    const e2 = GameEngine.open(localStorage, 1, 2000);
    expect(e2.speed).toBe(1);
    expect(e2.state).toEqual(e.state);
  });

  it("S7: 速さ 15 で大きな dt が来ても 1 回の tick で進める量に上限があり、残りは持ち越す", () => {
    const e = open();
    e.setSpeed(15);
    const t0 = e.state.t;
    e.tick(1000); // 15000 分ぶん求められる
    expect(e.state.t - t0).toBe(MAX_TICK_MINUTES);
    e.tick(0);
    expect(e.state.t - t0).toBe(MAX_TICK_MINUTES * 2);
  });

  it("S8: 押したボタンだけ aria-pressed=true になる（role=group の「時間の速さ」の中）", () => {
    render(<GameScreen seed={1} storage={localStorage} now={() => 5000} />);
    const group = screen.getByRole("group", { name: "時間の速さ" });
    const buttons = within(group).getAllByRole("button");
    expect(buttons).toHaveLength(4);
    expect(
      within(group).getByRole("button", { name: "1倍" }).getAttribute("aria-pressed")
    ).toBe("true");
    fireEvent.click(within(group).getByRole("button", { name: "4倍" }));
    for (const b of buttons) {
      expect(b.getAttribute("aria-pressed")).toBe(
        b.textContent === "4倍" ? "true" : "false"
      );
    }
  });
});

describe("追加: 時間の速さ", () => {
  it("ボタンを押すと engine の速さが変わり、画面の時計の進みが 15 倍 → 停止と変わる", () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => frames.push(cb));
    const { container } = render(
      <GameScreen seed={1} storage={localStorage} now={() => 5000} />
    );
    const clock = () => container.querySelector(".clock")!.textContent;
    let t = 0;
    /** 保留中のフレームを 0.25 秒刻みで n 回進める */
    const run = (n: number) => {
      for (let i = 0; i < n; i++) {
        const cb = frames.shift();
        expect(cb).toBeDefined();
        act(() => cb!(t));
        t += 250;
      }
    };
    run(1); // 最初のフレームは基準を取るだけ
    expect(clock()).toBe("1日目 17:00");
    fireEvent.click(screen.getByRole("button", { name: "15倍" }));
    run(40); // 10 秒 = 1 倍なら 20 分、15 倍なら 300 分
    expect(clock()).toBe("1日目 22:00");
    fireEvent.click(screen.getByRole("button", { name: "停止" }));
    run(2); // 停止の直後に溜まっていた分を反映
    const stopped = clock();
    run(40);
    expect(clock()).toBe(stopped);
  });

  it("壊れた速さ（2 倍など）の保存は読まず新規ゲームになる", () => {
    const e = open();
    e.save(localStorage, 2000);
    const env = JSON.parse(localStorage.getItem(SAVE_KEY)!);
    env.speed = 2;
    localStorage.setItem(SAVE_KEY, JSON.stringify(env));
    expect(loadGame(localStorage)).toBeNull();
  });

  it("setSpeed は 0/1/4/15 以外を無視する", () => {
    const e = open();
    // @ts-expect-error 型で弾かれる値も実行時に無視する
    e.setSpeed(2);
    expect(e.speed).toBe(1);
  });

  it("停止で持ち越しを捨てる（15 倍で溜めた分が停止→1倍で出てこない）", () => {
    const e = open();
    e.setSpeed(15);
    e.tick(1000);
    e.setSpeed(0);
    e.setSpeed(1);
    const t0 = e.state.t;
    e.tick(2);
    expect(e.state.t - t0).toBe(2);
  });
});
