import { Camera } from "@babylonjs/core/Cameras/camera";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Scene } from "@babylonjs/core/scene";
import { assets } from "./assets";
import {
  CUSTOMIZATION_DEFAULTS,
  type CustomizationSnapshot,
} from "../../../shared/customization";

export type FlightPhase = "idle" | "playing" | "gameover";

export type FlightState = {
  score: number;
  best: number;
  phase: FlightPhase;
};

type GatePair = {
  top: Mesh;
  bottom: Mesh;
  topCap: Mesh;
  bottomCap: Mesh;
  x: number;
  gapCenter: number;
  gapSize: number;
  scored: boolean;
  bodyMaterials: [StandardMaterial, StandardMaterial];
};

const CONFIG = {
  gravity: -27,
  flapVelocity: 9.8,
  startingSpeed: 4.65,
  playerWidth: 1.05,
  playerHeight: 0.76,
  playerX: -3.55,
  minY: -7.2,
  maxY: 7.15,
  obstacleWidth: 1.25,
  obstacleSpacing: 5.9,
};

const COLORS = {
  vermilion: Color3.FromHexString("#f24a2e"),
  ink: Color3.FromHexString("#172038"),
  green: Color3.FromHexString("#378a62"),
  greenDark: Color3.FromHexString("#1f684a"),
  ivory: Color3.FromHexString("#fff6df"),
  cloudShadow: Color3.FromHexString("#dce7e5"),
};

/**
 * Framework-agnostic game owner for the AeroFlap scene.
 * It owns Babylon meshes, flight state, semantic input, scoring, and teardown.
 */
export class GameWorld {
  private readonly camera: FreeCamera;
  private readonly player: Mesh;
  private playerMaterial!: StandardMaterial;
  private readonly clouds: Mesh[] = [];
  private readonly gates: GatePair[] = [];
  private readonly materials: StandardMaterial[] = [];
  private readonly scene: Scene;
  private readonly canvas: HTMLCanvasElement;
  private readonly demoMode: boolean;
  private background: Mesh;
  private customPlaneArt: Mesh | null = null;
  private customPlaneMaterial: StandardMaterial | null = null;
  private accentColor = Color3.FromHexString(CUSTOMIZATION_DEFAULTS.accentColor);
  private gateColor = Color3.FromHexString(CUSTOMIZATION_DEFAULTS.gateColor);
  private paceMultiplier = CUSTOMIZATION_DEFAULTS.pace;
  private gapMultiplier = CUSTOMIZATION_DEFAULTS.gateOpening;
  private phase: FlightPhase = "idle";
  private score = 0;
  private best = 0;
  private playerY = 0;
  private velocity = 0;
  private speed = CONFIG.startingSpeed;
  private viewportWidth = 16;
  private elapsed = 0;
  private demoStartDelay = 0.45;

  private readonly onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    this.flap();
  };

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.code !== "Space" && event.code !== "ArrowUp") return;
    event.preventDefault();
    this.flap();
  };

  private readonly onOverlayFlap = () => this.flap();
  private readonly onCustomization = (event: Event) => {
    this.applyCustomization((event as CustomEvent<CustomizationSnapshot>).detail);
  };

  constructor(scene: Scene, canvas: HTMLCanvasElement, camera: FreeCamera) {
    this.scene = scene;
    this.canvas = canvas;
    this.camera = camera;
    this.demoMode = new URLSearchParams(window.location.search).has("demo");
    this.best = this.readBestScore();

    this.background = this.createBackground();
    this.player = this.createPlayerFallback();
    this.createCloudLayers();
    this.resize();
    this.resetScene();

    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("aeroflap:flap", this.onOverlayFlap);
    window.addEventListener("aeroflap:customization", this.onCustomization);

    if (this.demoMode) {
      this.phase = "playing";
      this.velocity = CONFIG.flapVelocity * 0.65;
      this.emitState();
    }
  }

  update(delta: number) {
    const cappedDelta = Math.min(delta, 0.035);
    this.elapsed += cappedDelta;
    this.updateClouds(cappedDelta);

    if (this.demoMode && this.phase === "playing") {
      this.runDemoPilot();
    }

    if (this.phase !== "playing") {
      this.updatePlayerVisual();
      return;
    }

    this.velocity += CONFIG.gravity * cappedDelta;
    this.playerY += this.velocity * cappedDelta;
    this.speed = (Math.min(7.15, CONFIG.startingSpeed + this.score * 0.095) * this.paceMultiplier);

    for (const gate of this.gates) {
      gate.x -= this.speed * cappedDelta;
      this.positionGate(gate);

      if (!gate.scored && gate.x + CONFIG.obstacleWidth / 2 < CONFIG.playerX - CONFIG.playerWidth / 2) {
        gate.scored = true;
        this.score += 1;
        this.emitState();
      }
    }

    while (this.gates.length && this.gates[0].x < -this.viewportWidth / 2 - 2) {
      const oldGate = this.gates.shift();
      oldGate?.top.dispose();
      oldGate?.bottom.dispose();
      oldGate?.topCap.dispose();
      oldGate?.bottomCap.dispose();
    }

    const tail = this.gates[this.gates.length - 1];
    if (!tail || tail.x < this.viewportWidth / 2) {
      this.spawnGate(this.viewportWidth / 2 + 3.25, this.score);
    }

    if (this.playerY < CONFIG.minY || this.playerY > CONFIG.maxY || this.hasGateCollision()) {
      this.crash();
    }

    this.updatePlayerVisual();
  }

  resize() {
    const engine = this.scene.getEngine();
    const aspect = Math.max(0.5, engine.getRenderWidth() / Math.max(1, engine.getRenderHeight()));
    this.viewportWidth = Math.max(11.5, 18 * aspect);
    this.camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
    this.camera.orthoTop = 9;
    this.camera.orthoBottom = -9;
    this.camera.orthoLeft = -this.viewportWidth / 2;
    this.camera.orthoRight = this.viewportWidth / 2;
    this.background.scaling.x = this.viewportWidth / 2;
    this.background.scaling.y = 9;
    this.clouds.forEach((cloud, index) => {
      cloud.scaling.x = (this.viewportWidth + 7 + index * 2.5) / 2;
    });
  }

  dispose() {
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("aeroflap:flap", this.onOverlayFlap);
    window.removeEventListener("aeroflap:customization", this.onCustomization);
    this.materials.forEach((material) => material.dispose());
  }

  private createMaterial(name: string, color: Color3, alpha = 1) {
    const material = new StandardMaterial(name, this.scene);
    material.disableLighting = true;
    material.emissiveColor = color;
    material.diffuseColor = color;
    material.alpha = alpha;
    this.materials.push(material);
    return material;
  }

  private createTexturedMaterial(name: string, url: string) {
    const material = new StandardMaterial(name, this.scene);
    material.disableLighting = true;
    material.emissiveColor = Color3.White();
    material.diffuseColor = Color3.White();
    const texture = new Texture(url, this.scene, true, false);
    texture.hasAlpha = true;
    material.diffuseTexture = texture;
    material.opacityTexture = texture;
    material.useAlphaFromDiffuseTexture = true;
    this.materials.push(material);
    return material;
  }

  private createBackground() {
    const material = this.createTexturedMaterial("sky-art", assets.sky);
    const mesh = MeshBuilder.CreatePlane("sky-art-plane", { size: 2 }, this.scene);
    mesh.position.z = 4.5;
    mesh.material = material;
    return mesh;
  }

  private createPlayerFallback() {
    const material = this.createMaterial("player-fallback", this.accentColor);
    const mesh = MeshBuilder.CreateDisc(
      "player-fallback",
      { radius: 0.74, tessellation: 3 },
      this.scene,
    );
    mesh.position = new Vector3(CONFIG.playerX, 0, 0.2);
    mesh.scaling = new Vector3(1.15, 0.78, 1);
    mesh.material = material;
    this.playerMaterial = material;
    return mesh;
  }

  private createCloudLayers() {
    // The illustrated target already carries the full paper-cloud composition.
    // Keeping this layer procedural prevents temporary image-generation placeholders
    // from obscuring an otherwise playable first screen.
  }

  private resetScene() {
    this.gates.splice(0).forEach((gate) => {
      gate.top.dispose();
      gate.bottom.dispose();
      gate.topCap.dispose();
      gate.bottomCap.dispose();
    });
    this.score = 0;
    this.playerY = 0;
    this.velocity = 0;
    this.speed = CONFIG.startingSpeed;
    this.spawnGate(this.viewportWidth / 2 + 1.6, 0, 0.45, 7.65);
    this.spawnGate(this.viewportWidth / 2 + 1.6 + CONFIG.obstacleSpacing, 1);
    this.updatePlayerVisual();
    this.emitState();
  }

  private flap() {
    if (this.phase === "gameover") {
      this.phase = "playing";
      this.resetScene();
    } else if (this.phase === "idle") {
      this.phase = "playing";
      this.emitState();
    }
    this.velocity = CONFIG.flapVelocity;
    this.updatePlayerVisual();
  }

  private crash() {
    if (this.phase !== "playing") return;
    this.phase = "gameover";
    this.best = Math.max(this.best, this.score);
    try {
      window.localStorage.setItem("aeroflap-best", String(this.best));
    } catch {
      // Persistence is optional; gameplay remains functional in restricted contexts.
    }
    this.emitState();
  }

  private spawnGate(startX: number, sequence: number, fixedCenter?: number, fixedGap?: number) {
    const gapSize = (fixedGap ?? Math.max(6.25, 7.55 - this.score * 0.045)) * this.gapMultiplier;
    const sequenceAngle = sequence * 2.13 + 0.85;
    const gapCenter = fixedCenter ?? Math.sin(sequenceAngle) * 2.9;
    const topMaterial = this.createMaterial(`gate-top-${sequence}`, this.gateColor);
    const bottomMaterial = this.createMaterial(`gate-bottom-${sequence}`, this.gateColor);
    const capMaterial = this.createMaterial(`gate-cap-${sequence}`, COLORS.ivory);
    const top = MeshBuilder.CreateBox(`gate-top-${sequence}`, { width: CONFIG.obstacleWidth, height: 1, depth: 0.7 }, this.scene);
    const bottom = MeshBuilder.CreateBox(`gate-bottom-${sequence}`, { width: CONFIG.obstacleWidth, height: 1, depth: 0.7 }, this.scene);
    const topCap = MeshBuilder.CreateBox(`gate-top-cap-${sequence}`, { width: CONFIG.obstacleWidth + 0.16, height: 0.22, depth: 0.76 }, this.scene);
    const bottomCap = MeshBuilder.CreateBox(`gate-bottom-cap-${sequence}`, { width: CONFIG.obstacleWidth + 0.16, height: 0.22, depth: 0.76 }, this.scene);
    top.material = topMaterial;
    bottom.material = bottomMaterial;
    topCap.material = capMaterial;
    bottomCap.material = capMaterial;

    const gate: GatePair = {
      top,
      bottom,
      topCap,
      bottomCap,
      x: startX,
      gapCenter,
      gapSize,
      scored: false,
      bodyMaterials: [topMaterial, bottomMaterial],
    };
    this.gates.push(gate);
    this.positionGate(gate);
  }

  private positionGate(gate: GatePair) {
    const upperEdge = CONFIG.maxY + 1;
    const lowerEdge = CONFIG.minY - 1;
    const topBottom = gate.gapCenter + gate.gapSize / 2;
    const bottomTop = gate.gapCenter - gate.gapSize / 2;
    const topHeight = Math.max(0.8, upperEdge - topBottom);
    const bottomHeight = Math.max(0.8, bottomTop - lowerEdge);

    gate.top.scaling.y = topHeight;
    gate.top.position = new Vector3(gate.x, topBottom + topHeight / 2, 0.95);
    gate.topCap.position = new Vector3(gate.x, topBottom + 0.11, 0.45);

    gate.bottom.scaling.y = bottomHeight;
    gate.bottom.position = new Vector3(gate.x, bottomTop - bottomHeight / 2, 0.95);
    gate.bottomCap.position = new Vector3(gate.x, bottomTop - 0.11, 0.45);
  }

  private hasGateCollision() {
    const playerLeft = CONFIG.playerX - CONFIG.playerWidth / 2;
    const playerRight = CONFIG.playerX + CONFIG.playerWidth / 2;
    const playerTop = this.playerY + CONFIG.playerHeight / 2;
    const playerBottom = this.playerY - CONFIG.playerHeight / 2;

    return this.gates.some((gate) => {
      const gateLeft = gate.x - CONFIG.obstacleWidth / 2;
      const gateRight = gate.x + CONFIG.obstacleWidth / 2;
      if (playerRight < gateLeft || playerLeft > gateRight) return false;
      const gapTop = gate.gapCenter + gate.gapSize / 2;
      const gapBottom = gate.gapCenter - gate.gapSize / 2;
      return playerTop > gapTop || playerBottom < gapBottom;
    });
  }

  private updateClouds(delta: number) {
    const speeds = [0.21, 0.31, 0.12];
    this.clouds.forEach((cloud, index) => {
      cloud.position.x -= speeds[index] * delta;
      const wrapAt = -this.viewportWidth / 2 - 5;
      if (cloud.position.x < wrapAt) {
        cloud.position.x = this.viewportWidth / 2 + 5;
      }
    });
  }

  private updatePlayerVisual() {
    const idleBob = this.phase === "idle" ? Math.sin(this.elapsed * 2.2) * 0.18 : 0;
    const visualY = this.playerY + idleBob;
    const angle = this.phase === "gameover" ? -0.72 : Math.max(-0.52, Math.min(0.42, this.velocity * 0.055));
    this.player.position.y = visualY;
    this.player.rotation.z = angle;
    if (this.customPlaneArt) {
      this.customPlaneArt.position.y = visualY;
      this.customPlaneArt.rotation.z = angle;
    }
  }

  private applyCustomization(snapshot: CustomizationSnapshot) {
    const { settings, assets: customAssets } = snapshot;
    this.accentColor = Color3.FromHexString(settings.accentColor);
    this.gateColor = Color3.FromHexString(settings.gateColor);
    this.paceMultiplier = settings.pace;
    this.gapMultiplier = settings.gateOpening;
    this.playerMaterial.emissiveColor = this.accentColor;
    this.playerMaterial.diffuseColor = this.accentColor;
    this.gates.forEach((gate) => {
      gate.bodyMaterials.forEach(material => {
        material.emissiveColor = this.gateColor;
        material.diffuseColor = this.gateColor;
      });
    });

    const customPlaneUrl = customAssets.planeImage?.url;
    if (customPlaneUrl) {
      this.setCustomPlane(customPlaneUrl);
    } else if (this.customPlaneArt) {
      this.customPlaneArt.dispose();
      this.customPlaneMaterial?.dispose();
      this.customPlaneArt = null;
      this.customPlaneMaterial = null;
      this.player.isVisible = true;
    }

    const usesCustomBackground = settings.backgroundMode !== "default" &&
      Boolean(
        settings.backgroundMode === "image"
          ? customAssets.backgroundImage?.url
          : customAssets.backgroundVideo?.url,
      );
    this.background.isVisible = !usesCustomBackground;
    this.scene.clearColor = usesCustomBackground
      ? new Color4(0, 0, 0, 0)
      : new Color4(0.49, 0.77, 0.89, 1);
  }

  private setCustomPlane(url: string) {
    if (this.customPlaneArt?.metadata?.sourceUrl === url) return;
    this.customPlaneArt?.dispose();
    this.customPlaneMaterial?.dispose();
    const material = this.createTexturedMaterial("custom-plane-art", url);
    const mesh = MeshBuilder.CreatePlane("custom-plane-art", { width: 1.65, height: 1.24 }, this.scene);
    mesh.position = this.player.position.clone();
    mesh.position.z = -0.15;
    mesh.metadata = { sourceUrl: url };
    mesh.material = material;
    this.customPlaneArt = mesh;
    this.customPlaneMaterial = material;
    this.player.isVisible = false;
  }

  private runDemoPilot() {
    if (this.elapsed < this.demoStartDelay) return;
    const nextGate = this.gates.find((gate) => gate.x + CONFIG.obstacleWidth / 2 > CONFIG.playerX - 0.3);
    const desiredY = nextGate ? nextGate.gapCenter : 0;
    if (this.playerY < desiredY - 0.32 || (this.velocity < -4.2 && this.playerY < desiredY + 1.3)) {
      this.velocity = CONFIG.flapVelocity;
    }
  }

  private readBestScore() {
    try {
      return Number.parseInt(window.localStorage.getItem("aeroflap-best") ?? "0", 10) || 0;
    } catch {
      return 0;
    }
  }

  private emitState() {
    window.dispatchEvent(
      new CustomEvent<FlightState>("aeroflap:state", {
        detail: { score: this.score, best: this.best, phase: this.phase },
      }),
    );
  }
}
