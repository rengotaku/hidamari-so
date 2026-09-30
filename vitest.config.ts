import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/test/**",
        "src/main.tsx",
        "src/vite-env.d.ts",
        // shared-react-ui primitive: shipped to every template via compose
        // even when not referenced by app code. Coverage is enforced via
        // shared-react-ui's gallery, not via per-template integration.
        "src/components/ui/time-picker.tsx",
        // shared-react-ui primitive: vendored via compose but has no
        // dedicated test suite in this template (unlike react-spa, which
        // tests it directly). Excluded from this template's 80% coverage
        // gate for the same reason as time-picker.tsx above.
        "src/components/ui/image-drop-zone.tsx",
      ],
    },
  },
});
