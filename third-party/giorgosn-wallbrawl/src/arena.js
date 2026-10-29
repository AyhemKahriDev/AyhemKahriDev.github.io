'use strict';
// Arena = the level you draw over your real wall.
// Shapes: {t:'b', x,y,w,h,a} rotated box (center, size, angle) | {t:'c', x,y,r} circle.
// Persisted to localStorage, exportable as JSON.

const W = 1280, H = 720; // logical game resolution; corner-pin maps it onto the wall

const ArenaStore = {
  KEY: 'wallbrawl_arena',
  current: null,
  blank() {
    return {
      version: 1,
      playerScale: 1,
      showGeo: true,
      shapes: [],
      spawns: [[W * 0.3, H * 0.35], [W * 0.7, H * 0.35]],
    };
  },
  demo() {
    const a = this.blank();
    a.shapes = [
      { t: 'b', x: W / 2, y: H - 30, w: W - 120, h: 36, a: 0 },
      { t: 'b', x: W * 0.25, y: H * 0.62, w: 260, h: 20, a: 0 },
      { t: 'b', x: W * 0.75, y: H * 0.62, w: 260, h: 20, a: 0 },
      { t: 'b', x: W * 0.5, y: H * 0.38, w: 220, h: 20, a: 0 },
      { t: 'c', x: W * 0.09, y: H * 0.45, r: 36, k: 'bouncy' },
      { t: 'c', x: W * 0.91, y: H * 0.45, r: 36, k: 'bouncy' },
      { t: 'b', x: W * 0.5, y: H - 55, w: 150, h: 14, a: 0, k: 'deadly' },
    ];
    return a;
  },
  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) { this.current = JSON.parse(raw); return; }
    } catch (e) {}
    this.current = this.demo();
  },
  save() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.current)); } catch (e) {}
  },
  export() {
    const blob = new Blob([JSON.stringify(this.current, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'arena.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  },
  import(file, onDone) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!Array.isArray(data.shapes) || !Array.isArray(data.spawns)) throw new Error('bad schema');
        this.current = Object.assign(this.blank(), data);
        this.save();
        if (onDone) onDone();
      } catch (e) {
        document.getElementById('hint').textContent = 'Could not read that arena file';
      }
    };
    r.readAsText(file);
  },
};
