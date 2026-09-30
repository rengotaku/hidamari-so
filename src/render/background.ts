import { createRng } from "@/sim";

/** 固定の背景（毎回同じ町並みと星空）。描画専用の固定シードで作る */
export interface BgBuilding {
  x: number;
  w: number;
  h: number;
  roof: boolean;
  wins: Array<[number, number, boolean]>;
}

function build(): { buildings: BgBuilding[]; stars: Array<[number, number, number]> } {
  const rng = createRng(47);
  const r = () => rng.next();
  const buildings: BgBuilding[] = [];
  let x = -6;
  while (x < 330) {
    const w = 18 + Math.floor(r() * 26);
    const h = 26 + Math.floor(r() * 44);
    const roof = r() < 0.5;
    const wins: BgBuilding["wins"] = [];
    for (let k = 0; k < 3; k++) {
      wins.push([
        x + 3 + Math.floor(r() * (w - 6)),
        172 - h + 6 + Math.floor(r() * (h - 14)),
        r() < 0.45,
      ]);
    }
    buildings.push({ x, w, h, roof, wins });
    x += w + Math.floor(r() * 4);
  }
  const stars: Array<[number, number, number]> = [];
  for (let k = 0; k < 40; k++)
    stars.push([Math.floor(r() * 320), Math.floor(r() * 95), r()]);
  return { buildings, stars };
}

const built = build();
export const BG = built.buildings;
export const STARS = built.stars;
