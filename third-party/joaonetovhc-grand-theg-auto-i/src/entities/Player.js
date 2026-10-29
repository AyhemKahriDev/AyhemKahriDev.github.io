import * as THREE from 'three';
import { makeHumanoid } from '../utils/helpers.js';
import { PLAYER_H, GCOLS, GROWS, CELL } from '../config/game.config.js';

// ═══════════════════════════════════════════════════════════
//  THEG I — Player Entity
// ═══════════════════════════════════════════════════════════

export class Player {
  constructor(scene, MAT) {
    this.scene = scene;

    // State
    this.health    = 100;
    this.armor     = 100;
    this.money     = 0;
    this.kills     = 0;
    this.weaponIdx = 0;
    this.dead      = false;
    this.inCar     = false;
    this.car       = null;
    this.onGround  = true;
    this.jumpV     = 0;
    this.pos       = new THREE.Vector3(GCOLS / 2 * CELL, PLAYER_H / 2, GROWS / 2 * CELL);

    // Build mesh
    this.group = new THREE.Group();
    this.mesh  = makeHumanoid(MAT.player, MAT.playerSk, MAT.playerPa);
    this.mesh.traverse(m => { if (m.isMesh) m.castShadow = true; });
    this.mesh.position.y = 0.7;
    this.group.add(this.mesh);
    scene.add(this.group);
  }

  reset(startX, startZ) {
    this.health    = 100;
    this.armor     = 100;
    this.money     = 0;
    this.kills     = 0;
    this.weaponIdx = 0;
    this.dead      = false;
    this.inCar     = false;
    this.car       = null;
    this.onGround  = true;
    this.jumpV     = 0;
    this.pos.set(startX, PLAYER_H / 2, startZ);
    this.group.visible = true;
  }

  /**
   * Update player movement and animation (only when not in car).
   * @param {number} dt
   * @param {object} input - InputManager instance
   * @param {number} cameraYaw
   * @param {CollisionSystem} collision
   * @param {number} frame
   */
  update(dt, input, cameraYaw, collision, frame) {
    if (this.inCar) return;

    const run = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const spd = run ? 9 : 5;
    const fwd = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    const rgt = new THREE.Vector3( Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
    const move = new THREE.Vector3(0, 0, 0);

    if (input.isDown('KeyW') || input.isDown('ArrowUp'))    move.add(fwd);
    if (input.isDown('KeyS') || input.isDown('ArrowDown'))  move.sub(fwd);
    if (input.isDown('KeyA') || input.isDown('ArrowLeft'))  move.sub(rgt);
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) move.add(rgt);

    if (move.lengthSq() > .01) {
      move.normalize().multiplyScalar(spd * dt);
      const nx = this.pos.x + move.x, nz = this.pos.z + move.z;
      if (!collision.isInside(nx, this.pos.z)) this.pos.x = nx;
      if (!collision.isInside(this.pos.x, nz)) this.pos.z = nz;
      collision.resolve(this.pos, .4);
      // Face movement direction
      const ta = Math.atan2(-move.x, -move.z);
      let da = ta - this.mesh.rotation.y;
      while (da > Math.PI)  da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      this.mesh.rotation.y += da * .25;
      // Leg animation
      const ls = Math.sin(frame * .15) * 0.4;
      this.mesh._legL.rotation.x =  ls;
      this.mesh._legR.rotation.x = -ls;
      this.mesh._armL.rotation.x = -ls * .6;
      this.mesh._armR.rotation.x =  ls * .6;
    }

    this.group.position.copy(this.pos);
    this.group.position.y = 0;

    // Jump
    if (input.isDown('Space') && this.onGround) { this.jumpV = 7; this.onGround = false; }
    if (!this.onGround) {
      this.jumpV -= 20 * dt;
      this.pos.y += this.jumpV * dt;
      if (this.pos.y <= PLAYER_H / 2) { this.pos.y = PLAYER_H / 2; this.onGround = true; this.jumpV = 0; }
    }
  }

  hurt(dmg) {
    if (this.armor > 0) {
      const ab = Math.min(this.armor, dmg * .6);
      this.armor -= ab; dmg -= ab;
    }
    this.health = Math.max(0, this.health - dmg);
  }
}
