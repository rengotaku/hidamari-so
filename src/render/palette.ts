/** 色の計算と 1 ドットぶんの塗り */
function hex2(c: string): [number, number, number] {
  const h = c.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function mix(a: string, b: string, t: number): string {
  const A = hex2(a);
  const B = hex2(b);
  return (
    "#" +
    A.map((v, i) =>
      Math.round(v + (B[i]! - v) * t)
        .toString(16)
        .padStart(2, "0")
    ).join("")
  );
}

/** amt が負なら暗く、正なら明るく（-100〜100） */
export const shade = (c: string, amt: number): string =>
  amt < 0 ? mix(c, "#000000", -amt / 100) : mix(c, "#ffffff", amt / 100);

export function P(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  c: string
): void {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}
