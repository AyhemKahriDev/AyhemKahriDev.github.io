'use strict';
// Minimal collision layer: circles (players, crates, bullets-as-points)
// against the arena's rotated boxes, circles, and polygons.

// Circle vs polygon (may be concave): closest point on the outline decides the
// push direction; if the center is inside, push out through that closest point.
function collideCirclePoly(cx, cy, cr, s) {
  const pts = s.pts, n = pts.length;
  let inside = false;
  let bestD2 = Infinity, bx = 0, by = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const x1 = s.x + pts[j][0], y1 = s.y + pts[j][1];
    const x2 = s.x + pts[i][0], y2 = s.y + pts[i][1];
    if ((y2 > cy) !== (y1 > cy) && cx < (x1 - x2) * (cy - y2) / (y1 - y2) + x2) inside = !inside;
    const ex = x1 - x2, ey = y1 - y2;
    const t = clamp(((cx - x2) * ex + (cy - y2) * ey) / (ex * ex + ey * ey || 1), 0, 1);
    const px = x2 + ex * t, py = y2 + ey * t;
    const d2 = (cx - px) * (cx - px) + (cy - py) * (cy - py);
    if (d2 < bestD2) { bestD2 = d2; bx = px; by = py; }
  }
  const d = Math.sqrt(bestD2);
  if (!inside && d >= cr) return null;
  if (d === 0) return { nx: 0, ny: -1, depth: cr };
  const nx = (cx - bx) / d, ny = (cy - by) / d;
  return inside ? { nx: -nx, ny: -ny, depth: cr + d } : { nx, ny, depth: cr - d };
}

function collideCircleShape(cx, cy, cr, s) {
  if (s.t === 'p') return collideCirclePoly(cx, cy, cr, s);
  if (s.t === 'c') {
    const dx = cx - s.x, dy = cy - s.y;
    const d = Math.hypot(dx, dy), rr = cr + s.r;
    if (d === 0) return { nx: 0, ny: -1, depth: rr };
    if (d >= rr) return null;
    return { nx: dx / d, ny: dy / d, depth: rr - d };
  }
  // rotated box: transform circle center into box-local space
  const ang = s.a || 0;
  const ca = Math.cos(-ang), sa = Math.sin(-ang);
  const lx = (cx - s.x) * ca - (cy - s.y) * sa;
  const ly = (cx - s.x) * sa + (cy - s.y) * ca;
  const hw = s.w / 2, hh = s.h / 2;
  const qx = clamp(lx, -hw, hw), qy = clamp(ly, -hh, hh);
  const dx = lx - qx, dy = ly - qy;
  const d = Math.hypot(dx, dy);
  let nlx, nly, depth;
  if (d > 0) {
    if (d >= cr) return null;
    nlx = dx / d; nly = dy / d; depth = cr - d;
  } else {
    // center is inside the box: push out along the shallowest axis
    const px = hw - Math.abs(lx), py = hh - Math.abs(ly);
    if (px < py) { nlx = lx >= 0 ? 1 : -1; nly = 0; depth = px + cr; }
    else { nlx = 0; nly = ly >= 0 ? 1 : -1; depth = py + cr; }
  }
  const ca2 = Math.cos(ang), sa2 = Math.sin(ang);
  return { nx: nlx * ca2 - nly * sa2, ny: nlx * sa2 + nly * ca2, depth };
}

function pointInShape(x, y, s, pad = 0) {
  return !!collideCircleShape(x, y, pad + 0.1, s);
}

// Pushes body {x,y,r,vx,vy} out of all shapes. Returns true if standing on ground.
// Bouncy shapes (s.k === 'bouncy') reflect velocity instead of absorbing it.
// onHit(shape, hit, vn) fires per contact so callers can react (e.g. deadly shapes).
function resolveBody(b, shapes, onHit) {
  let ground = false;
  for (const s of shapes) {
    const hit = collideCircleShape(b.x, b.y, b.r, s);
    if (!hit) continue;
    b.x += hit.nx * hit.depth;
    b.y += hit.ny * hit.depth;
    const vn = b.vx * hit.nx + b.vy * hit.ny;
    if (vn < 0) {
      const e = s.k === 'bouncy' ? 0.85 : 0;
      b.vx -= (1 + e) * vn * hit.nx;
      b.vy -= (1 + e) * vn * hit.ny;
    }
    if (hit.ny < -0.55 && (s.k !== 'bouncy' || Math.abs(vn) < 60)) ground = true;
    if (onHit) onHit(s, hit, vn);
  }
  return ground;
}
