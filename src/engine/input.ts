import type { Vec2 } from './types';

export interface PointerTarget {
  onDown(p: Vec2): void;
  onMove(p: Vec2): void;
  onUp(p: Vec2): void;
}

function localPoint(canvas: HTMLCanvasElement, e: PointerEvent): Vec2 {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
}

/**
 * Attach pointer + touch handling. The canvas is expected to be sized in CSS
 * pixels with the backing store scaled by devicePixelRatio, so client
 * coordinates map 1:1 to our drawing space.
 */
export function attachPointer(
  canvas: HTMLCanvasElement,
  target: PointerTarget,
): () => void {
  let active = false;

  const down = (e: PointerEvent) => {
    active = true;
    canvas.setPointerCapture?.(e.pointerId);
    target.onDown(localPoint(canvas, e));
    e.preventDefault();
  };
  const move = (e: PointerEvent) => {
    if (!active) return;
    target.onMove(localPoint(canvas, e));
    e.preventDefault();
  };
  const up = (e: PointerEvent) => {
    if (!active) return;
    active = false;
    canvas.releasePointerCapture?.(e.pointerId);
    target.onUp(localPoint(canvas, e));
    e.preventDefault();
  };

  canvas.addEventListener('pointerdown', down, { passive: false });
  canvas.addEventListener('pointermove', move, { passive: false });
  canvas.addEventListener('pointerup', up, { passive: false });
  canvas.addEventListener('pointercancel', up, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return () => {
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', up);
  };
}
