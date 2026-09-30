import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, within, act } from "@testing-library/react";
import { createRng, newGame, step, type GameState } from "@/sim";
import { SAVE_KEY, loadGame, saveGame } from "@/save";
import { GameScreen } from "@/ui/GameScreen";

const NOW = 5_000_000;
const DAY = 1440;
const BUTTON_SELECTOR =
  'button, [role="button"], input[type="button"], input[type="submit"]';

/**
 * 選択肢になるボタン。時間の速さを切り替える SpeedControl（停止/1/4/15倍）は、
 * 物語の選択ではなく表示の操作なので数えない。
 */
function choiceButtons(root: ParentNode): Element[] {
  return [...root.querySelectorAll(BUTTON_SELECTOR)].filter(
    (b) => !b.closest('[aria-label="時間の速さ"]')
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** 開始から days 日進めた状態を保存しておく */
function saveAfter(days: number, seed = 31337): GameState {
  const rng = createRng(seed);
  const s = step(newGame(rng), days * DAY, rng);
  saveGame(localStorage, s, rng.getState(), NOW);
  return s;
}

const open = () => render(<GameScreen seed={1} storage={localStorage} now={() => NOW} />);

describe("C8: 記念日のダイアログ以外に操作ボタン（選択肢）が無い", () => {
  it("ふだんの画面には、ボタンもダイアログも無い", () => {
    const s = saveAfter(10);
    expect(s.buyout.phase).toBe("none");
    const { container } = open();
    expect(choiceButtons(container).length).toBe(0);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("記念日には、ダイアログの中の「売る」「断る」だけがボタンで、外には無い", () => {
    const s = saveAfter(54);
    expect(s.buyout.phase).toBe("pending");
    const { container } = open();
    const dialog = screen.getByRole("dialog", { name: "築五十年の記念日" });
    const inside = choiceButtons(dialog);
    expect([...inside].map((b) => b.textContent)).toEqual(["売る", "断る"]);
    expect(choiceButtons(container).length).toBe(inside.length);
    // 買収の話と住人の一言が出ている
    expect(dialog.textContent).toContain("買い取りたい");
    expect(dialog.textContent).toContain("さん「");
  });

  it("追加: 返事待ちは速さが停止で、速さのボタンを押しても変わらない。断ると 1 倍に戻る", () => {
    saveAfter(54);
    open();
    const pressed = () =>
      screen
        .getAllByRole("button", { pressed: true })
        .map((b) => b.textContent)
        .join();
    expect(pressed()).toBe("停止");
    fireEvent.click(screen.getByRole("button", { name: "15倍" }));
    expect(pressed()).toBe("停止");
    fireEvent.click(screen.getByRole("button", { name: "断る" }));
    expect(pressed()).toBe("1倍");
  });

  it("「断る」を押すとダイアログもボタンも消え、続行が保存される", () => {
    saveAfter(54);
    const { container } = open();
    fireEvent.click(screen.getByRole("button", { name: "断る" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(choiceButtons(container).length).toBe(0);
    expect(loadGame(localStorage)!.state.buyout.phase).toBe("declined");
  });

  it("追加: 「売る」を押すと結末だけが出て、ボタンは無い。開き直すと新しいゲームになる", () => {
    saveAfter(54);
    const { container, unmount } = open();
    fireEvent.click(screen.getByRole("button", { name: "売る" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.getByRole("status", { name: "ひだまり荘の結末" }).textContent
    ).toContain("更地");
    expect(choiceButtons(container).length).toBe(0);
    expect(JSON.parse(localStorage.getItem(SAVE_KEY)!).state.buyout.phase).toBe("sold");
    unmount();
    cleanup();
    open();
    expect(screen.queryByRole("status", { name: "ひだまり荘の結末" })).toBeNull();
  });
});

describe("追加: 出ていった住人", () => {
  it("日誌の名前を押すと、プロフィールと最後の出来事が出る（ボタンではない）", () => {
    const rng = createRng(7);
    let s = newGame(rng);
    const target = s.res[0]!;
    s.booked.push({
      id: "farewell-party",
      at: s.t + 60,
      roles: { a: target.id },
      tries: 0,
    });
    for (let i = 0; i < 6 * 24 && s.res.some((r) => r.id === target.id); i++)
      s = step(s, 60, rng);
    expect(s.departed.some((d) => d.id === target.id)).toBe(true);
    saveGame(localStorage, s, rng.getState(), NOW);
    const { container } = open();
    const journal = screen.getByRole("log", { name: "日誌" });
    const names = within(journal).getAllByRole("link", { name: target.sei });
    fireEvent.click(names[0]!);
    const profile = screen.getByRole("region", { name: "出ていった住人のプロフィール" });
    expect(profile.textContent).toContain(`${target.sei} ${target.mei}`);
    expect(profile.textContent).toContain("ひだまり荘を出ていった");
    expect(profile.textContent).toContain("最後の出来事");
    expect(choiceButtons(container).length).toBe(0);
  });
});

/**
 * 記念日の 1 時間前の保存を開き、部屋の選択肢にフォーカスを置いてから、フレームを回して pending まで進める。
 * フォーカスを置いた部屋の選択肢を返す
 */
function openUntilPending(): { container: HTMLElement; room: HTMLElement } {
  const rng = createRng(31337);
  let next = step(newGame(rng), 40 * DAY, rng);
  let prev = structuredClone(next);
  let prevRng = rng.getState();
  while (next.buyout.phase !== "pending") {
    prev = structuredClone(next);
    prevRng = rng.getState();
    next = step(next, 60, rng);
  }
  saveGame(localStorage, prev, prevRng, NOW);
  // jsdom は inert によるフォーカス外しを実装しないので、ブラウザと同じく inert が付いた時点で body へ外す
  // jsdom は inert を実装しない。ブラウザと同じく、inert が付いた時点でその中のフォーカスを body へ外し、
  // inert の中の要素への focus() は効かないようにする（React が commit 後にフォーカスを戻そうとしても戻らない）
  const setAttribute = Element.prototype.setAttribute;
  vi.spyOn(Element.prototype, "setAttribute").mockImplementation(function (
    this: Element,
    name: string,
    value: string
  ) {
    setAttribute.call(this, name, value);
    const active = document.activeElement;
    if (name === "inert" && active instanceof HTMLElement && this.contains(active))
      active.blur();
  });
  const focus = HTMLElement.prototype.focus;
  vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(function (
    this: HTMLElement
  ) {
    if (!this.closest("[inert]")) focus.call(this);
  });
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => frames.push(cb));
  const { container } = open();
  const room = screen.getAllByRole("option")[0] as HTMLElement;
  act(() => room.focus());
  expect(document.activeElement).toBe(room);
  let t = 0;
  for (let i = 0; i < 400 && !screen.queryByRole("dialog"); i++) {
    t += 250;
    const cb = frames.shift()!;
    act(() => cb(t));
  }
  return { container, room };
}

describe("ダイアログのフォーカスと背景の inert（#37 事前設計）", () => {
  it("1: pending の保存を開くと、フォーカスがダイアログ内にあり、「売る」ではない", () => {
    saveAfter(54);
    open();
    const dialog = screen.getByRole("dialog", { name: "築五十年の記念日" });
    const active = document.activeElement as HTMLElement;
    expect(dialog.contains(active)).toBe(true);
    expect(active.textContent).not.toBe("売る");
  });

  it("2: 部屋の選択肢にフォーカスしてから pending まで進めると、フォーカスがダイアログへ移る", () => {
    const { room } = openUntilPending();
    const dialog = screen.getByRole("dialog", { name: "築五十年の記念日" });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(room);
  });

  it("3: pending のあいだ header と main は inert で、ダイアログには inert な祖先が無い", () => {
    saveAfter(54);
    const { container } = open();
    expect(container.querySelector("header")!.hasAttribute("inert")).toBe(true);
    expect(container.querySelector("main")!.hasAttribute("inert")).toBe(true);
    const dialog = screen.getByRole("dialog", { name: "築五十年の記念日" });
    expect(dialog.closest("[inert]")).toBeNull();
  });

  it("4: 「断る」を押すと inert が外れ、フォーカスが元の部屋の選択肢に戻る", () => {
    const { container, room } = openUntilPending();
    fireEvent.click(screen.getByRole("button", { name: "断る" }));
    expect(container.querySelector("[inert]")).toBeNull();
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(room);
  });
});
