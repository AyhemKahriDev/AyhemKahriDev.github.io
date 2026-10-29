import { expect, it } from 'vitest';
import * as THREE from 'three';
import { groundHeight, islandAt } from '../src/core/world';
import { Terrain } from '../src/render/terrain';
it('river and terrain surfaces face upward and can be seen from the aircraft', () => {
  const scene = new THREE.Scene();
  new Terrain(scene).update(100, 0);
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh && o.userData.ownGeometry) {
      const normal = o.geometry.getAttribute('normal');
      for (let i = 0; i < normal.count; i++) expect(normal.getY(i)).toBeGreaterThan(0);
    }
  });
});
it('retains only the nearby terrain chunks on a long flight', () => {
  const scene = new THREE.Scene(),
    terrain = new Terrain(scene);
  for (let d = 0; d < 15000; d += 800) terrain.update(d, 0);
  expect(terrain.chunkCount).toBe(13);
  expect(scene.children.length).toBe(13);
});

it('renders raised islands from the collision terrain with continuous chunk seams', () => {
  const scene = new THREE.Scene();
  new Terrain(scene).update(2400, 0);
  const islands: THREE.Mesh[] = [];
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh && object.name === 'river-island') islands.push(object);
  });
  expect(islands.length).toBeGreaterThan(0);
  let raisedVertices = 0,
    matchingSeams = 0;
  const seams = new Map<number, Set<string>>();
  for (const island of islands) {
    const positions = island.geometry.getAttribute('position');
    const ownSeams = new Map<number, Set<string>>();
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        y = positions.getY(i),
        d = -positions.getZ(i);
      if (islandAt(d)) expect(y).toBeCloseTo(groundHeight(x, d), 3);
      if (y > 1) raisedVertices++;
      if (d % 160 === 0 && islandAt(d)) {
        const vertices = ownSeams.get(d) ?? new Set<string>();
        vertices.add(`${x.toFixed(3)},${y.toFixed(3)}`);
        ownSeams.set(d, vertices);
      }
    }
    for (const [d, vertices] of ownSeams) {
      if (seams.has(d)) {
        expect([...vertices].sort()).toEqual([...seams.get(d)!].sort());
        matchingSeams++;
      } else seams.set(d, vertices);
    }
  }
  expect(raisedVertices).toBeGreaterThan(0);
  expect(matchingSeams).toBeGreaterThan(0);
});
