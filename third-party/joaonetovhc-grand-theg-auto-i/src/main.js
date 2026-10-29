// ═══════════════════════════════════════════════════════════
//  THEG I — Grand Theg Auto  |  Entry Point (ES6 Modules)
// ═══════════════════════════════════════════════════════════
import * as THREE from 'three';

import { GCOLS, GROWS, CELL, W, D, PLAYER_H, CAR_COUNT, NPC_COUNT, PICKUP_COUNT } from './config/game.config.js';
import { WEAPONS, DEFAULT_AMMO, DEFAULT_RESERVE } from './config/weapons.config.js';

import { buildMaterials }   from './world/MaterialLibrary.js';
import { CollisionSystem }  from './world/CollisionSystem.js';
import { CityBuilder }      from './world/CityBuilder.js';

import { Engine }           from './core/Engine.js';
import { InputManager }     from './core/InputManager.js';
import { CameraController } from './core/Camera.js';

import { Player }           from './entities/Player.js';
import { VehicleSystem }    from './entities/Vehicle.js';
import { NPCSystem }        from './entities/NPC.js';
import { BulletSystem }     from './entities/Bullet.js';
import { PickupSystem }     from './entities/Pickup.js';

import { WantedSystem }     from './systems/WantedSystem.js';
import { CombatSystem }     from './systems/CombatSystem.js';
import { TrafficSystem }    from './systems/TrafficSystem.js';

import { HUD }              from './ui/HUD.js';
import { Minimap }          from './ui/Minimap.js';
import { ScreenManager }    from './ui/ScreenManager.js';

// ── Bootstrap ───────────────────────────────────────────────
const canvas = document.getElementById('c');
const engine = new Engine(canvas);
const { scene, camera, renderer } = engine;

const MAT        = buildMaterials(THREE);
const collision  = new CollisionSystem(W, D);
const cityBuilder = new CityBuilder(scene, MAT, collision);
cityBuilder.build();

const input      = new InputManager();
const camCtrl    = new CameraController(camera);
const hud        = new HUD();
const minimap    = new Minimap(document.getElementById('mm'));
const screens    = new ScreenManager();

// Systems that need scene/camera refs
let player, vehicleSystem, npcSystem, bulletSystem, pickupSystem;
let wantedSystem, combatSystem, trafficSystem;

// Weapon state arrays live in main.js (per-session)
let wAmmo, wRes;
let msgTimer = 0;
let frame    = 0;
let gameRunning = false;

// ── Helpers ─────────────────────────────────────────────────
function showMsg(txt, dur = 180) {
  msgTimer = hud.showMessage(txt, dur);
}

function spawnCop() {
  if (trafficSystem.cops.length >= 6) return;
  const car = vehicleSystem.spawnCop(player.pos);
  trafficSystem.addCop(car);
}

function toggleVehicle() {
  if (player.inCar) {
    player.inCar = false;
    player.car.occupied = false;
    player.pos.set(player.car.pos.x + 2, PLAYER_H / 2, player.car.pos.z);
    player.car = null;
    player.group.visible = true;
  } else {
    let best = null, bestD = Infinity;
    vehicleSystem.cars.forEach(c => {
      const d = player.pos.distanceTo(c.pos);
      if (d < 5 && d < bestD) { bestD = d; best = c; }
    });
    if (best) {
      player.inCar = true; player.car = best; best.occupied = true;
      player.group.visible = false;
      showMsg('Pressione F para sair');
    }
  }
}

function triggerWasted() {
  player.dead = true;
  gameRunning = false;
  input.gameRunning = false;
  document.exitPointerLock();
  let alpha = 0;
  const flash = () => {
    alpha += .04;
    renderer.domElement.style.filter = `brightness(${1 + alpha}) saturate(0)`;
    if (alpha < 1) requestAnimationFrame(flash);
    else {
      screens.showWasted(
        `Score: $${player.money.toLocaleString('pt-BR')} | Mortes: ${player.kills} | Estrelas: ${Math.floor(wantedSystem.level)}`
      );
    }
  };
  flash();
}

function hurtPlayer(dmg) {
  player.hurt(dmg);
  hud.update(player, WEAPONS, wAmmo, wRes);
  if (player.health <= 0) triggerWasted();
}

function onNPCKill(npc, dmg) {
  npcSystem.hurt(npc, dmg, bulletSystem, (hostile) => {
    player.kills++;
    if (hostile) { player.money += 200; }
    else { wantedSystem.add(1, spawnCop); }
    hud.update(player, WEAPONS, wAmmo, wRes);
    hud.updateWanted(wantedSystem.level);
  });
}

// ── Init Game ───────────────────────────────────────────────
function initGame() {
  const startX = GCOLS / 2 * CELL;
  const startZ = GROWS / 2 * CELL;

  // Reset/create player
  if (!player) {
    player = new Player(scene, MAT);
  }
  player.reset(startX, startZ);

  wAmmo = [...DEFAULT_AMMO];
  wRes  = [...DEFAULT_RESERVE];

  // Create or recreate systems
  vehicleSystem = new VehicleSystem(scene, MAT);
  npcSystem     = new NPCSystem(scene, MAT);
  bulletSystem  = new BulletSystem(scene);
  pickupSystem  = new PickupSystem(scene, MAT);
  wantedSystem  = new WantedSystem();
  combatSystem  = new CombatSystem(scene, camera, bulletSystem, wantedSystem);
  trafficSystem = new TrafficSystem();

  vehicleSystem.spawn(CAR_COUNT, collision, startX, startZ);
  npcSystem.spawn(NPC_COUNT, collision, startX, startZ);
  pickupSystem.spawn(PICKUP_COUNT, collision);

  camCtrl.yaw   = 0;
  camCtrl.pitch = .3;

  hud.update(player, WEAPONS, wAmmo, wRes);
  hud.updateWanted(0);
  showMsg('BEM-VINDO A LOS SANTOS', 300);
}

// ── Input setup ─────────────────────────────────────────────
input.init(canvas, (code) => {
  if (!gameRunning) return;
  if (code === 'KeyF') toggleVehicle();
  if (code === 'KeyR') combatSystem.reload(player, wAmmo, wRes, WEAPONS, () => hud.update(player, WEAPONS, wAmmo, wRes));
  if (code === 'Digit1') { player.weaponIdx = 0; hud.update(player, WEAPONS, wAmmo, wRes); }
  if (code === 'Digit2') { player.weaponIdx = 1; hud.update(player, WEAPONS, wAmmo, wRes); }
  if (code === 'Digit3') { player.weaponIdx = 2; hud.update(player, WEAPONS, wAmmo, wRes); }
  if (code === 'Digit4') { player.weaponIdx = 3; hud.update(player, WEAPONS, wAmmo, wRes); }
});

// ── Update Loop ─────────────────────────────────────────────
function update(dt) {
  frame++;
  if (!gameRunning || player.dead) return;

  // Consume mouse delta → apply to camera controller
  const { dx, dy } = input.consumeMouseDelta();
  camCtrl.applyMouseDelta(dx, dy);

  // ── Player on foot ─────────────────────────────────────────
  if (!player.inCar) {
    player.update(dt, input, camCtrl.yaw, collision, frame);

    // Shoot
    if (input.shooting) {
      combatSystem.shoot(
        player, wAmmo, wRes, WEAPONS,
        () => showMsg('SEM MUNIÇÃO — R para recarregar', 120),
        () => hud.update(player, WEAPONS, wAmmo, wRes),
        spawnCop
      );
    }

    // Prompt near car
    let nearCar = false;
    vehicleSystem.cars.forEach(c => { if (c.pos.distanceTo(player.pos) < 5) nearCar = true; });
    hud.setPrompt(nearCar ? 'Pressione F para entrar' : '');

  } else {
    // ── Driving ──────────────────────────────────────────────
    const c = player.car;
    const accel = input.isDown('KeyW') || input.isDown('ArrowUp')   ?  1
                : input.isDown('KeyS') || input.isDown('ArrowDown') ? -0.4
                : 0;
    c.vel += accel * 18 * dt;
    c.vel *= .94;
    c.vel = Math.max(-10, Math.min(28, c.vel));
    if (input.isDown('KeyA') || input.isDown('ArrowLeft'))  c.angle -= .9 * dt * (Math.abs(c.vel) / 15 + .1);
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) c.angle += .9 * dt * (Math.abs(c.vel) / 15 + .1);

    const mx = Math.sin(c.angle) * c.vel * dt;
    const mz = Math.cos(c.angle) * c.vel * dt;
    const nx = c.pos.x + mx, nz = c.pos.z + mz;
    if (!collision.isInside(nx, c.pos.z)) c.pos.x = nx; else c.vel *= -.4;
    if (!collision.isInside(c.pos.x, nz)) c.pos.z = nz; else c.vel *= -.4;
    collision.resolve(c.pos, 2.5);

    c.mesh.position.copy(c.pos);
    c.mesh.rotation.y = c.angle;
    c.wheels.forEach(w => { w.rotation.x += c.vel * dt * .5; });
    c.mesh.rotation.z = (input.isDown('KeyA') || input.isDown('ArrowLeft')) ? -.04
                      : (input.isDown('KeyD') || input.isDown('ArrowRight')) ?  .04
                      : 0;

    player.pos.set(c.pos.x, c.pos.y + 1, c.pos.z);

    // Car vs NPCs
    npcSystem.npcs.forEach(n => {
      if (n.dead) return;
      if (n.pos.distanceTo(c.pos) < 3 && Math.abs(c.vel) > 3) {
        onNPCKill(n, Math.abs(c.vel) * 12);
        wantedSystem.add(1, spawnCop);
        hud.updateWanted(wantedSystem.level);
      }
    });

    hud.setPrompt('Pressione F para sair');
  }

  // ── AI Traffic ─────────────────────────────────────────────
  vehicleSystem.updateTraffic(dt, collision);

  // ── Police AI ──────────────────────────────────────────────
  trafficSystem.update(dt, player, wantedSystem.level, collision, frame, hurtPlayer);

  // ── Wanted decay ───────────────────────────────────────────
  wantedSystem.update(dt, () => {
    trafficSystem.clearAll();
  });
  hud.updateWanted(wantedSystem.level);

  // ── NPCs ───────────────────────────────────────────────────
  npcSystem.update(dt, player.pos, wantedSystem.level, collision, frame);

  // ── Bullets & Particles ────────────────────────────────────
  bulletSystem.update(dt, npcSystem, player, collision, hurtPlayer, (n, dmg) => onNPCKill(n, dmg));

  // ── Pickups ────────────────────────────────────────────────
  pickupSystem.update(dt, player, wAmmo, wRes, frame, (p) => {
    if (p.type === 'weapon') showMsg('ARMA OBTIDA!');
    showMsg('+' + p.value + ' ' + p.type.toUpperCase(), 120);
    hud.update(player, WEAPONS, wAmmo, wRes);
  });

  // ── Message timer ──────────────────────────────────────────
  if (msgTimer > 0) {
    msgTimer -= dt * 60;
    if (msgTimer <= 0) document.getElementById('msg').style.opacity = '0';
  }

  // ── Camera ─────────────────────────────────────────────────
  camCtrl.update(player.pos, player.inCar);

  // ── Minimap ────────────────────────────────────────────────
  minimap.draw(player.pos, camCtrl.yaw, vehicleSystem.cars, npcSystem.npcs, collision.boxes);
}

// ── Public API (called from HTML) ───────────────────────────
window.startGame = function () {
  screens.hideTitle();
  gameRunning = true;
  input.gameRunning = true;
  initGame();
  engine.start(update);
};

window.restartGame = function () {
  screens.hideWasted();
  renderer.domElement.style.filter = '';

  // Clear all entities
  if (vehicleSystem) vehicleSystem.clear();
  if (npcSystem)     npcSystem.clear();
  if (pickupSystem)  pickupSystem.clear();
  if (bulletSystem)  bulletSystem.clear();
  if (trafficSystem) trafficSystem.clear();

  gameRunning = true;
  input.gameRunning = true;
  player.dead = false;
  initGame();
  // Engine RAF is already running — just re-enable gameRunning
};
