// ═══════════════════════════════════════════════════════════
//  THEG I — Collision System
// ═══════════════════════════════════════════════════════════
// AABB (Axis-Aligned Bounding Box) para edifícios e limites do mundo.

export class CollisionSystem {
  constructor(worldW, worldD) {
    this.boxes  = []; // { minX, maxX, minZ, maxZ }
    this.worldW = worldW;
    this.worldD = worldD;
  }

  add(x, z, w, d) {
    this.boxes.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  }

  isInside(x, z) {
    for (const b of this.boxes) {
      if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ) return true;
    }
    return false;
  }

  resolve(pos, radius = 0.4) {
    for (const b of this.boxes) {
      const cx = (b.minX + b.maxX) * .5, cz = (b.minZ + b.maxZ) * .5;
      const hw = (b.maxX - b.minX) * .5 + radius, hd = (b.maxZ - b.minZ) * .5 + radius;
      const dx = pos.x - cx, dz = pos.z - cz;
      if (Math.abs(dx) < hw && Math.abs(dz) < hd) {
        const ox = hw - Math.abs(dx), oz = hd - Math.abs(dz);
        if (ox < oz) pos.x += dx > 0 ? ox : -ox;
        else         pos.z += dz > 0 ? oz : -oz;
      }
    }
    // World bounds
    pos.x = Math.max(2, Math.min(this.worldW - 2, pos.x));
    pos.z = Math.max(2, Math.min(this.worldD - 2, pos.z));
  }
}
