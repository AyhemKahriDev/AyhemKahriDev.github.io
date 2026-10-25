/** Shared canvas helpers and the site palette. */

export const INK = '#08090a';
export const PANEL = '#16191d';
export const PANEL_2 = '#242931';
export const TEXT = '#f6f3eb';
export const MUTED = '#9b978d';
export const GRID_LINE = '#2c3138';
export const FONT = "'Outfit', ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif";

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export function fillRound(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  stroke?: string,
): void {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

export function setFont(
  ctx: CanvasRenderingContext2D,
  size: number,
  weight: number | string = 700,
): void {
  ctx.font = `${weight} ${size}px ${FONT}`;
}

/** Shrink the font until the text fits, then draw it centred in the box. */
export function drawFitCenter(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  maxWidth: number,
  size: number,
  weight: number | string = 700,
  minSize = 8,
): void {
  let s = size;
  do {
    setFont(ctx, s, weight);
    if (ctx.measureText(text).width <= maxWidth || s <= minSize) break;
    s -= 1;
  } while (s > minSize);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy);
}

export function drawFitLeft(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  cy: number,
  maxWidth: number,
  size: number,
  weight: number | string = 700,
  minSize = 8,
): void {
  let s = size;
  do {
    setFont(ctx, s, weight);
    if (ctx.measureText(text).width <= maxWidth || s <= minSize) break;
    s -= 1;
  } while (s > minSize);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, cy);
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Soft radial glow behind a shape. */
export function glow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  alpha = 0.35,
): void {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  g.addColorStop(0, hexToRgba(color, alpha));
  g.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}
