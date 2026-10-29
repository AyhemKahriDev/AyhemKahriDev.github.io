// ═══════════════════════════════════════════════════════════
//  THEG I — Traffic & Police AI System
// ═══════════════════════════════════════════════════════════

export class TrafficSystem {
  constructor() {
    this.cops = []; // { car, health, shootTimer, dead }
  }

  addCop(car) {
    this.cops.push({ car, health: 80, shootTimer: 0, dead: false });
  }

  /**
   * @param {number} dt
   * @param {Player} player
   * @param {number} wantedLevel
   * @param {CollisionSystem} collision
   * @param {number} frame
   * @param {function} onHurtPlayer - called with (dmg)
   */
  update(dt, player, wantedLevel, collision, frame, onHurtPlayer) {
    if (wantedLevel <= 0) return;
    this.cops.forEach(cop => {
      if (cop.dead || !cop.car) return;
      const c = cop.car;
      const dp = player.pos.distanceTo(c.pos);
      // Drive towards player
      const ta = Math.atan2(player.pos.x - c.pos.x, player.pos.z - c.pos.z);
      let da = ta - c.angle;
      while (da > Math.PI)  da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      c.angle += Math.sign(da) * Math.min(Math.abs(da), 2 * dt);
      c.vel = Math.min(20, c.vel + 10 * dt);
      c.pos.x += Math.sin(c.angle) * c.vel * dt;
      c.pos.z += Math.cos(c.angle) * c.vel * dt;
      if (collision.isInside(c.pos.x, c.pos.z)) { c.angle += Math.PI * .6; c.vel *= -.3; }
      collision.resolve(c.pos, 2.5);
      c.mesh.position.copy(c.pos);
      c.mesh.rotation.y = c.angle;
      c.wheels.forEach(w => w.rotation.x += c.vel * dt * .5);

      // Siren flash
      if (c.siren) { c.siren.intensity = Math.sin(frame * .3) * 1.5 + 1.5; }

      // Ram player car
      if (player.inCar && dp < 4) { onHurtPlayer(15); }
      // Shoot at player on foot
      if (!player.inCar && dp < 60) {
        cop.shootTimer -= dt;
        if (cop.shootTimer <= 0) {
          cop.shootTimer = 1.5 - wantedLevel * .15;
          onHurtPlayer(8);
        }
      }
    });
  }

  clearAll() {
    this.cops.forEach(c => c.dead = true);
  }

  clear() {
    this.cops.length = 0;
  }
}
