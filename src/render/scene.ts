import { defaultContent } from "@/content";
import type { TownLook, TownSlot } from "@/content/schema";
import {
  SCENE_H,
  SCENE_W,
  agingOf,
  buildingAge,
  hourOf,
  roomRect,
  ROOM_COUNT,
  townLooks,
  nightScenes,
  type GameState,
} from "@/sim";
import type { Ambient } from "./ambient";
import { BG, STARS } from "./background";
import { P, mix, shade } from "./palette";
import { drawWindowDecor } from "./decor";
import { drawCat, drawPerson } from "./person";
import { LANDLORD_LOOK, drawRoom, roomLit } from "./room";
import {
  drawSeasonBack,
  drawSeasonFront,
  seasonLook,
  seasonPhase,
  shovelerAt,
} from "./season";
import { drawCollector } from "./collector";
import { drawNightScenes } from "./night";
import { currentSky, nightness } from "./sky";
import { drawAging, drawTown, signBoard } from "./town";

const W = SCENE_W;
const H = SCENE_H;

function drawSkyAndTown(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  now: number,
  sky: string,
  n: number,
  looks: Record<TownSlot, TownLook>
): void {
  const h = hourOf(s.t);
  const wet = s.weather === "rain" || s.weather === "snow";
  P(ctx, 0, 0, W, H, sky);
  const hz = mix(
    sky,
    s.weather === "sunny" ? "#ffd8a8" : "#9aa0a8",
    0.18 * (1 - n * 0.6)
  );
  for (let k = 0; k < 5; k++) {
    ctx.globalAlpha = 0.25 + k * 0.15;
    P(ctx, 0, 110 + k * 12, W, 12, hz);
  }
  ctx.globalAlpha = 1;
  if (n > 0.3 && !wet) {
    for (const st of STARS) {
      ctx.globalAlpha = (n - 0.3) * (0.5 + 0.5 * Math.sin(now / 700 + st[2] * 20));
      P(ctx, st[0], st[1], 1, 1, "#ffffff");
    }
    ctx.globalAlpha = 1;
  }
  if (n > 0.5 && !wet) {
    P(ctx, 58, 18, 7, 7, "#f4efd0");
    P(ctx, 57, 19, 1, 5, "#f4efd0");
    P(ctx, 65, 19, 1, 5, "#f4efd0");
    P(ctx, 61, 19, 4, 5, sky);
  } else if (n < 0.6 && h > 5 && h < 19) {
    const t = (h - 5.5) / 13;
    const sx = 20 + t * 280;
    const sy = 60 - Math.sin(t * Math.PI) * 48;
    P(
      ctx,
      sx - 3,
      sy - 3,
      7,
      7,
      s.weather === "sunny" ? "#fff1c0" : mix(sky, "#ffffff", 0.3)
    );
  }
  if (s.weather !== "sunny") {
    const cc =
      s.weather === "rain" ? mix(sky, "#3c4048", 0.5) : mix(sky, "#e8e8ec", 0.35);
    for (let k = 0; k < 5; k++) {
      const cx = ((k * 97 + (now / 1000) * 2) % 420) - 50;
      const cy = 10 + k * 9;
      P(ctx, cx, cy, 34, 6, cc);
      P(ctx, cx + 6, cy - 4, 20, 4, cc);
    }
  }
  // 電線（電柱が地中化されると無くなる）
  if (looks.pole === "pole") {
    ctx.strokeStyle = "#1e1c22";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 22.5);
    ctx.quadraticCurveTo(160, 40, 320, 24.5);
    ctx.moveTo(0, 27.5);
    ctx.quadraticCurveTo(160, 45, 320, 29.5);
    ctx.stroke();
  }
  if (h >= 5 && h < 8) {
    P(ctx, 210, 30, 4, 3, "#1a1a1f");
    P(ctx, 213, 29, 2, 2, "#1a1a1f");
    P(ctx, 211, 33, 1, 1, "#1a1a1f");
  }
  const bgc = mix(sky, "#1c1f2a", 0.62);
  for (const b of BG) {
    const top = 172 - b.h;
    P(ctx, b.x, top, b.w, b.h, bgc);
    if (b.roof)
      for (let k = 0; k < 4; k++)
        P(ctx, b.x - 1 + k, top - 4 + k, b.w + 2 - 2 * k, 1, bgc);
    if (n > 0.4) for (const w of b.wins) if (w[2]) P(ctx, w[0], w[1], 2, 2, "#e9c877");
  }
}

function drawBuildingShell(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  n: number,
  signColor: string
): void {
  const roof = "#65747c";
  for (let r = 0; r < 14; r++) P(ctx, 28 - r, 56 + r, 228 + 2 * r, 1, roof);
  for (let xx = 20; xx < 266; xx += 5) P(ctx, xx, 58, 1, 11, shade(roof, -18));
  for (const q of [
    [60, 60, 6, 3],
    [140, 63, 5, 2],
    [210, 59, 7, 4],
    [96, 66, 4, 2],
  ])
    P(ctx, q[0]!, q[1]!, q[2]!, q[3]!, "#8a4b2e");
  P(ctx, 14, 69, 256, 1, "#3b3432");
  P(ctx, 120, 50, 1, 6, "#3b2f2a");
  P(ctx, 164, 50, 1, 6, "#3b2f2a");
  P(ctx, 111, 39, 62, 13, "#3b2f2a");
  P(ctx, 112, 40, 60, 11, signColor);
  const siding = "#8a785c";
  for (const q of [
    [24, 4],
    [256, 4],
    [102, 3],
    [179, 3],
  ]) {
    P(ctx, q[0]!, 70, q[1]!, 100, siding);
    P(ctx, q[0]!, 70, 1, 100, shade(siding, -20));
  }
  P(ctx, 24, 118, 236, 4, "#5a4636");
  P(ctx, 24, 121, 236, 1, "#3e3026");
  P(ctx, 22, 170, 240, 4, "#7c7871");
  P(ctx, 80, 171, 1, 2, "#5c5852");
  P(ctx, 81, 172, 2, 1, "#5c5852");
  P(ctx, 200, 170, 1, 3, "#5c5852");
  P(ctx, 0, 174, W, 8, s.weather === "rain" ? "#77736d" : "#8f8a82");
  for (let k = 0; k < W; k += 16) P(ctx, k, 174, 1, 8, "#7a766e");
  P(ctx, 0, 182, W, 1, "#6d6961");
  P(ctx, 0, 183, W, 17, s.weather === "rain" ? "#3a3b42" : "#4a4a50");
  for (let k = 0; k < W; k += 20) P(ctx, k + 4, 192, 10, 1, "#c9c6b8");
  // 外階段
  P(ctx, 260, 118, 22, 3, "#6d5646");
  P(ctx, 260, 106, 21, 1, "#6d5646");
  for (const px of [260, 270, 280]) P(ctx, px, 106, 1, 12, "#6d5646");
  for (let k = 0; k <= 24; k++) {
    const sx = 279 + k;
    const sy = 120 + (k * 52) / 24;
    P(ctx, sx, sy, 2, 2, k % 7 === 3 ? "#9a5a3a" : "#7a5040");
    P(ctx, sx, sy - 11, 1, 1, "#6d5646");
    if (k % 3 === 0) P(ctx, sx - 3, sy, 6, 1, "#8a6a55");
  }
  // 街灯
  P(ctx, 1, 110, 2, 64, "#3d3f46");
  P(ctx, 1, 110, 9, 1, "#3d3f46");
  P(ctx, 7, 111, 4, 2, n > 0.2 ? "#fff4c8" : "#d8d8d8");
}

function drawSelection(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  selectedId: number | null,
  now: number
): void {
  if (selectedId === null) return;
  const r = s.res.find((x) => x.id === selectedId);
  if (!r) return;
  ctx.strokeStyle = Math.floor(now / 500) % 2 ? "#e7b25a" : "#f6d68e";
  ctx.lineWidth = 1;
  if (typeof r.at === "number") {
    const rr = roomRect(r.at);
    ctx.strokeRect(rr.x + 0.5, rr.y + 0.5, 73, 47);
  } else if (r.at === "walking") {
    P(ctx, r.x - 1, r.y - 19, 3, 2, "#e7b25a");
    P(ctx, r.x, r.y - 17, 1, 1, "#e7b25a");
  }
}

/**
 * 建物断面の 1 フレームを描く。状態を受け取って描くだけで、状態は書き換えない。
 * now は演出用の時計（ミリ秒）で、ゲーム内時間とは別。
 */
export function drawScene(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  ambient: Ambient,
  now: number,
  selectedId: number | null
): void {
  const h = hourOf(s.t);
  const n = nightness(h);
  const sky = currentSky(s);
  const frame = Math.floor(now / 260) % 2;
  const { season } = seasonPhase(s);
  const looks = townLooks(defaultContent, s);
  const aging = agingOf(buildingAge(s.t, s.t0));
  // 衣替え: 描くときだけ季節の服にした見た目を使う（状態は書き換えない）
  const sv: GameState = {
    ...s,
    res: s.res.map((r) => ({ ...r, look: seasonLook(r.look, season) })),
  };
  drawSkyAndTown(ctx, s, now, sky, n, looks);
  drawTown(ctx, looks, n);
  drawSeasonBack(ctx, s, sky, n);
  drawBuildingShell(ctx, s, n, signBoard(aging));
  drawAging(ctx, aging);
  drawSeasonFront(ctx, s, now, n);
  const shoveler = shovelerAt(s);
  // 雪かき役は、その時間に屋外を歩いていない住人のうち id が最小の人。いなければ出さない
  const first = sv.res
    .filter((r) => r.at !== "walking")
    .reduce<
      (typeof sv.res)[number] | undefined
    >((m, r) => (m && m.id <= r.id ? m : r), undefined);
  if (shoveler && first)
    drawPerson(
      ctx,
      first.look,
      shoveler.x,
      181,
      "walk",
      Math.floor(now / 260) % 2,
      false,
      "shovel"
    );
  drawCat(ctx, ambient.cat.x, 178, frame);
  const walkFr = Math.floor(now / 180) % 2;
  for (const w of ambient.walkers) {
    drawPerson(
      ctx,
      seasonLook(w.look, season),
      w.x,
      w.y,
      "walk",
      walkFr,
      w.dir < 0,
      w.prop
    );
    if (w.dog) {
      const dx = Math.round(w.x + (w.dir < 0 ? -8 : 8));
      const dy = Math.round(w.y);
      P(ctx, dx - 2, dy - 3, 5, 2, "#f2efe6");
      P(ctx, w.dir < 0 ? dx - 3 : dx + 2, dy - 4, 2, 2, "#f2efe6");
      P(ctx, dx - 2, dy - 1, 1, 1, "#8a7a6a");
      P(ctx, dx + 2, dy - 1, 1, 1, "#8a7a6a");
    }
  }
  for (const r of sv.res) {
    if (r.at !== "walking") continue;
    const prop =
      r.outPurpose === "sento"
        ? "basin"
        : r.outPurpose === "konbini" && r.walkMode === "return"
          ? "bag"
          : null;
    drawPerson(ctx, r.look, r.x, r.y, "walk", walkFr, r.dir < 0, prop);
  }
  const L = s.landlord;
  if (L.phase === "up" || L.phase === "escort" || L.phase === "down") {
    drawPerson(ctx, LANDLORD_LOOK, L.x, L.y, "walk", walkFr, L.dir < 0, null);
    // 連れてきた新しい住人は、大家の一歩後ろを荷物を抱えてついてくる
    if (L.escort)
      drawPerson(
        ctx,
        L.escort.look,
        L.x - L.dir * 9,
        L.y,
        "walk",
        walkFr,
        L.dir < 0,
        "bag"
      );
  }
  drawCollector(ctx, s, now);
  if (s.weather === "rain") {
    ctx.fillStyle = "rgba(170,200,235,0.55)";
    for (let k = 0; k < 90; k++) {
      const rx = ((k * 37 + now * 0.06) % 336) - 8;
      const ry = ((k * 53 + now * 0.22) % 210) - 10;
      ctx.fillRect(Math.round(rx), Math.round(ry), 1, 3);
    }
  }
  // 部屋は、暗い夜のフィルターの前に描くものと、明かりのついた部屋（フィルターの後）に分ける
  const lits: number[] = [];
  // 夜の場面の部屋は明かりを消す（あとで暗くしてハートを浮かべる）
  const nights = nightScenes(s);
  for (let i = 0; i < ROOM_COUNT; i++) {
    if (roomLit(s, i, n) && !nights.some((sc) => sc.room === i)) lits.push(i);
    else drawRoom(ctx, sv, i, now, sky, false);
  }
  if (n > 0) {
    ctx.fillStyle = `rgba(12,14,38,${(n * 0.55).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }
  for (const i of lits) {
    drawRoom(ctx, sv, i, now, sky, true);
    if (n > 0.3) {
      const rr = roomRect(i);
      P(ctx, rr.x + 7, rr.y + 9, 18, 13, mix("#f2d38a", sky, 0.35));
      const id = s.rooms[i] ?? null;
      const owner = id === null ? undefined : s.res.find((r) => r.id === id);
      if (owner) {
        P(ctx, rr.x + 7, rr.y + 9, 4, 13, owner.look.curtain);
        P(ctx, rr.x + 21, rr.y + 9, 4, 13, owner.look.curtain);
      }
      P(ctx, rr.x + 16, rr.y + 9, 1, 13, "#6b4b32");
      drawWindowDecor(ctx, s, i, rr.x, rr.y);
    }
  }
  if (n > 0.2) {
    const g = ctx.createRadialGradient(9, 113, 1, 9, 150, 48);
    g.addColorStop(0, `rgba(255,226,150,${(0.32 * n).toFixed(3)})`);
    g.addColorStop(1, "rgba(255,226,150,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 100, 70, 100);
  }
  drawNightScenes(ctx, nights, now);
  drawSelection(ctx, s, selectedId, now);
}
