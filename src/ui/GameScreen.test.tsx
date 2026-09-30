import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { createRng, newGame, step } from "@/sim";
import { saveGame } from "@/save";
import { GameScreen } from "@/ui/GameScreen";

const NOW = 5_000_000;

/** 10 日ぶん進めた保存データを用意する（日誌に中身がある状態） */
function seedSave() {
  const rng = createRng(31341);
  let s = newGame(rng);
  for (let i = 0; i < 10 * 24; i++) s = step(s, 60, rng);
  saveGame(localStorage, s, rng.getState(), NOW);
  return s;
}

beforeEach(() => {
  localStorage.clear();
  // jsdom には Canvas 2D が無い。描画はスキップされる。
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);
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

/** 日付・時刻・築年数・年齢・部屋番号・速さの倍率は数字を許す。それ以外に数字が残ったら NG */
function digitsOutsideAllowed(text: string): string[] {
  const stripped = text
    .replace(/\d{1,2}:\d{2}/g, "") // 時刻を先に消す（「00:00日が高い」の 00日 を日付と誤認しない）
    .replace(/\d+日目?/g, "")
    .replace(/築\d+年/g, "")
    .replace(/\d+歳/g, "")
    .replace(/\d+倍/g, "") // 時間の速さのボタン（1倍・4倍・15倍）
    .replace(/[12]0[1-3]/g, "");
  return stripped.match(/[0-9０-９]+/g) ?? [];
}

describe("A6: 画面に数値を出さない", () => {
  it("初期表示・日誌・プロフィールに気分・所持金・評判などの数値が出ていない", () => {
    seedSave();
    const { container } = render(
      <GameScreen seed={1} storage={localStorage} now={() => NOW} />
    );
    // 建物を押してプロフィールを出す（全部屋を順に押して全住人ぶん確認）
    for (let room = 0; room < 6; room++) {
      clickRoom(screen.getByRole("img"), room);
      const leftovers = digitsOutsideAllowed(container.textContent ?? "");
      expect(leftovers, `部屋 ${room} を押した後の画面に数字が残っている`).toEqual([]);
    }
    expect(container.textContent).not.toMatch(/[¥￥円%％]/);
    expect(
      container.querySelector('[role="progressbar"], [role="meter"], progress, meter')
    ).toBeNull();
  });

  it("追加: 日付・時刻と築年数だけが画面上部にあり、天気・タイトルの文字は無い", () => {
    seedSave();
    render(<GameScreen seed={1} storage={localStorage} now={() => NOW} />);
    const header = screen.getByRole("banner");
    // 時間の速さのボタン（#14）は別枠。日付・時刻・築年数の並びだけを見る
    const text = [...header.children]
      .filter((el) => !el.classList.contains("speed"))
      .map((el) => el.textContent)
      .join("");
    expect(text).toMatch(/^\d+日目 \d{2}:\d{2}築\d+年$/);
  });

  it("追加: 操作は時間の速さの 4 ボタンだけで、入力欄が無い", () => {
    seedSave();
    const { container } = render(
      <GameScreen seed={1} storage={localStorage} now={() => NOW} />
    );
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "停止",
      "1倍",
      "4倍",
      "15倍",
    ]);
    expect(container.querySelector("input, select, textarea")).toBeNull();
  });
});

describe("追加: 住人を押すとプロフィールが言葉だけで出る", () => {
  it("名前・年齢・職業・だめなところ・いま何をしているかが出る", () => {
    const s = seedSave();
    render(<GameScreen seed={1} storage={localStorage} now={() => NOW} />);
    const owner = s.res.find((r) => r.room === 1)!;
    clickRoom(screen.getByRole("img"), 1);
    const profile = screen.getByRole("region", { name: "住人のプロフィール" });
    expect(profile.textContent).toContain(`${owner.sei} ${owner.mei}`);
    expect(profile.textContent).toContain(`${owner.age}歳`);
    expect(profile.textContent).toContain("だめなところ");
    expect(profile.textContent).toContain("いま");
  });

  it("空室を押すとプロフィールは出ない", () => {
    // 大家が空室に入居者を入れるので、3 番目の部屋を空けた保存を用意する
    const s = seedSave();
    const gone = s.res.find((r) => r.room === 2);
    if (gone) {
      s.res = s.res.filter((r) => r !== gone);
      s.rooms[2] = null;
    }
    saveGame(localStorage, s, 1, NOW);
    // 部屋を押すと大写し（#8）になり、遷移の途中の押下は無視される。遷移を即座にして順に押す
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: true, media: q }));
    render(<GameScreen seed={1} storage={localStorage} now={() => NOW} />);
    clickRoom(screen.getByRole("img"), 1);
    expect(screen.queryByRole("region", { name: "住人のプロフィール" })).not.toBeNull();
    clickRoom(screen.getByRole("img"), 1); // 大写しから全体図に戻る
    clickRoom(screen.getByRole("img"), 2);
    expect(screen.queryByRole("region", { name: "住人のプロフィール" })).toBeNull();
  });

  it("日誌が表示される", () => {
    seedSave();
    render(<GameScreen seed={1} storage={localStorage} now={() => NOW} />);
    const journal = screen.getByRole("log", { name: "日誌" });
    expect(journal.textContent!.length).toBeGreaterThan(0);
  });
});
