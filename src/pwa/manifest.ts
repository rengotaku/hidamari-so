import type { ManifestOptions } from "vite-plugin-pwa";

// ゲーム本体の暗い背景色（src/ui/game.css の --g-bg）と揃える
export const PWA_BG = "#1d1b24";

export const manifest: Partial<ManifestOptions> = {
  name: "ひだまり荘",
  short_name: "ひだまり荘",
  description: "ぼろアパートの住人たちを見守る放置ゲーム",
  lang: "ja",
  start_url: "/",
  scope: "/",
  id: "/",
  display: "standalone",
  orientation: "portrait",
  theme_color: PWA_BG,
  background_color: PWA_BG,
  icons: [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    {
      src: "/icons/icon-maskable-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ],
};
