import { describe, it, expect, vi, afterEach } from "vitest";
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
