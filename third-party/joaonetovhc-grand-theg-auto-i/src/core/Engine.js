import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════
//  THEG I — Engine (Renderer + Game Loop)
// ═══════════════════════════════════════════════════════════

export class Engine {
  constructor(canvas) {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x89C4E1);
    this.scene.fog = new THREE.FogExp2(0xA8D5E8, 0.0035);

    // Camera
    this.camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 1200);

    // Lighting
    const sun = new THREE.DirectionalLight(0xFFF8DC, 1.4);
    sun.position.set(300, 400, 200);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 1000;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -400;
    sun.shadow.camera.right = sun.shadow.camera.top = 400;
    sun.shadow.bias = -0.0003;
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(0x6080A0, 0.5));
    this.scene.add(new THREE.HemisphereLight(0xADD8E6, 0x4a6741, 0.6));

    this._rafId = null;
    this._prevTime = 0;

    // Resize handler
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  start(updateFn) {
    const loop = (now) => {
      this._rafId = requestAnimationFrame(loop);
      const dt = Math.min((now - this._prevTime) * .001, .05);
      this._prevTime = now;
      updateFn(dt);
      this.renderer.render(this.scene, this.camera);
    };
    this._prevTime = performance.now();
    this._rafId = requestAnimationFrame(loop);
  }

  stop() {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }
}
