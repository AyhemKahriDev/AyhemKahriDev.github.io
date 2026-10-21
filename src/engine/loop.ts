/**
 * Fixed-timestep game loop. Keeps physics identical on a 60Hz laptop and a
 * 120Hz phone, and pauses cleanly when the tab is hidden.
 */
export interface Loop {
  stop(): void;
  paused(): boolean;
  setPaused(p: boolean): void;
}

export function startLoop(
  update: (dt: number) => void,
  opts: { step?: number; maxFrame?: number } = {},
): Loop {
  const step = opts.step ?? 1 / 120;
  const maxFrame = opts.maxFrame ?? 0.25;
  let last = performance.now();
  let acc = 0;
  let raf = 0;
  let paused = false;

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > maxFrame) dt = maxFrame;
    if (paused) return;
    acc += dt;
    let guard = 0;
    while (acc >= step && guard < 600) {
      update(step);
      acc -= step;
      guard++;
    }
    if (guard >= 600) acc = 0;
  };

  const onVisibility = () => {
    last = performance.now();
    acc = 0;
    paused = document.hidden;
  };

  document.addEventListener('visibilitychange', onVisibility);
  raf = requestAnimationFrame(frame);

  return {
    stop() {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
    },
    paused: () => paused,
    setPaused(p: boolean) {
      paused = p;
      last = performance.now();
      acc = 0;
    },
  };
}
