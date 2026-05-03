import * as PIXI from 'pixi.js';
import { Game } from './Game';

export interface Scene {
  readonly name: string;
  readonly container: PIXI.Container;
  prepare?(): Promise<void>;
  onEnter?(): void;
  onExit?(): void;
  update?(dt: number): void;
}

class SceneManagerClass {
  private scenes = new Map<string, Scene>();
  private currentScene: Scene | null = null;
  private hooked = false;

  register(scene: Scene): void {
    this.scenes.set(scene.name, scene);

    if (!this.hooked) {
      Game.ticker.add(() => {
        const dt = Game.ticker.deltaMS / 1000;
        this.currentScene?.update?.(dt);
      });
      this.hooked = true;
    }
  }

  async prepare(name: string): Promise<void> {
    const scene = this.scenes.get(name);
    if (!scene) {
      throw new Error(`Scene "${name}" is not registered`);
    }
    await scene.prepare?.();
  }

  switchTo(name: string): void {
    const next = this.scenes.get(name);
    if (!next) {
      throw new Error(`Scene "${name}" is not registered`);
    }

    if (this.currentScene) {
      this.currentScene.onExit?.();
      Game.stage.removeChild(this.currentScene.container);
    }

    this.currentScene = next;
    Game.stage.addChild(next.container);
    next.onEnter?.();
  }
}

export const SceneManager = new SceneManagerClass();
