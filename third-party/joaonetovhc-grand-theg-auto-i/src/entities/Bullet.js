import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════
//  THEG I — Bullet & Particle System
// ═══════════════════════════════════════════════════════════

export class BulletSystem {
  constructor(scene) {
    this.scene     = scene;
    this.bullets   = [];
    this.particles = [];
    this._raycaster = new THREE.Raycaster();
  }

  fire(from, dir, dmg, speed, range, owner) {
    if (speed === 0) {
      // Melee
      this._raycaster.set(from, dir);
      this._raycaster.far = range;
      const hits = this._raycaster.intersectObjects(this.scene.children, true);
      if (hits.length) {
        this.spawnHit(hits[0].point);
      }
      return;
    }
    const matClone = new THREE.MeshBasicMaterial({ color: 0xFFFF00 });
    const bm = new THREE.Mesh(new THREE.SphereGeometry(.06, 4, 4), matClone);
    bm.position.copy(from);
    this.scene.add(bm);
    this.bullets.push({ mesh: bm, vel: dir.clone().multiplyScalar(speed), dmg, rng: range, traveled: 0, owner });
  }

  spawnHit(pos, count = 8, color = 0xFFAA00) {
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(.04 + Math.random() * .06, 3, 3),
        new THREE.MeshBasicMaterial({ color })
      );
      m.position.copy(pos);
      this.scene.add(m);
      const v = new THREE.Vector3(
        (Math.random() - .5) * 8,
        Math.random() * 6,
        (Math.random() - .5) * 8
      );
      this.particles.push({ mesh: m, vel: v, life: 1, gravity: true });
    }
  }

  spawnBlood(pos) {
    this.spawnHit(pos, 12, 0xAA0000);
  }

  /**
   * @param {number} dt
   * @param {NPCSystem} npcSystem
   * @param {Player} player
   * @param {CollisionSystem} collision
   * @param {function} onHurtPlayer
   * @param {function} onNPCKill - called with (npc, dmg, bulletSystem, callback)
   */
  update(dt, npcSystem, player, collision, onHurtPlayer, onNPCKill) {
    // Bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.mesh.position.addScaledVector(b.vel, dt);
      b.traveled += b.vel.length() * dt;
      let hit = false;
      if (b.traveled > b.rng || collision.isInside(b.mesh.position.x, b.mesh.position.z)) {
        hit = true;
        this.spawnHit(b.mesh.position.clone());
      }
      if (!hit && b.owner === 'enemy') {
        if (b.mesh.position.distanceTo(player.pos) < 1.2) {
          onHurtPlayer(b.dmg); hit = true;
        }
      }
      if (!hit) {
        npcSystem.npcs.forEach(n => {
          if (n.dead || hit) return;
          if (b.mesh.position.distanceTo(n.pos) < 1) {
            onNPCKill(n, b.dmg);
            hit = true;
          }
        });
      }
      if (hit) { this.scene.remove(b.mesh); this.bullets.splice(i, 1); }
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.gravity) p.vel.y -= 20 * dt;
      p.vel.multiplyScalar(.9);
      p.life -= dt * 2;
      p.mesh.scale.setScalar(p.life);
      if (p.life <= 0) { this.scene.remove(p.mesh); this.particles.splice(i, 1); }
    }
  }

  clear() {
    this.bullets.forEach(b => this.scene.remove(b.mesh));
    this.bullets.length = 0;
    this.particles.forEach(p => this.scene.remove(p.mesh));
    this.particles.length = 0;
  }
}
