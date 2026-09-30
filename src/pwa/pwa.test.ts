import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { manifest } from "./manifest";
import { registerServiceWorker } from "./register";

describe("manifest", () => {
  it("必須項目を満たす", () => {
    expect(manifest.name).toBe("ひだまり荘");
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.display).toBe("standalone");
    expect(manifest.orientation).toBe("portrait");
    expect(manifest.start_url).toBe("/");
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("192/512 とマスカブルのアイコンを持つ", () => {
    const icons = manifest.icons ?? [];
    expect(icons.some((i) => i.sizes === "192x192")).toBe(true);
    expect(icons.some((i) => i.sizes === "512x512" && i.purpose === "any")).toBe(true);
    expect(icons.some((i) => i.purpose === "maskable")).toBe(true);
  });
});

describe("registerServiceWorker", () => {
  afterEach(() => vi.restoreAllMocks());

  it("service worker 非対応でも例外を出さない", () => {
    expect(() => registerServiceWorker(true, {} as Navigator)).not.toThrow();
  });

  it("無効指定なら登録しない", () => {
    const register = vi.fn().mockResolvedValue(undefined);
    registerServiceWorker(false, { serviceWorker: { register } } as unknown as Navigator);
    expect(register).not.toHaveBeenCalled();
  });

  it("有効なら /sw.js を登録し、失敗しても例外を出さない", async () => {
    const register = vi.fn().mockRejectedValue(new Error("boom"));
    expect(() =>
      registerServiceWorker(true, { serviceWorker: { register } } as unknown as Navigator)
    ).not.toThrow();
    await Promise.resolve();
    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });
});

// --- #21 案 B: タブが非表示から表示に戻ったとき、待機中の版を有効にして 1 回だけ再読み込みする ---

type Listener = () => void;

// イベントを発火できる最小の EventTarget もどき。時間には頼らず、テストが明示的に発火する
class FakeTarget {
  private listeners = new Map<string, Listener[]>();
  addEventListener(type: string, fn: Listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  emit(type: string) {
    for (const fn of this.listeners.get(type) ?? []) fn();
  }
  count(type: string) {
    return (this.listeners.get(type) ?? []).length;
  }
}

class FakeWorker extends FakeTarget {
  state = "installed";
  postMessage = vi.fn();
  activate() {
    this.state = "activated";
    this.emit("statechange");
  }
}

class FakeDoc extends FakeTarget {
  readyState = "complete";
  visibilityState: "visible" | "hidden" = "visible";
  set(state: "visible" | "hidden") {
    this.visibilityState = state;
    this.emit("visibilitychange");
  }
  hideAndShow() {
    this.set("hidden");
    this.set("visible");
  }
}

// register() が返す registration を差し替えて registerServiceWorker を起動する
async function setup(waiting: FakeWorker | null) {
  const doc = new FakeDoc();
  const container = new FakeTarget();
  const registration = { waiting } as unknown as ServiceWorkerRegistration;
  const register = vi.fn().mockResolvedValue(registration);
  const nav = {
    serviceWorker: Object.assign(container, { register }),
  } as unknown as Navigator;
  const reload = vi.fn();
  registerServiceWorker(true, nav, { doc: doc as unknown as Document, reload });
  await Promise.resolve();
  await Promise.resolve();
  return { doc, container, registration, reload, register };
}

describe("registerServiceWorker: 表示に戻ったときの更新 (#21)", () => {
  it("U1 待機中の版があれば、非表示→表示で SKIP_WAITING を 1 回送り、有効になったら再読み込みを 1 回呼ぶ", async () => {
    const waiting = new FakeWorker();
    const { doc, reload } = await setup(waiting);
    doc.hideAndShow();
    expect(waiting.postMessage).toHaveBeenCalledTimes(1);
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    waiting.activate();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("U2 待機中の版がなければ、非表示→表示でもメッセージも再読み込みも呼ばない", async () => {
    const { doc, reload } = await setup(null);
    doc.hideAndShow();
    expect(reload).not.toHaveBeenCalled();
  });

  it("U3 待機中の版があっても、表示のまま何もしなければ呼ばない", async () => {
    const waiting = new FakeWorker();
    const { reload } = await setup(waiting);
    expect(waiting.postMessage).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("U4 非表示→表示を 3 回続けても、再読み込みは 1 回だけ", async () => {
    const waiting = new FakeWorker();
    const { doc, reload } = await setup(waiting);
    doc.hideAndShow();
    doc.hideAndShow();
    doc.hideAndShow();
    waiting.activate();
    doc.hideAndShow();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(waiting.postMessage).toHaveBeenCalledTimes(1);
  });

  it("U5 SKIP_WAITING を送った直後（有効になる前）は再読み込みせず、有効になった時点で呼ぶ", async () => {
    const waiting = new FakeWorker();
    const { doc, reload } = await setup(waiting);
    doc.hideAndShow();
    expect(waiting.postMessage).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
    waiting.activate();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("U6 待機中の版が表示したまま届いても入れ替えない（非表示から戻ったときだけ）", async () => {
    const registration = { waiting: null as FakeWorker | null };
    const doc = new FakeDoc();
    const register = vi.fn().mockResolvedValue(registration);
    const nav = {
      serviceWorker: Object.assign(new FakeTarget(), { register }),
    } as unknown as Navigator;
    const reload = vi.fn();
    registerServiceWorker(true, nav, { doc: doc as unknown as Document, reload });
    await Promise.resolve();
    await Promise.resolve();
    const waiting = new FakeWorker();
    registration.waiting = waiting;
    doc.set("visible"); // 表示のままの通知（非表示を挟んでいない）
    expect(waiting.postMessage).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("U7 非対応・無効（開発中）・登録失敗では、例外を出さずイベントも購読しない", async () => {
    const doc = new FakeDoc();
    const reload = vi.fn();
    const deps = { doc: doc as unknown as Document, reload };
    // 非対応
    expect(() => registerServiceWorker(true, {} as Navigator, deps)).not.toThrow();
    // 無効（開発中）
    const container = Object.assign(new FakeTarget(), {
      register: vi.fn().mockResolvedValue({}),
    });
    registerServiceWorker(
      false,
      { serviceWorker: container } as unknown as Navigator,
      deps
    );
    // 登録失敗
    const failing = Object.assign(new FakeTarget(), {
      register: vi.fn().mockRejectedValue(new Error("boom")),
    });
    expect(() =>
      registerServiceWorker(
        true,
        { serviceWorker: failing } as unknown as Navigator,
        deps
      )
    ).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
    expect(doc.count("visibilitychange")).toBe(0);
    expect(container.count("controllerchange")).toBe(0);
    expect(failing.count("controllerchange")).toBe(0);
    expect(reload).not.toHaveBeenCalled();
  });

  it("U8 待機中の版への送信が例外を投げても、例外を出さず再読み込みもしない", async () => {
    const waiting = new FakeWorker();
    waiting.postMessage.mockImplementation(() => {
      throw new Error("boom");
    });
    const { doc, reload } = await setup(waiting);
    expect(() => doc.hideAndShow()).not.toThrow();
    waiting.activate();
    expect(reload).not.toHaveBeenCalled();
  });

  // --- 追加テスト ---

  it("追加: controllerchange が来た場合も再読み込みは 1 回だけ（statechange と両方来ても重複しない）", async () => {
    const waiting = new FakeWorker();
    const { doc, container, reload } = await setup(waiting);
    doc.hideAndShow();
    container.emit("controllerchange");
    waiting.activate();
    container.emit("controllerchange");
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("追加: 送信が失敗したあと、次に戻ったときにもう一度試せる", async () => {
    const waiting = new FakeWorker();
    waiting.postMessage.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    const { doc, reload } = await setup(waiting);
    doc.hideAndShow();
    doc.hideAndShow();
    expect(waiting.postMessage).toHaveBeenCalledTimes(2);
    waiting.activate();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("追加: 非表示のまま（戻っていない）では送らない", async () => {
    const waiting = new FakeWorker();
    const { doc } = await setup(waiting);
    doc.set("hidden");
    expect(waiting.postMessage).not.toHaveBeenCalled();
  });
});

describe("vite.config の service worker 更新方針", () => {
  it("skipWaiting / clientsClaim を無効にし、次回起動で切り替える", () => {
    const src = readFileSync(resolve(__dirname, "../../vite.config.ts"), "utf8");
    expect(src).toMatch(/skipWaiting:\s*false/);
    expect(src).toMatch(/clientsClaim:\s*false/);
  });
});
