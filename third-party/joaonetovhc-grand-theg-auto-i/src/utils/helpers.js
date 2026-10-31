import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════
//  THEG I — Helpers
// ═══════════════════════════════════════════════════════════

/** Cria um THREE.Mesh BoxGeometry com sombras habilitadas. */
export function box(w, h, d, mat, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = m.receiveShadow = true;
  m.rotation.set(rx, ry, rz);
  return m;
}

/** Constrói um humanoid (player ou NPC) com Three.js. */
export function makeHumanoid(bodyMat, skinMat, pantMat) {
  const g = new THREE.Group();
  // Torso
  const torso = box(.55, .7, .3, bodyMat); torso.position.y = .35; g.add(torso);
  // Head
  const head = box(.38, .38, .38, skinMat); head.position.y = .88; g.add(head);
  // Arms
  const armL = box(.18, .6, .18, bodyMat); armL.position.set(-.37, .25, 0); g.add(armL);
  const armR = box(.18, .6, .18, bodyMat); armR.position.set(.37, .25, 0); g.add(armR);
  // Hands
  const handL = box(.14, .14, .14, skinMat); handL.position.set(-.37, -.06, 0); armL.add(handL);
  const handR = box(.14, .14, .14, skinMat); handR.position.set(.37, -.06, 0); armR.add(handR);
  // Legs
  const legL = box(.22, .7, .22, pantMat); legL.position.set(-.15, -.35, 0); g.add(legL);
  const legR = box(.22, .7, .22, pantMat); legR.position.set(.15, -.35, 0); g.add(legR);
  g._armL = armL; g._armR = armR; g._legL = legL; g._legR = legR;
  return g;
}

/** Retorna um ângulo normalizado para [-PI, PI]. */
export function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
