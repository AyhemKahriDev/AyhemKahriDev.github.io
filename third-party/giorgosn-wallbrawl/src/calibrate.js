'use strict';
// Corner-pin calibration: drag the 4 corners of the game onto your wall.
// The whole game canvas is warped with a CSS matrix3d homography, so it
// stays playable while distorted. Mouse input is un-warped with the inverse.

const Calib = {
  KEY: 'wallbrawl_calib',
  corners: null,
  custom: false,
  active: false,
  H: null,
  invH: null,
  stage: null,
  handleEls: [],

  init() {
    this.stage = document.getElementById('stage');
    const wrap = document.getElementById('handles');
    for (let i = 0; i < 4; i++) {
      const el = document.createElement('div');
      el.className = 'handle';
      wrap.appendChild(el);
      this.handleEls.push(el);
      let dragging = false;
      el.addEventListener('pointerdown', e => {
        dragging = true;
        el.setPointerCapture(e.pointerId);
        e.stopPropagation();
      });
      el.addEventListener('pointermove', e => {
        if (!dragging) return;
        // keep corners on-screen so they can't be lost
        this.corners[i] = [
          clamp(e.clientX, 6, window.innerWidth - 6),
          clamp(e.clientY, 6, window.innerHeight - 6),
        ];
        this.custom = true;
        this.apply();
        this.save();
      });
      el.addEventListener('pointerup', () => { dragging = false; });
    }
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.corners && d.corners.length === 4) { this.corners = d.corners; this.custom = !!d.custom; }
      }
    } catch (e) {}
    if (!this.corners) this.fit();
    window.addEventListener('resize', () => { if (!this.custom) this.fit(); else this.apply(); });
    this.apply();
  },

  fit() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const sc = Math.min(vw / W, vh / H) * 0.97;
    const w = W * sc, h = H * sc;
    const x = (vw - w) / 2, y = (vh - h) / 2;
    this.corners = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    this.custom = false;
    this.apply();
    this.save();
  },

  apply() {
    this.H = computeH([[0, 0], [W, 0], [W, H], [0, H]], this.corners);
    this.invH = invertH(this.H);
    this.stage.style.transform = matrix3d(this.H);
    this.handleEls.forEach((el, i) => {
      el.style.left = this.corners[i][0] + 'px';
      el.style.top = this.corners[i][1] + 'px';
      el.style.display = this.active ? 'block' : 'none';
    });
  },

  save() {
    try { localStorage.setItem(this.KEY, JSON.stringify({ corners: this.corners, custom: this.custom })); } catch (e) {}
  },

  setActive(v) {
    this.active = v;
    this.apply();
  },

  worldFromClient(x, y) { return applyH(this.invH, x, y); },
};
