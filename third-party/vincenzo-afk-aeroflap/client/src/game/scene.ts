import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import type { Engine } from "@babylonjs/core/Engines/engine";
import { GameWorld } from "./GameWorld";

export type GameHandle = {
  scene: Scene;
  resize: () => void;
  dispose: () => void;
};

/** Creates a new AeroFlap scene while keeping gameplay isolated in GameWorld. */
export async function createGameScene(engine: Engine, canvas: HTMLCanvasElement): Promise<GameHandle> {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.49, 0.77, 0.89, 1);
  scene.autoClear = true;

  const camera = new FreeCamera("flight-camera", new Vector3(0, 0, -10), scene);
  camera.setTarget(Vector3.Zero());
  const world = new GameWorld(scene, canvas, camera);

  scene.onBeforeRenderObservable.add(() => {
    world.update(scene.getEngine().getDeltaTime() / 1000);
  });

  return {
    scene,
    resize: () => world.resize(),
    dispose: () => {
      world.dispose();
      scene.dispose();
    },
  };
}
