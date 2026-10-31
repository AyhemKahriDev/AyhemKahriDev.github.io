import * as THREE from 'three';
import { box } from '../utils/helpers.js';
import { BLOCK, ROAD, CELL, GCOLS, GROWS } from '../config/game.config.js';

// ═══════════════════════════════════════════════════════════
//  THEG I — City Builder
// ═══════════════════════════════════════════════════════════

export class CityBuilder {
  constructor(scene, MAT, collision) {
    this.scene     = scene;
    this.MAT       = MAT;
    this.collision = collision;
  }

  _buildBuilding(bx, bz, w, d, h, color) {
    const scene = this.scene;
    const mat = new THREE.MeshLambertMaterial({ color });
    const winMat = new THREE.MeshLambertMaterial({
      color: 0xBBDDFF, transparent: true, opacity: .7,
      emissive: 0x223344, emissiveIntensity: .4
    });
    const g = new THREE.Group();

    // Main body
    const body = box(w, h, d, mat);
    body.position.set(0, h / 2, 0);
    g.add(body);

    // Windows
    const ww = 2, wh = 2.5, wgx = 5, wgz = 5;
    for (let iy = wh; iy < h - 2; iy += wgz) {
      for (let ix = -w / 2 + 3; ix < w / 2 - 1; ix += wgx) {
        const wp = box(ww, wh, .15, winMat);
        wp.position.set(ix, iy + wh / 2, d / 2 + .01);
        g.add(wp);
        const wp2 = box(ww, wh, .15, winMat);
        wp2.position.set(ix, iy + wh / 2, -d / 2 - .01);
        g.add(wp2);
      }
      for (let iz = -d / 2 + 3; iz < d / 2 - 1; iz += wgz) {
        const wp = box(.15, wh, ww, winMat);
        wp.position.set(w / 2 + .01, iy + wh / 2, iz);
        g.add(wp);
        const wp2 = box(.15, wh, ww, winMat);
        wp2.position.set(-w / 2 - .01, iy + wh / 2, iz);
        g.add(wp2);
      }
    }

    // Rooftop details
    if (h > 25) {
      const antenna = box(.5, 8, .5, new THREE.MeshLambertMaterial({ color: 0x888888 }));
      antenna.position.set(0, h + 4, 0);
      g.add(antenna);
      // Red light on antenna
      const light = new THREE.PointLight(0xff0000, .8, 30);
      light.position.set(0, h + 8.2, 0);
      g.add(light);
    }

    g.position.set(bx, 0, bz);
    scene.add(g);
    this.collision.add(bx, bz, w + 1, d + 1);
  }

  build() {
    const { scene, MAT } = this;
    const W = GCOLS * CELL, D = GROWS * CELL;

    // Ground
    const gnd = box(W + 200, 0.2, D + 200, MAT.grass);
    gnd.position.set(W / 2, -.1, D / 2);
    gnd.receiveShadow = true;
    scene.add(gnd);

    // Beach + water (east side)
    const beach = box(80, .25, D + 200, MAT.beach);
    beach.position.set(W + 40, 0, D / 2);
    beach.receiveShadow = true;
    scene.add(beach);
    const water = box(300, .1, D + 400, MAT.water);
    water.position.set(W + 180, -0.1, D / 2);
    scene.add(water);

    // Roads
    for (let c = 0; c <= GCOLS; c++) {
      const x = c * CELL;
      const r = box(ROAD, .1, D + 80, MAT.road);
      r.position.set(x, 0, D / 2);
      r.receiveShadow = true;
      scene.add(r);
      // Center line
      for (let seg = 0; seg < GROWS; seg++) {
        const ln = box(.4, .11, 6, MAT.line);
        ln.position.set(x, 0, seg * CELL + CELL / 2);
        scene.add(ln);
      }
    }
    for (let r = 0; r <= GROWS; r++) {
      const z = r * CELL;
      const rd = box(W + 80, .1, ROAD, MAT.road);
      rd.position.set(W / 2, 0, z);
      rd.receiveShadow = true;
      scene.add(rd);
      for (let seg = 0; seg < GCOLS; seg++) {
        const ln = box(6, .11, .4, MAT.line);
        ln.position.set(seg * CELL + CELL / 2, 0, z);
        scene.add(ln);
      }
    }

    // Sidewalks + buildings
    for (let ci = 0; ci < GCOLS; ci++) {
      for (let ri = 0; ri < GROWS; ri++) {
        const bx0 = ci * CELL + ROAD / 2;
        const bz0 = ri * CELL + ROAD / 2;
        const cx = bx0 + BLOCK / 2, cz = bz0 + BLOCK / 2;

        // Sidewalk slab
        const sw = box(BLOCK + 2, .15, BLOCK + 2, MAT.sidewalk);
        sw.position.set(cx, .06, cz);
        sw.receiveShadow = true;
        scene.add(sw);

        // Distance from center grid for zone
        const dc = Math.hypot(ci - GCOLS / 2, ri - GROWS / 2) / (GCOLS / 2);

        if (dc < 0.25) {
          // Downtown — big towers
          const num = 1 + Math.floor(Math.random() * 2);
          for (let n = 0; n < num; n++) {
            const bw = 18 + Math.random() * 14, bd = 18 + Math.random() * 14;
            const bh = 40 + Math.random() * 60;
            const ox = (Math.random() - .5) * (BLOCK - bw - 2);
            const oz = (Math.random() - .5) * (BLOCK - bd - 2);
            const hue = 200 + Math.random() * 40;
            this._buildBuilding(cx + ox, cz + oz, bw, bd, bh,
              new THREE.Color(`hsl(${hue},${15 + Math.random() * 20}%,${40 + Math.random() * 20}%)`));
          }
        } else if (dc < 0.55) {
          // Mid city
          const num = 1 + Math.floor(Math.random() * 3);
          for (let n = 0; n < num; n++) {
            const bw = 10 + Math.random() * 18, bd = 10 + Math.random() * 18;
            if (bw + 4 > BLOCK || bd + 4 > BLOCK) continue;
            const bh = 8 + Math.random() * 30;
            const ox = (Math.random() - .5) * (BLOCK - bw - 2);
            const oz = (Math.random() - .5) * (BLOCK - bd - 2);
            this._buildBuilding(cx + ox, cz + oz, bw, bd, bh,
              new THREE.Color(`hsl(${20 + Math.random() * 30},${10 + Math.random() * 20}%,${45 + Math.random() * 25}%)`));
          }
        } else {
          // Suburbs — houses & trees
          const bw = 10 + Math.random() * 10, bd = 8 + Math.random() * 10;
          const bh = 4 + Math.random() * 8;
          this._buildBuilding(cx, cz, bw, bd, bh,
            new THREE.Color(`hsl(${10 + Math.random() * 40},${20 + Math.random() * 30}%,${50 + Math.random() * 20}%)`));
          // Palm tree
          if (Math.random() < 0.4) {
            const tx = cx + (Math.random() - .5) * 20, tz = cz + (Math.random() - .5) * 20;
            const trunk = box(0.6, 8, .6, new THREE.MeshLambertMaterial({ color: 0x8B6914 }));
            trunk.position.set(tx, 4, tz);
            trunk.castShadow = true;
            scene.add(trunk);
            const fronds = box(5, 2, 5, new THREE.MeshLambertMaterial({ color: 0x228B22 }));
            fronds.position.set(tx, 9, tz);
            fronds.castShadow = true;
            scene.add(fronds);
          }
        }
      }
    }
  }
}
