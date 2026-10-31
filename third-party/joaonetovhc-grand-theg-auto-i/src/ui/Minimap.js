import { GCOLS, GROWS, CELL, ROAD } from '../config/game.config.js';

// ═══════════════════════════════════════════════════════════
//  THEG I — Minimap
// ═══════════════════════════════════════════════════════════

const MM = 192, MM_RANGE = 120;

export class Minimap {
  constructor(canvas) {
    this.ctx = canvas.getContext('2d');
  }

  /**
   * @param {THREE.Vector3} playerPos
   * @param {number} cameraYaw
   * @param {Array} cars
   * @param {Array} npcs
   * @param {Array} collisionBoxes
   */
  draw(playerPos, cameraYaw, cars, npcs, collisionBoxes) {
    const ctx = this.ctx;
    ctx.fillStyle = '#111a11';
    ctx.fillRect(0, 0, MM, MM);
    const sc = MM / (MM_RANGE * 2);
    const ox = MM / 2 - playerPos.x * sc;
    const oz = MM / 2 - playerPos.z * sc;

    // Roads
    ctx.fillStyle = '#333';
    for (let ci = 0; ci <= GCOLS; ci++) {
      ctx.fillRect(ci * CELL * sc + ox - ROAD / 2 * sc, 0, ROAD * sc, MM);
    }
    for (let ri = 0; ri <= GROWS; ri++) {
      ctx.fillRect(0, ri * CELL * sc + oz - ROAD / 2 * sc, MM, ROAD * sc);
    }

    // Buildings
    ctx.fillStyle = '#555';
    collisionBoxes.forEach(b => {
      const sx = b.minX * sc + ox, sz = b.minZ * sc + oz;
      const sw = (b.maxX - b.minX) * sc, sd = (b.maxZ - b.minZ) * sc;
      ctx.fillRect(sx, sz, sw, sd);
    });

    // Cars
    cars.forEach(c => {
      ctx.fillStyle = c.isCop ? '#3498db' : '#f39c12';
      const cx = c.pos.x * sc + ox, cz = c.pos.z * sc + oz;
      ctx.fillRect(cx - 3, cz - 2, 6, 4);
    });

    // NPCs
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    npcs.forEach(n => {
      if (n.dead) return;
      const nx = n.pos.x * sc + ox, nz = n.pos.z * sc + oz;
      ctx.fillRect(nx - 1, nz - 1, 2, 2);
    });

    // Player
    ctx.save();
    ctx.translate(MM / 2, MM / 2);
    ctx.rotate(-cameraYaw);
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(4, 4); ctx.lineTo(-4, 4);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // Compass
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(MM / 2, MM / 2, MM / 2 - 1, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '9px Arial'; ctx.textAlign = 'center';
    ctx.fillText('N', MM / 2, 10);
  }
}
