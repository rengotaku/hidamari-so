import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, within, cleanup, act } from "@testing-library/react";
import { createRng, newGame, step, roomNo } from "@/sim";
import { saveGame } from "@/save";
import { GameScreen } from "@/ui/GameScreen";
import { statusText } from "@/ui/text";

const NOW = 5_000_000;
let frames: FrameRequestCallback[] = [];

function seedSave() {
  const rng = createRng(31337);
  let s = newGame(rng);
  for (let i = 0; i < 10 * 24; i++) s = step(s, 60, rng);
  saveGame(localStorage, s, rng.getState(), NOW);
  return s;
}

function mockReduced(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((q: string) => ({
      matches: reduced && q.includes("prefers-reduced-motion"),
      media: q,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
    }))
  );
}

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

function clickRoom(canvas: HTMLElement, room: number) {
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
  const col = room % 3;
  const y = room < 3 ? 122 : 70;
  fireEvent.click(canvas, { clientX: 28 + col * 77 + 37, clientY: y + 24 });
}

const stageView = (c: HTMLElement) =>
  c.querySelector(".stage")!.getAttribute("data-view");

describe("追加: 部屋を押して大写し（画面）", () => {
  it("部屋を押すとズーム中になり、途中で別の部屋を押しても変わらない（プロフィールも最初の部屋のまま）", () => {
    mockReduced(false);
    const s = seedSave();
    const { container } = render(
      <GameScreen seed={1} storage={localStorage} now={() => NOW} />
    );
    clickRoom(screen.getByRole("img"), 1);
    expect(stageView(container)).toBe("zooming");
    clickRoom(screen.getByRole("img"), 4);
    expect(stageView(container)).toBe("zooming");
    const owner = s.res.find((r) => r.room === 1)!;
    expect(
      screen.getByRole("region", { name: "住人のプロフィール" }).textContent
    ).toContain(`${owner.sei} ${owner.mei}`);
  });

  it("reduced-motion では押すとすぐ大写し、もう一度押すと全体図に戻る", () => {
    mockReduced(true);
    seedSave();
    const { container } = render(
      <GameScreen seed={1} storage={localStorage} now={() => NOW} />
    );
    clickRoom(screen.getByRole("img"), 2);
    expect(stageView(container)).toBe("closeup");
    clickRoom(screen.getByRole("img"), 5);
    expect(stageView(container)).toBe("overview");
  });

  it("大写し中も時間は進み続ける（時計が進む）", () => {
    mockReduced(true);
    seedSave();
    const { container } = render(
      <GameScreen seed={1} storage={localStorage} now={() => NOW} />
    );
    clickRoom(screen.getByRole("img"), 0);
    expect(stageView(container)).toBe("closeup");
    const before = container.querySelector(".clock")!.textContent;
    let t = 0;
    const run = () => act(() => frames.shift()!(t));
    run();
    for (let i = 0; i < 40; i++) {
      t += 250;
      run();
    }
    expect(container.querySelector(".clock")!.textContent).not.toBe(before);
    expect(stageView(container)).toBe("closeup");
  });

  it("大写し中は日誌がその部屋の住人の出来事に絞られ、全体図に戻ると元に戻る", () => {
    mockReduced(true);
    seedSave();
    const { container } = render(
      <GameScreen seed={1} storage={localStorage} now={() => NOW} />
    );
    const all = screen.getByRole("log", { name: "日誌" }).querySelectorAll("p").length;
    clickRoom(screen.getByRole("img"), 1);
    const some = screen.getByRole("log", { name: "日誌" }).querySelectorAll("p").length;
    expect(some).toBeLessThan(all);
    expect(container.querySelectorAll(".ent.day").length).toBe(0);
    clickRoom(screen.getByRole("img"), 1);
    expect(screen.getByRole("log", { name: "日誌" }).querySelectorAll("p").length).toBe(
      all
    );
  });

  it("画面に数値や操作ボタンを足していない（ボタンは時間の速さの 4 つだけ）", () => {
    mockReduced(true);
    seedSave();
    const { container } = render(
      <GameScreen seed={1} storage={localStorage} now={() => NOW} />
    );
    clickRoom(screen.getByRole("img"), 1);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "停止",
      "1倍",
      "4倍",
      "15倍",
    ]);
    expect(container.querySelector("input, select, textarea")).toBeNull();
  });
});

describe("追加: キーボードで部屋・住人を選ぶ", () => {
  it("部屋の選択領域が 6 つあり、部屋番号と住人の名前・状態を読み上げられる", () => {
    mockReduced(true);
    const s = seedSave();
    render(<GameScreen seed={1} storage={localStorage} now={() => NOW} />);
    const list = screen.getByRole("listbox", { name: "部屋" });
    const options = within(list).getAllByRole("option");
    expect(options).toHaveLength(6);
    for (let room = 0; room < 6; room++) {
      const label = options.find((o) =>
        o.getAttribute("aria-label")!.startsWith(`${roomNo(room)}号室`)
      )!;
      const owner = s.res.find((r) => r.room === room);
      if (owner) {
        expect(label.getAttribute("aria-label")).toContain(`${owner.sei} ${owner.mei}`);
        expect(label.getAttribute("aria-label")).toContain(statusText(s, owner));
      } else expect(label.getAttribute("aria-label")).toContain("空室");
    }
  });

  it("矢印キーで部屋を移り、Enter で大写しに入ってプロフィールが出る。Enter でまた戻る", () => {
    mockReduced(true);
    const s = seedSave();
    const { container } = render(
      <GameScreen seed={1} storage={localStorage} now={() => NOW} />
    );
    const options = () => within(screen.getByRole("listbox")).getAllByRole("option");
    // 先頭は 2 階の左（201 号室 = 部屋 3）
    const first = options()[0]!;
    expect(first.getAttribute("aria-label")).toMatch(/^201号室/);
    expect(first.getAttribute("tabindex")).toBe("0");
    expect(options().filter((o) => o.getAttribute("tabindex") === "0")).toHaveLength(1);
    act(() => first.focus());
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(document.activeElement!.getAttribute("aria-label")).toMatch(/^202号室/);
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(document.activeElement!.getAttribute("aria-label")).toMatch(/^102号室/);
    fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" });
    expect(document.activeElement!.getAttribute("aria-label")).toMatch(/^202号室/);
    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" }); // 端で止まる
    expect(document.activeElement!.getAttribute("aria-label")).toMatch(/^201号室/);
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(document.activeElement!.getAttribute("aria-label")).toMatch(/^101号室/);

    fireEvent.keyDown(document.activeElement!, { key: "Enter" });
    expect(stageView(container)).toBe("closeup");
    const owner = s.res.find((r) => r.room === 0)!;
    expect(
      screen.getByRole("region", { name: "住人のプロフィール" }).textContent
    ).toContain(`${owner.sei} ${owner.mei}`);
    // 大写し中の選択領域は 1 つで、Space でも戻れる
    const only = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(only).toHaveLength(1);
    fireEvent.keyDown(only[0]!, { key: " " });
    expect(stageView(container)).toBe("overview");
    // 戻ったら、さっきの部屋に選択が残っている
    expect(document.activeElement!.getAttribute("aria-label")).toMatch(/^101号室/);
  });

  it("Escape でも大写しから戻れる", () => {
    mockReduced(true);
    seedSave();
    const { container } = render(
      <GameScreen seed={1} storage={localStorage} now={() => NOW} />
    );
    const first = within(screen.getByRole("listbox")).getAllByRole("option")[0]!;
    fireEvent.keyDown(first, { key: "Enter" });
    expect(stageView(container)).toBe("closeup");
    fireEvent.keyDown(within(screen.getByRole("listbox")).getByRole("option"), {
      key: "Escape",
    });
    expect(stageView(container)).toBe("overview");
  });
});
