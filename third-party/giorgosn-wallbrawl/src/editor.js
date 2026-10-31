'use strict';
// The arena editor: draw collision shapes over your real wall.
// Tools: select/move/resize, box, circle, wall (angled), spawns, erase.

const Editor = {
  tool: 'select',
  selected: null,
  drag: null,
  history: [],
  polyDraft: null, // absolute [x,y] points while outlining a polygon
  cursor: null,

  snapshot() {
    this.history.push(JSON.stringify({ shapes: ArenaStore.current.shapes, spawns: ArenaStore.current.spawns }));
    if (this.history.length > 50) this.history.shift();
  },
  undo() {
    const raw = this.history.pop();
    if (!raw) return;
    const d = JSON.parse(raw);
    ArenaStore.current.shapes = d.shapes;
    ArenaStore.current.spawns = d.spawns;
    this.selected = null;
    this.drag = null;
    ArenaStore.save();
    this.updateProps();
  },

  init() {
    document.querySelectorAll('[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => this.setTool(btn.dataset.tool));
    });
    document.querySelectorAll('#toolbar button').forEach(btn => {
      btn.addEventListener('pointerdown', e => e.preventDefault()); // keep focus off buttons
    });
    document.getElementById('btnClear').addEventListener('click', () => {
      if (ArenaStore.current.shapes.length) this.snapshot();
      ArenaStore.current.shapes = [];
      this.selected = null;
      ArenaStore.save();
    });
    document.getElementById('btnDemo').addEventListener('click', () => {
      this.snapshot();
      ArenaStore.current = ArenaStore.demo();
      this.selected = null;
      ArenaStore.save();
      this.syncUI();
    });
    document.getElementById('btnExport').addEventListener('click', () => ArenaStore.export());
    document.getElementById('btnImport').addEventListener('click', () => document.getElementById('importFile').click());
    document.getElementById('importFile').addEventListener('change', e => {
      if (e.target.files[0]) {
        this.snapshot();
        ArenaStore.import(e.target.files[0], () => { this.selected = null; this.syncUI(); });
      }
      e.target.value = '';
    });
    document.getElementById('scale').addEventListener('input', e => {
      ArenaStore.current.playerScale = parseFloat(e.target.value);
      ArenaStore.save();
      document.getElementById('scaleVal').textContent = Number(ArenaStore.current.playerScale).toFixed(2) + 'x';
    });
    // per-player head photos
    Heads.load();
    HeadEditor.init();
    const headFile = document.getElementById('headFile');
    let headIdx = 0;
    [0, 1].forEach(i => {
      const btn = document.getElementById('head' + (i + 1));
      btn.addEventListener('click', () => { headIdx = i; headFile.click(); });
      btn.addEventListener('contextmenu', e => {
        e.preventDefault();
        Heads.clear(i);
        this.syncHeadButtons();
      });
    });
    headFile.addEventListener('change', e => {
      if (e.target.files[0]) Heads.fromFile(headIdx, e.target.files[0], () => this.syncHeadButtons());
      e.target.value = '';
    });
    document.getElementById('showGeo').addEventListener('change', e => {
      ArenaStore.current.showGeo = e.target.checked;
      ArenaStore.save();
    });
    document.getElementById('btnPlay').addEventListener('click', () => G.startMatch());
    document.getElementById('btnCalib').addEventListener('click', () => G.toggleCalib());
    document.getElementById('btnCalibReset').addEventListener('click', () => Calib.fit());
    const btnFull = document.getElementById('btnFull');
    const fsBlockedMsg = 'Fullscreen is blocked in this embedded preview — press F11, or open the standalone file';
    if (document.fullscreenEnabled === false) { // e.g. sandboxed artifact iframe
      btnFull.style.opacity = '0.45';
      btnFull.title = fsBlockedMsg;
    }
    btnFull.addEventListener('click', () => {
      const blocked = () => G.flashHint(fsBlockedMsg);
      try {
        if (document.fullscreenElement) { document.exitFullscreen(); return; }
        if (document.fullscreenEnabled === false) { blocked(); return; }
        const p = document.documentElement.requestFullscreen();
        if (p && p.catch) p.catch(blocked);
      } catch (e) { blocked(); }
    });
    // properties panel
    const bindProp = (id, apply) => {
      const el = document.getElementById(id);
      el.addEventListener('focus', () => this.snapshot());
      el.addEventListener('input', () => {
        const s = this.selected;
        if (!s) return;
        const v = parseFloat(el.value);
        if (!isNaN(v)) { apply(s, v); ArenaStore.save(); }
      });
    };
    bindProp('pX', (s, v) => { s.x = v; });
    bindProp('pY', (s, v) => { s.y = v; });
    bindProp('pW', (s, v) => { if (s.t === 'b') s.w = Math.max(4, v); });
    bindProp('pH', (s, v) => { if (s.t === 'b') s.h = Math.max(4, v); });
    bindProp('pA', (s, v) => { if (s.t === 'b') s.a = v * Math.PI / 180; });
    bindProp('pR', (s, v) => { if (s.t === 'c') s.r = Math.max(4, v); });
    document.getElementById('pKind').addEventListener('change', e => {
      const s = this.selected;
      if (!s) return;
      this.snapshot();
      if (e.target.value === 'solid') delete s.k;
      else s.k = e.target.value;
      ArenaStore.save();
    });
    document.getElementById('pDup').addEventListener('click', () => this.duplicate());
    document.getElementById('pDel').addEventListener('click', () => this.deleteSelected());
    document.querySelectorAll('#props button').forEach(btn => {
      btn.addEventListener('pointerdown', e => e.preventDefault());
    });

    window.addEventListener('pointerdown', e => { this.onDown(e); this.updateProps(); });
    window.addEventListener('pointermove', e => this.onMove(e));
    window.addEventListener('pointerup', () => { this.drag = null; });
    // double-click a selected polygon's edge to insert a corner there
    window.addEventListener('dblclick', e => this.insertVertex(e));
    // right-click a selected polygon's corner to remove it
    window.addEventListener('contextmenu', e => {
      if (G.state !== 'edit' || Calib.active || HeadEditor.active) return;
      if (e.target.closest && (e.target.closest('#toolbar') || e.target.closest('#props'))) return;
      if (this.polyDraft) { e.preventDefault(); this.popDraftPoint(); return; }
      if (this.removeVertex(e)) e.preventDefault();
    });
    this.syncUI();
  },

  closePoly() {
    const pts = this.polyDraft;
    this.polyDraft = null;
    if (!pts || pts.length < 3) return;
    const cx = pts.reduce((a, q) => a + q[0], 0) / pts.length;
    const cy = pts.reduce((a, q) => a + q[1], 0) / pts.length;
    this.snapshot();
    const s = { t: 'p', x: cx, y: cy, pts: pts.map(([x, y]) => [x - cx, y - cy]) };
    ArenaStore.current.shapes.push(s);
    ArenaStore.save();
    this.setTool('select');
    this.selected = s; // ready for corner tweaking
    this.updateProps();
  },
  cancelPoly() { this.polyDraft = null; },
  popDraftPoint() {
    this.polyDraft.pop();
    if (!this.polyDraft.length) this.polyDraft = null;
  },

  // world-space corners of a polygon shape
  polyVerts(s) { return s.pts.map(([dx, dy]) => [s.x + dx, s.y + dy]); },

  vertexAt(s, x, y, rad = 11) {
    for (let i = 0; i < s.pts.length; i++) {
      if (dist2(x, y, s.x + s.pts[i][0], s.y + s.pts[i][1]) < rad * rad) return i;
    }
    return -1;
  },

  insertVertex(e) {
    const s = this.selected;
    if (G.state !== 'edit' || Calib.active || HeadEditor.active || !s || s.t !== 'p') return;
    if (e.target.closest && (e.target.closest('#toolbar') || e.target.closest('#props'))) return;
    const p = this.world(e);
    if (this.vertexAt(s, p.x, p.y) >= 0) return;
    // find the closest edge and split it there
    const v = this.polyVerts(s);
    let best = -1, bestD2 = 14 * 14;
    for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
      const ex = v[i][0] - v[j][0], ey = v[i][1] - v[j][1];
      const t = clamp(((p.x - v[j][0]) * ex + (p.y - v[j][1]) * ey) / (ex * ex + ey * ey || 1), 0, 1);
      const d2 = dist2(p.x, p.y, v[j][0] + ex * t, v[j][1] + ey * t);
      if (d2 < bestD2) { bestD2 = d2; best = i; }
    }
    if (best < 0) return;
    this.snapshot();
    s.pts.splice(best, 0, [p.x - s.x, p.y - s.y]);
    ArenaStore.save();
    this.updateProps();
  },

  removeVertex(e) {
    const s = this.selected;
    if (!s || s.t !== 'p' || s.pts.length <= 3) return false;
    const p = this.world(e);
    const i = this.vertexAt(s, p.x, p.y);
    if (i < 0) return false;
    this.snapshot();
    s.pts.splice(i, 1);
    ArenaStore.save();
    this.updateProps();
    return true;
  },

  deleteSelected() {
    const s = this.selected;
    if (!s) return;
    this.snapshot();
    const i = ArenaStore.current.shapes.indexOf(s);
    if (i >= 0) ArenaStore.current.shapes.splice(i, 1);
    this.selected = null;
    ArenaStore.save();
    this.updateProps();
  },

  duplicate() {
    const s = this.selected;
    if (!s) return;
    this.snapshot();
    const c = JSON.parse(JSON.stringify(s));
    c.x = clamp(c.x + 24, 0, W);
    c.y = clamp(c.y + 24, 0, H);
    ArenaStore.current.shapes.push(c);
    this.selected = c;
    ArenaStore.save();
    this.updateProps();
  },

  updateProps() {
    const panel = document.getElementById('props');
    const s = this.selected;
    if (G.state !== 'edit' || !s) { panel.style.display = 'none'; return; }
    panel.style.display = 'flex';
    document.getElementById('propTitle').textContent =
      s.t === 'c' ? 'Circle' : s.t === 'p' ? `Polygon · ${s.pts.length} pts` : (s.h <= 12 ? 'Wall' : 'Box');
    document.querySelectorAll('#props .boxonly').forEach(el => { el.style.display = s.t === 'b' ? 'flex' : 'none'; });
    document.querySelectorAll('#props .circonly').forEach(el => { el.style.display = s.t === 'c' ? 'flex' : 'none'; });
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (document.activeElement !== el) el.value = Math.round(v * 10) / 10;
    };
    set('pX', s.x);
    set('pY', s.y);
    if (s.t === 'b') { set('pW', s.w); set('pH', s.h); set('pA', (s.a || 0) * 180 / Math.PI); }
    else if (s.t === 'c') set('pR', s.r);
    const kindEl = document.getElementById('pKind');
    if (document.activeElement !== kindEl) kindEl.value = s.k || 'solid';
  },

  syncHeadButtons() {
    [0, 1].forEach(i => {
      const btn = document.getElementById('head' + (i + 1));
      const url = Heads.urls[i];
      btn.innerHTML = url ? `<img src="${url}" alt=""> P${i + 1}` : `🙂 P${i + 1}`;
      btn.classList.toggle('on', !!url);
    });
  },

  syncUI() {
    this.syncHeadButtons();
    document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === this.tool));
    document.getElementById('scale').value = ArenaStore.current.playerScale;
    document.getElementById('scaleVal').textContent = Number(ArenaStore.current.playerScale).toFixed(2) + 'x';
    document.getElementById('showGeo').checked = !!ArenaStore.current.showGeo;
  },

  setTool(t) {
    this.tool = t;
    this.selected = null;
    this.polyDraft = null;
    if (t === 'poly') G.flashHint('Click corner points around the object · click the first point or Enter closes · Backspace removes last · Esc cancels');
    this.syncUI();
    this.updateProps();
  },

  world(e) { return Calib.worldFromClient(e.clientX, e.clientY); },

  onDown(e) {
    if (G.state !== 'edit' || Calib.active || HeadEditor.active) return;
    if (e.target.closest && (e.target.closest('#toolbar') || e.target.closest('#props'))) return;
    const p = this.world(e);
    const shapes = ArenaStore.current.shapes;

    if (this.tool === 'poly') {
      if (!this.polyDraft) { this.polyDraft = [[p.x, p.y]]; return; }
      const [fx, fy] = this.polyDraft[0];
      if (this.polyDraft.length >= 3 && dist2(p.x, p.y, fx, fy) < 12 * 12) { this.closePoly(); return; }
      this.polyDraft.push([p.x, p.y]);
      return;
    }

    if (this.tool === 'select') {
      if (this.selected) {
        if (this.selected.t === 'p') {
          const vi = this.vertexAt(this.selected, p.x, p.y);
          if (vi >= 0) { this.snapshot(); this.drag = { mode: 'vertex', vi }; return; }
        }
        const h = this.handlePos(this.selected);
        if (h && dist2(p.x, p.y, h.x, h.y) < 14 * 14) { this.snapshot(); this.drag = { mode: 'resize' }; return; }
      }
      for (let i = 0; i < 2; i++) { // spawn markers are draggable too
        const [sx, sy] = ArenaStore.current.spawns[i];
        if (dist2(p.x, p.y, sx, sy) < 18 * 18) {
          this.snapshot();
          this.selected = null;
          this.drag = { mode: 'spawn', idx: i };
          return;
        }
      }
      for (let i = shapes.length - 1; i >= 0; i--) {
        if (pointInShape(p.x, p.y, shapes[i], 2)) {
          this.snapshot();
          this.selected = shapes[i];
          this.drag = { mode: 'move', ox: p.x - shapes[i].x, oy: p.y - shapes[i].y };
          return;
        }
      }
      this.selected = null;
    } else if (this.tool === 'erase') {
      for (let i = shapes.length - 1; i >= 0; i--) {
        if (pointInShape(p.x, p.y, shapes[i], 2)) {
          this.snapshot();
          if (shapes[i] === this.selected) this.selected = null;
          shapes.splice(i, 1);
          ArenaStore.save();
          return;
        }
      }
    } else if (this.tool === 'spawn1' || this.tool === 'spawn2') {
      this.snapshot();
      ArenaStore.current.spawns[this.tool === 'spawn1' ? 0 : 1] = [p.x, p.y];
      ArenaStore.save();
    } else {
      this.snapshot();
      let s;
      if (this.tool === 'box') s = { t: 'b', x: p.x, y: p.y, w: 10, h: 10, a: 0 };
      else if (this.tool === 'circle') s = { t: 'c', x: p.x, y: p.y, r: 6 };
      else s = { t: 'b', x: p.x, y: p.y, w: 12, h: 10, a: 0 }; // wall
      shapes.push(s);
      this.selected = s;
      this.drag = { mode: 'create', sx: p.x, sy: p.y, kind: this.tool };
    }
  },

  onMove(e) {
    if (G.state !== 'edit' || Calib.active) return;
    this.cursor = this.world(e); // rubber-band line while outlining a polygon
    if (!this.drag) return;
    const p = this.cursor, s = this.selected, d = this.drag;
    if (d.mode === 'spawn') {
      ArenaStore.current.spawns[d.idx] = [clamp(p.x, 10, W - 10), clamp(p.y, 10, H - 10)];
      ArenaStore.save();
      return;
    }
    if (!s) return;
    if (d.mode === 'create') {
      if (d.kind === 'box') {
        s.x = (d.sx + p.x) / 2; s.y = (d.sy + p.y) / 2;
        s.w = Math.max(10, Math.abs(p.x - d.sx));
        s.h = Math.max(10, Math.abs(p.y - d.sy));
      } else if (d.kind === 'circle') {
        s.r = Math.max(6, Math.hypot(p.x - d.sx, p.y - d.sy));
      } else {
        s.x = (d.sx + p.x) / 2; s.y = (d.sy + p.y) / 2;
        s.w = Math.max(12, Math.hypot(p.x - d.sx, p.y - d.sy));
        s.h = 10;
        s.a = Math.atan2(p.y - d.sy, p.x - d.sx);
      }
    } else if (d.mode === 'move') {
      s.x = p.x - d.ox;
      s.y = p.y - d.oy;
    } else if (d.mode === 'vertex') {
      s.pts[d.vi] = [p.x - s.x, p.y - s.y];
    } else if (d.mode === 'resize') {
      if (s.t === 'c') {
        s.r = Math.max(6, Math.hypot(p.x - s.x, p.y - s.y));
      } else {
        const ca = Math.cos(-(s.a || 0)), sa = Math.sin(-(s.a || 0));
        const lx = (p.x - s.x) * ca - (p.y - s.y) * sa;
        const ly = (p.x - s.x) * sa + (p.y - s.y) * ca;
        s.w = Math.max(10, Math.abs(lx) * 2);
        s.h = Math.max(8, Math.abs(ly) * 2);
      }
    }
    ArenaStore.save();
    this.updateProps();
  },

  key(e) {
    if (G.state !== 'edit' || Calib.active) return;
    if (this.polyDraft && (e.code === 'Backspace' || e.code === 'Delete')) { this.popDraftPoint(); return; }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { this.undo(); return; }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyD') {
      if (e.preventDefault) e.preventDefault(); // don't bookmark
      this.duplicate();
      return;
    }
    const tools = { KeyV: 'select', KeyB: 'box', KeyO: 'circle', KeyW: 'wall', KeyP: 'poly', KeyX: 'erase', Digit1: 'spawn1', Digit2: 'spawn2' };
    if (!e.ctrlKey && !e.metaKey && tools[e.code]) { this.setTool(tools[e.code]); return; }
    const s = this.selected;
    if (!s) return;
    if (e.code === 'Delete' || e.code === 'Backspace') { this.deleteSelected(); return; }
    const nudge = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.code];
    if (nudge) {
      if (performance.now() - (this._nudgeT || 0) > 600) this.snapshot(); // one undo step per nudge burst
      this._nudgeT = performance.now();
      const step = e.shiftKey ? 10 : 1;
      s.x += nudge[0] * step;
      s.y += nudge[1] * step;
      ArenaStore.save();
      this.updateProps();
      return;
    }
    if (s.t === 'b' && (e.code === 'KeyQ' || e.code === 'KeyE')) {
      s.a = (s.a || 0) + (e.code === 'KeyE' ? 1 : -1) * Math.PI / 60;
      ArenaStore.save();
      this.updateProps();
    }
  },

  handlePos(s) {
    if (s.t === 'p') return null; // polygons use per-corner handles instead
    if (s.t === 'c') return { x: s.x + s.r, y: s.y };
    const a = s.a || 0;
    const ca = Math.cos(a), sa = Math.sin(a);
    return {
      x: s.x + (s.w / 2) * ca - (s.h / 2) * sa,
      y: s.y + (s.w / 2) * sa + (s.h / 2) * ca,
    };
  },

  draw(ctx) {
    const a = ArenaStore.current;
    ctx.save();
    ctx.strokeStyle = 'rgba(60,220,255,0.5)';
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);
    ctx.setLineDash([]);
    for (const s of a.shapes) drawShape(ctx, s, s === this.selected ? 1 : 0.55, s === this.selected);
    if (this.selected) {
      const h = this.handlePos(this.selected);
      ctx.fillStyle = '#fff';
      if (h) ctx.fillRect(h.x - 5, h.y - 5, 10, 10);
      if (this.selected.t === 'p') { // one handle per corner
        for (const [x, y] of this.polyVerts(this.selected)) ctx.fillRect(x - 4, y - 4, 8, 8);
      }
    }
    if (this.polyDraft) {
      const pts = this.polyDraft;
      ctx.strokeStyle = '#3cdcff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      if (this.cursor) ctx.lineTo(this.cursor.x, this.cursor.y);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      for (const [x, y] of pts) ctx.fillRect(x - 3, y - 3, 6, 6);
      // first point doubles as the close target once the outline can close
      ctx.strokeStyle = pts.length >= 3 ? '#6dff8a' : 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.arc(pts[0][0], pts[0][1], 9, 0, TAU);
      ctx.stroke();
    }
    a.spawns.forEach(([x, y], i) => {
      ctx.strokeStyle = ctx.fillStyle = PLAYER_COLORS[i];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, TAU);
      ctx.stroke();
      ctx.font = 'bold 13px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), x, y + 0.5);
    });
    ctx.restore();
  },
};

const KIND_COLORS = { solid: '#3cdcff', deadly: '#ff5050', bouncy: '#6dff8a' };

function drawShape(ctx, s, alpha, selected, glow) {
  const col = KIND_COLORS[s.k || 'solid'];
  ctx.save();
  ctx.strokeStyle = selected ? '#ffffff' : col;
  ctx.fillStyle = col;
  ctx.lineWidth = 2;
  if (glow) { ctx.shadowColor = col; ctx.shadowBlur = 12; }
  if (s.t === 'c') {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, TAU);
    ctx.globalAlpha = alpha * 0.14;
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.stroke();
  } else if (s.t === 'p') {
    ctx.translate(s.x, s.y);
    ctx.beginPath();
    s.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    ctx.globalAlpha = alpha * 0.14;
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.stroke();
  } else {
    ctx.translate(s.x, s.y);
    ctx.rotate(s.a || 0);
    ctx.globalAlpha = alpha * 0.14;
    ctx.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
    ctx.globalAlpha = alpha;
    ctx.strokeRect(-s.w / 2, -s.h / 2, s.w, s.h);
  }
  ctx.restore();
}
