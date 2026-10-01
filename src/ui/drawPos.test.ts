import { describe, it, expect, afterEach } from "vitest";
import { applyDrawPositions, bubbleAnchor, hitTest } from "@/render";
import { createRng, newGame, step, type Resident } from "@/sim";
import { SAVE_KEY } from "@/save";
import { bubbleAnchors } from "./bubbles";
import { GameEngine } from "./engine";
import { initialZoom } from "./zoom";

afterEach(() => localStorage.clear());

describe("描く位置と速さの既定（#68 事前設計）", () => {
  it("S4: 15 倍で 1 日進めても GameState は仕組みなしの step と同じで、描く位置は状態にも保存にも入らない", () => {
    const e = GameEngine.open(localStorage, 11, 1000);
    expect(e.speed).toBe(15);
    const rng = createRng(11);
    let ref = newGame(rng);
    for (let i = 0; i < 48; i++) {
      e.tick(2); // 15 倍で 30 分ぶん
      e.followDraw(0.016);
      ref = step(ref, 30, rng);
    }
    expect(e.state).toEqual(ref);
    e.save(localStorage, 2000);
    const saved = localStorage.getItem(SAVE_KEY)!;
    expect(saved).not.toMatch(/drawPos/);
    expect(JSON.stringify(e.state)).not.toMatch(/drawPos/);
  });

  it("S5: 保存が無いときの速さは 15、速さ 1 で保存したものを開くと 1", () => {
    expect(GameEngine.open(localStorage, 3, 1000).speed).toBe(15);
    localStorage.clear();
    const e = GameEngine.open(localStorage, 3, 1000);
    e.setSpeed(1);
    e.save(localStorage, 2000);
    expect(GameEngine.open(localStorage, 3, 2000).speed).toBe(1);
  });

  it("S6: 停止中も、描く位置はゲームの中の位置へ追いつく", () => {
    const e = GameEngine.open(localStorage, 3, 1000);
    const id = e.state.res.find((r) => typeof r.at === "number")!.id;
    e.followDraw(0);
    e.setSpeed(0);
    e.state = {
      ...e.state,
      res: e.state.res.map((r) => (r.id === id ? { ...r, x: r.x + 40 } : r)),
    };
    const target = e.state.res.find((r) => r.id === id)!.x;
    const at = () =>
      applyDrawPositions(e.state.res, e.drawPos).find((r) => r.id === id)!.x;
    e.followDraw(0.5);
    expect(at()).toBeLessThan(target);
    for (let i = 0; i < 20; i++) e.followDraw(0.5);
    expect(at()).toBe(target);
  });
});

describe("吹き出しと当たり判定は描く位置にもとづく（#68 追加）", () => {
  /** 住人 id を patch で書き換えた状態にして、描く位置を 1 回合わせてから、動かして 0.5 秒追わせる */
  const moved = (patch: (r: Resident) => Resident, to: (r: Resident) => Resident) => {
    const e = GameEngine.open(localStorage, 3, 1000);
    const id = e.state.res[0]!.id;
    const apply = (f: (r: Resident) => Resident) => {
      e.state = { ...e.state, res: e.state.res.map((r) => (r.id === id ? f(r) : r)) };
    };
    apply(patch);
    e.followDraw(0);
    apply(to);
    e.followDraw(0.5);
    const game = e.state.res.find((r) => r.id === id)!;
    const drawn = applyDrawPositions(e.state.res, e.drawPos).find((r) => r.id === id)!;
    return { e, id, game, drawn };
  };

  it("B1: 部屋の中で 60 ドット動いた直後、吹き出しの x は描く位置にもとづき、ゲームの中の位置ではない", () => {
    const { e, id, game, drawn } = moved(
      (r) => ({ ...r, at: 0, x: 100, tx: 100, act: "return" }),
      (r) => ({ ...r, x: 160, tx: 160 })
    );
    expect(game.x - drawn.x).toBeGreaterThan(50);
    const anchor = bubbleAnchors(e.state, initialZoom, e.drawPos).get(id)!;
    expect(anchor.x).toBe(bubbleAnchor(drawn)!.x);
    expect(anchor.x).not.toBe(game.x);
    // drawPos を渡さなければ今までどおりゲームの中の位置
    expect(bubbleAnchors(e.state, initialZoom).get(id)!.x).toBe(game.x);
  });

  it("B2: 描く位置を押すとその住人に当たり、ゲームの中の位置（20 ドット以上離れた場所）を押しても当たらない", () => {
    const { e, id, game, drawn } = moved(
      (r) => ({
        ...r,
        at: "walking",
        path: [
          [302, 179],
          [-12, 179],
        ],
        pi: 1,
        x: 302,
        y: 179,
      }),
      (r) => ({ ...r, x: 202 })
    );
    expect(Math.abs(game.x - drawn.x)).toBeGreaterThan(20);
    expect(hitTest(e.state, drawn.x, drawn.y - 5, e.drawPos)?.residentId).toBe(id);
    expect(hitTest(e.state, game.x, game.y - 5, e.drawPos)?.residentId ?? null).not.toBe(
      id
    );
    // drawPos を渡さなければ今までどおりゲームの中の位置で当たる
    expect(hitTest(e.state, game.x, game.y - 5)?.residentId).toBe(id);
  });
});
