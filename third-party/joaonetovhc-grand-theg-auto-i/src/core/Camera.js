import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════
//  THEG I — Camera Controller
// ═══════════════════════════════════════════════════════════

export class CameraController {
  constructor(threeCamera) {
    this.camera = threeCamera;
    this.yaw    = 0;
    this.pitch  = 0.3;
  }

  applyMouseDelta(dx, dy) {
    this.yaw   -= dx * 0.0022;
    this.pitch -= dy * 0.0022;
    this.pitch  = Math.max(-.7, Math.min(.6, this.pitch));
  }

  update(playerPos, inCar) {
    const camDist = inCar ? 8 : 5;
    const target = playerPos.clone().add(new THREE.Vector3(0, inCar ? 1.8 : 1.4, 0));
    const camIdeal = new THREE.Vector3(
      target.x + Math.sin(this.yaw) * camDist,
      target.y + Math.sin(this.pitch) * camDist + .5,
      target.z + Math.cos(this.yaw) * camDist
    );
    this.camera.position.lerp(camIdeal, .15);
    this.camera.lookAt(target);
  }
}
