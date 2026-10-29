// ═══════════════════════════════════════════════════════════
//  THEG I — Material Library
// ═══════════════════════════════════════════════════════════
// Pool centralizado de materiais Three.js reutilizáveis.
// Evita criar materiais duplicados e facilita aplicar texturas
// no futuro sem alterar o restante do código.

export function buildMaterials(THREE) {
  return {
    road:     new THREE.MeshLambertMaterial({ color: 0x2a2a2e }),
    sidewalk: new THREE.MeshLambertMaterial({ color: 0x888888 }),
    grass:    new THREE.MeshLambertMaterial({ color: 0x4a7a3a }),
    beach:    new THREE.MeshLambertMaterial({ color: 0xDEB887 }),
    water:    new THREE.MeshLambertMaterial({ color: 0x1a6fa8, transparent: true, opacity: 0.85 }),
    player:   new THREE.MeshLambertMaterial({ color: 0x2c5282 }),
    playerSk: new THREE.MeshLambertMaterial({ color: 0xF4A460 }),
    playerPa: new THREE.MeshLambertMaterial({ color: 0x1a1a2e }),
    glass:    new THREE.MeshLambertMaterial({ color: 0x9BC4CB, transparent: true, opacity: 0.55 }),
    cop:      new THREE.MeshLambertMaterial({ color: 0x1a3a7a }),
    wheel:    new THREE.MeshLambertMaterial({ color: 0x111111 }),
    bullet:   new THREE.MeshBasicMaterial({ color: 0xFFFF00 }),
    line:     new THREE.MeshLambertMaterial({ color: 0xFFFFDD }),
    car:      (c) => new THREE.MeshLambertMaterial({ color: c }),
    npc:      (c) => new THREE.MeshLambertMaterial({ color: c }),
    pickup:   (c) => new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.3 }),
  };
}
