'use strict';
// Custom head photos: per-player uploaded images, circle-cropped onto the stick figure.
// Stored in localStorage as small square data URLs, separate from the arena.

const Heads = {
  KEY: 'wallbrawl_heads',
  SIZE: 192, // stored resolution (square px) — keeps localStorage small
  urls: [null, null],
  imgs: [null, null],

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) JSON.parse(raw).forEach((u, i) => { if (u && i < 2) this.set(i, u, true); });
    } catch (e) {}
  },
  save() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.urls)); } catch (e) {}
  },
  set(idx, dataUrl, skipSave) {
    const img = new Image();
    img.onload = () => { this.imgs[idx] = img; };
    img.src = dataUrl;
    this.urls[idx] = dataUrl;
    if (!skipSave) this.save();
  },
  clear(idx) {
    this.urls[idx] = null;
    this.imgs[idx] = null;
    this.save();
  },
  // Read a photo and hand it to the crop editor.
  fromFile(idx, file, onDone) {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => HeadEditor.open(idx, img, file.type, onDone);
      img.onerror = () => G.flashHint('Could not read that image');
      img.src = r.result;
    };
    r.readAsDataURL(file);
  },
};

// Modal crop editor: drag to position, zoom, rotate — what's inside the circle
// becomes the head.
const HeadEditor = {
  active: false,
  idx: 0, img: null, mime: '', onDone: null,
  C: 130, R: 110,      // preview canvas center and crop-circle radius
  cover: 1, offx: 0, offy: 0, rot: 0,
  zoomV: 0,            // slider value 0..100 → scale = cover * 4^(v/100)

  get scale() { return this.cover * Math.pow(4, this.zoomV / 100); },

  init() {
    const cv = document.getElementById('hePrev');
    let drag = null;
    cv.addEventListener('pointerdown', e => {
      drag = { x: e.clientX, y: e.clientY };
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', e => {
      if (!drag) return;
      this.offx += e.clientX - drag.x;
      this.offy += e.clientY - drag.y;
      drag = { x: e.clientX, y: e.clientY };
      this.render();
    });
    cv.addEventListener('pointerup', () => { drag = null; });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      this.zoomV = clamp(this.zoomV - Math.sign(e.deltaY) * 5, 0, 100);
      document.getElementById('heZoom').value = this.zoomV;
      this.render();
    }, { passive: false });
    document.getElementById('heZoom').addEventListener('input', e => {
      this.zoomV = parseFloat(e.target.value);
      this.render();
    });
    document.getElementById('heRotL').addEventListener('click', () => { this.rot -= Math.PI / 2; this.render(); });
    document.getElementById('heRotR').addEventListener('click', () => { this.rot += Math.PI / 2; this.render(); });
    document.getElementById('heCancel').addEventListener('click', () => this.close());
    document.getElementById('heUse').addEventListener('click', () => this.apply());
  },

  open(idx, img, mime, onDone) {
    this.idx = idx; this.img = img; this.mime = mime; this.onDone = onDone;
    this.cover = (this.R * 2) / Math.min(img.width, img.height);
    this.offx = 0; this.offy = 0; this.rot = 0; this.zoomV = 0;
    document.getElementById('heZoom').value = 0;
    document.getElementById('headEdit').style.display = 'flex';
    this.active = true;
    this.render();
  },

  close() {
    this.active = false;
    this.img = null;
    document.getElementById('headEdit').style.display = 'none';
  },

  // image transform shared by preview and final export
  applyTransform(ctx) {
    ctx.translate(this.C + this.offx, this.C + this.offy);
    ctx.rotate(this.rot);
    ctx.scale(this.scale, this.scale);
    ctx.drawImage(this.img, -this.img.width / 2, -this.img.height / 2);
  },

  render() {
    const cv = document.getElementById('hePrev');
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.save();
    this.applyTransform(ctx);
    ctx.restore();
    // dim everything outside the crop circle
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cv.width, cv.height);
    ctx.arc(this.C, this.C, this.R, 0, TAU, true);
    ctx.fillStyle = 'rgba(4, 10, 16, 0.72)';
    ctx.fill();
    ctx.strokeStyle = '#27e6ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.C, this.C, this.R, 0, TAU);
    ctx.stroke();
    ctx.restore();
  },

  apply() {
    const out = document.createElement('canvas');
    out.width = out.height = Heads.SIZE;
    const ctx = out.getContext('2d');
    const k = Heads.SIZE / (this.R * 2);
    ctx.scale(k, k);
    ctx.translate(this.R - this.C, this.R - this.C); // crop-circle box → output square
    this.applyTransform(ctx);
    const keepAlpha = this.mime === 'image/png' || this.mime === 'image/webp';
    Heads.set(this.idx, keepAlpha ? out.toDataURL('image/png') : out.toDataURL('image/jpeg', 0.85));
    const done = this.onDone;
    this.close();
    if (done) done();
  },
};
