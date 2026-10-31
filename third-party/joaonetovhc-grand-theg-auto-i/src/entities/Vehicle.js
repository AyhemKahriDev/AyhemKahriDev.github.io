import * as THREE from 'three';
import { GCOLS, GROWS, CELL, W, D } from '../config/game.config.js';

// ═══════════════════════════════════════════════════════════
//  THEG I — Vehicle System
// ═══════════════════════════════════════════════════════════

const CAR_COLORS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xffffff, 0x111111, 0xe67e22, 0x95a5a6];

function makeCar(scene, MAT, x, z, colorHex) {
  const g = new THREE.Group();
  const mat = MAT.car(colorHex);

  // Body low
  const bodyLow = new THREE.Mesh(new THREE.BoxGeometry(2, 0.55, 4.2), mat);
  bodyLow.castShadow = bodyLow.receiveShadow = true;
  bodyLow.position.y = .45; g.add(bodyLow);

  // Body high (cabin)
  const bodyHi = new THREE.Mesh(new THREE.BoxGeometry(1.7, .55, 2.3), mat);
  bodyHi.castShadow = bodyHi.receiveShadow = true;
  bodyHi.position.set(0, .9, -.1); g.add(bodyHi);

  // Windshield front
  const wf = new THREE.Mesh(new THREE.BoxGeometry(1.62, .5, 0.12), MAT.glass);
  wf.castShadow = wf.receiveShadow = true;
  wf.position.set(0, .9, .98); wf.rotation.x = .35; g.add(wf);

  // Windshield rear
  const wr = new THREE.Mesh(new THREE.BoxGeometry(1.62, .45, 0.12), MAT.glass);
  wr.castShadow = wr.receiveShadow = true;
  wr.position.set(0, .9, -1.1); wr.rotation.x = -.3; g.add(wr);

  // Side windows
  const swL = new THREE.Mesh(new THREE.BoxGeometry(.08, .44, 1.8), MAT.glass);
  swL.castShadow = swL.receiveShadow = true;
  swL.position.set(-0.85, .9, -.1); g.add(swL);
  const swR = new THREE.Mesh(new THREE.BoxGeometry(.08, .44, 1.8), MAT.glass);
  swR.castShadow = swR.receiveShadow = true;
  swR.position.set(0.85, .9, -.1); g.add(swR);

  // Hood
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, .08, 1.3), mat);
  hood.castShadow = hood.receiveShadow = true;
  hood.position.set(0, .72, 1.3); hood.rotation.x = .12; g.add(hood);

  // Trunk
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.85, .08, 0.9), mat);
  trunk.castShadow = trunk.receiveShadow = true;
  trunk.position.set(0, .72, -1.55); trunk.rotation.x = -.1; g.add(trunk);

  // Bumpers
  const bmpF = new THREE.Mesh(new THREE.BoxGeometry(2.1, .3, .15), mat);
  bmpF.castShadow = bmpF.receiveShadow = true;
  bmpF.position.set(0, .35, 2.15); g.add(bmpF);
  const bmpR = new THREE.Mesh(new THREE.BoxGeometry(2.1, .3, .15), mat);
  bmpR.castShadow = bmpR.receiveShadow = true;
  bmpR.position.set(0, .35, -2.15); g.add(bmpR);

  // Headlights
  const hlL = new THREE.Mesh(new THREE.BoxGeometry(.35, .18, .05),
    new THREE.MeshLambertMaterial({ color: 0xfffde7, emissive: 0xffffbb, emissiveIntensity: .8 }));
  hlL.castShadow = true;
  hlL.position.set(-.72, .5, 2.12); g.add(hlL);
  const hlR = hlL.clone(); hlR.position.x = .72; g.add(hlR);

  // Tail lights
  const tlL = new THREE.Mesh(new THREE.BoxGeometry(.35, .18, .05),
    new THREE.MeshLambertMaterial({ color: 0xff1111, emissive: 0xff0000, emissiveIntensity: .5 }));
  tlL.castShadow = true;
  tlL.position.set(-.72, .5, -2.12); g.add(tlL);
  const tlR = tlL.clone(); tlR.position.x = .72; g.add(tlR);

  // Wheels
  const wGeo = new THREE.CylinderGeometry(.38, .38, .22, 14);
  const wheelPositions = [[-1, 0, 1.35], [1, 0, 1.35], [-1, 0, -1.35], [1, 0, -1.35]];
  const wheels = [];
  wheelPositions.forEach(([wx, wy, wz]) => {
    const wm = new THREE.Mesh(wGeo, MAT.wheel);
    wm.rotation.z = Math.PI / 2; wm.position.set(wx, wy, wz);
    wm.castShadow = true; g.add(wm);
    wheels.push(wm);
  });

  // Police siren
  let siren = null;
  if (colorHex === 0x1a3a7a) {
    siren = new THREE.PointLight(0x0000ff, .0, 15);
    siren.position.set(0, 1.5, 0);
    g.add(siren);
  }

  g.traverse(m => { if (m.isMesh) m.castShadow = true; });
  g.position.set(x, 0.38, z);
  scene.add(g);

  return {
    mesh: g, wheels, siren,
    pos: new THREE.Vector3(x, 0.38, z),
    vel: 0, steer: 0, angle: Math.random() * Math.PI * 2,
    health: 100, color: colorHex,
    isCop: colorHex === 0x1a3a7a,
    occupied: false,
  };
}

export class VehicleSystem {
  constructor(scene, MAT) {
    this.scene = scene;
    this.MAT   = MAT;
    this.cars  = [];
  }

  spawn(count, collision, startX, startZ) {
    for (let i = 0; i < count; i++) {
      let x, z, tries = 0;
      do {
        const ci = Math.floor(Math.random() * GCOLS);
        const ri = Math.floor(Math.random() * GROWS);
        const roadX = ci * CELL;
        const roadZ = ri * CELL;
        if (Math.random() < .5) { x = roadX; z = roadZ + CELL / 2; }
        else                    { x = roadX + CELL / 2; z = roadZ; }
        tries++;
      } while (Math.hypot(x - startX, z - startZ) < 60 && tries < 100);
      const color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
      this.cars.push(makeCar(this.scene, this.MAT, x, z, color));
    }
  }

  spawnCop(playerPos) {
    const a = Math.random() * Math.PI * 2;
    const d = 80 + Math.random() * 60;
    const x = playerPos.x + Math.cos(a) * d;
    const z = playerPos.z + Math.sin(a) * d;
    const c = makeCar(this.scene, this.MAT, x, z, 0x1a3a7a);
    c.isCop = true;
    this.cars.push(c);
    return c;
  }

  updateTraffic(dt, collision) {
    this.cars.forEach(c => {
      if (c.occupied || c.isCop) return;
      c.vel = Math.min(8, c.vel + 4 * dt);
      c.pos.x += Math.sin(c.angle) * c.vel * dt;
      c.pos.z += Math.cos(c.angle) * c.vel * dt;
      if (collision.isInside(c.pos.x, c.pos.z) || c.pos.x < 0 || c.pos.x > W || c.pos.z < 0 || c.pos.z > D) {
        c.angle += Math.PI * .5 + Math.random() * Math.PI * .4;
        c.pos.x -= Math.sin(c.angle) * c.vel * dt * 2;
        c.pos.z -= Math.cos(c.angle) * c.vel * dt * 2;
        c.vel = 0;
      }
      c.mesh.position.copy(c.pos);
      c.mesh.rotation.y = c.angle;
      c.wheels.forEach(w => { w.rotation.x += c.vel * dt * .5; });
    });
  }

  clear() {
    this.cars.forEach(c => {
      if (c.mesh && c.mesh.parent) c.mesh.parent.remove(c.mesh);
    });
    this.cars.length = 0;
  }
}
