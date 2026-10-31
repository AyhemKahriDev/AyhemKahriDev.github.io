import * as THREE from 'three';

export class SkidMarkSystem {
  constructor(scene, maxPoints = 500) {
    this.scene = scene;
    this.maxPoints = maxPoints;
    this.points = [];
    this.lastLeftPoint = null;
    this.lastRightPoint = null;

    // Use an InstancedMesh or dynamic BufferGeometry for tire marks
    // A segmented quad strip is the most performant and visually accurate approach
    const maxSegments = this.maxPoints;
    this.geometry = new THREE.BufferGeometry();

    const positions = new Float32Array(maxSegments * 6 * 3); // 2 triangles per segment = 6 vertices
    const uvs = new Float32Array(maxSegments * 6 * 2);
    const alphas = new Float32Array(maxSegments * 6);

    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    this.geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

    // Custom shader material for soft rubber skid marks with alpha fading
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -1.0,
      uniforms: {
        color: { value: new THREE.Color(0x2c2724) } // Dark rubber tone matching diorama palette
      },
      vertexShader: `
        attribute float alpha;
        varying float vAlpha;
        varying vec2 vUv;
        void main() {
          vAlpha = alpha;
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        varying float vAlpha;
        varying vec2 vUv;
        void main() {
          float edgeSoftness = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
          float finalAlpha = vAlpha * edgeSoftness * 0.65;
          if (finalAlpha < 0.01) discard;
          gl_FragColor = vec4(color, finalAlpha);
        }
      `
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);

    this.segments = [];
    this.segmentIndex = 0;

    // Mini smoke particle pool
    this.initSmokeParticles();
  }

  initSmokeParticles() {
    this.smokeParticles = [];
    this.maxSmoke = 35;
    const smokeGeo = new THREE.DodecahedronGeometry(0.22, 1);
    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0xf5eee6,
      transparent: true,
      opacity: 0.5,
      depthWrite: false
    });

    for (let i = 0; i < this.maxSmoke; i++) {
      const mesh = new THREE.Mesh(smokeGeo, smokeMat.clone());
      mesh.visible = false;
      this.scene.add(mesh);
      this.smokeParticles.push({
        mesh,
        life: 0,
        maxLife: 0.6,
        velocity: new THREE.Vector3()
      });
    }
    this.smokeIdx = 0;
  }

  emitSmoke(pos) {
    const p = this.smokeParticles[this.smokeIdx];
    p.mesh.position.copy(pos);
    p.mesh.position.y += 0.2;
    p.mesh.scale.setScalar(0.4 + Math.random() * 0.3);
    p.mesh.visible = true;
    p.mesh.material.opacity = 0.5;
    p.life = 0;
    p.maxLife = 0.45 + Math.random() * 0.25;
    p.velocity.set(
      (Math.random() - 0.5) * 1.5,
      0.8 + Math.random() * 1.2,
      (Math.random() - 0.5) * 1.5
    );
    this.smokeIdx = (this.smokeIdx + 1) % this.maxSmoke;
  }

  addSkid(leftPos, rightPos, opacity = 1.0) {
    if (this.lastLeftPoint && this.lastRightPoint) {
      const dist = leftPos.distanceTo(this.lastLeftPoint);
      if (dist > 0.35 && dist < 4.0) {
        this.addSegment(this.lastLeftPoint, this.lastRightPoint, leftPos, rightPos, opacity);
      }
    }
    this.lastLeftPoint = leftPos.clone();
    this.lastRightPoint = rightPos.clone();
  }

  resetCurrentTrack() {
    this.lastLeftPoint = null;
    this.lastRightPoint = null;
  }

  addSegment(p1, p2, p3, p4, alpha) {
    const idx = (this.segmentIndex % this.maxPoints) * 6;
    const pos = this.geometry.attributes.position.array;
    const uvs = this.geometry.attributes.uv.array;
    const alphas = this.geometry.attributes.alpha.array;

    const yOff = 0.025; // Just above ground to avoid z-fighting

    // Triangle 1: p1 -> p2 -> p3
    this.setVertex(pos, idx, p1.x, p1.y + yOff, p1.z);
    this.setVertex(pos, idx + 1, p2.x, p2.y + yOff, p2.z);
    this.setVertex(pos, idx + 2, p3.x, p3.y + yOff, p3.z);

    // Triangle 2: p2 -> p4 -> p3
    this.setVertex(pos, idx + 3, p2.x, p2.y + yOff, p2.z);
    this.setVertex(pos, idx + 4, p4.x, p4.y + yOff, p4.z);
    this.setVertex(pos, idx + 5, p3.x, p3.y + yOff, p3.z);

    // UVs
    uvs[idx * 2] = 0; uvs[idx * 2 + 1] = 0;
    uvs[(idx + 1) * 2] = 1; uvs[(idx + 1) * 2 + 1] = 0;
    uvs[(idx + 2) * 2] = 0; uvs[(idx + 2) * 2 + 1] = 1;
    uvs[(idx + 3) * 2] = 1; uvs[(idx + 3) * 2 + 1] = 0;
    uvs[(idx + 4) * 2] = 1; uvs[(idx + 4) * 2 + 1] = 1;
    uvs[(idx + 5) * 2] = 0; uvs[(idx + 5) * 2 + 1] = 1;

    // Alphas
    for (let i = 0; i < 6; i++) {
      alphas[idx + i] = alpha;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.uv.needsUpdate = true;
    this.geometry.attributes.alpha.needsUpdate = true;

    this.segmentIndex++;
  }

  setVertex(array, index, x, y, z) {
    array[index * 3] = x;
    array[index * 3 + 1] = y;
    array[index * 3 + 2] = z;
  }

  update(dt) {
    // Update smoke particles
    for (let i = 0; i < this.maxSmoke; i++) {
      const p = this.smokeParticles[i];
      if (p.mesh.visible) {
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.mesh.visible = false;
        } else {
          p.mesh.position.addScaledVector(p.velocity, dt);
          const progress = p.life / p.maxLife;
          p.mesh.material.opacity = (1 - progress) * 0.45;
          const scale = 0.4 + progress * 0.9;
          p.mesh.scale.setScalar(scale);
        }
      }
    }
  }
}
