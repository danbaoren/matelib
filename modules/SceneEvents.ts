import * as THREE from 'three';
import * as RE from 'rogue-engine';
import { Logger } from './Logger';


  /** 
   * Example Usage:
   *
   * // 1. Initialize SceneEvents once at the start of your application.
   * //    This patches THREE.Scene.add and THREE.Scene.remove to automatically
   * //    dispatch ObjectAdded and ObjectRemoved events.
   * SceneEvents.init();
   *
   * // 2. Add event listeners for specific event types.
   *
   * // Listen for when objects are added to the scene
   * SceneEvents.addEventListener(SceneEventType.ObjectAdded, (event) => {
   *   Logger.log(`Object Added: ${event.object?.name || 'Unnamed Object'} to scene ${event.scene?.name || 'Unnamed Scene'}`);
   *   // You can access event.object and event.scene here
   * });
   *
   * // Listen for when objects are removed from the scene
   * SceneEvents.addEventListener(SceneEventType.ObjectRemoved, (event) => {
   *   Logger.log(`Object Removed: ${event.object?.name || 'Unnamed Object'} from scene ${event.scene?.name || 'Unnamed Scene'}`);
   *   // You can access event.object and event.scene here
   * });
   *
   * // Listen for when the scene is about to be updated (e.g., at the beginning of your game loop)
   * SceneEvents.addEventListener(SceneEventType.SceneUpdated, (event) => {
   *   // Logger.log(`Scene Updated: ${event.scene?.name || 'Unnamed Scene'}`);
   *   // Perform actions before the scene's update logic
   * });
   *
   * // Listen for when the scene has been rendered (e.g., at the end of your render loop)
   * SceneEvents.addEventListener(SceneEventType.SceneRendered, (event) => {
   *   // Logger.log(`Scene Rendered: ${event.scene?.name || 'Unnamed Scene'}`);
   *   // Perform actions after the scene has been drawn
   * });
   *
   * // 3. Manually dispatch SceneUpdated and SceneRendered events in your main loop.
   * //    ObjectAdded and ObjectRemoved events are dispatched automatically by the patched THREE.Scene methods.
   *
   * // Example of a typical game loop structure:
   * function gameLoop() {
   *   // Dispatch SceneUpdated at the beginning of the update phase
   *   SceneEvents.dispatchSceneUpdated(RE.currentScene); // Assuming RE.currentScene is your active THREE.Scene
   *
   *   // Your game update logic here (e.g., RE.Runtime.update() or custom component updates)
   *
   *   // Dispatch SceneRendered after rendering
   *   // Assuming you have a renderer instance, e.g., RE.Runtime.renderer
   *   // RE.Runtime.renderer.render(RE.currentScene, RE.Runtime.camera);
   *   SceneEvents.dispatchSceneRendered(RE.currentScene);
   *
   *   requestAnimationFrame(gameLoop);
   * }
   *
   * // Start the game loop
   * // gameLoop();
   *
   * // 4. To remove an event listener (e.g., when a component is destroyed)
   * // const myObjectAddedCallback = (event) => { /* ... */ 
    //// SceneEvents.addEventListener(SceneEventType.ObjectAdded, myObjectAddedCallback); // SceneEvents.removeEventListener(SceneEventType.ObjectAdded, myObjectAddedCallback);



export enum SceneEventType {
  ObjectAdded = "objectAdded",
  ObjectRemoved = "objectRemoved",
  SceneRendered = "sceneRendered",
  SceneUpdated = "sceneUpdated",
}

export interface SceneEvent {
  type: SceneEventType;
  object?: THREE.Object3D; // For ObjectAdded/Removed events
  scene?: THREE.Scene; // For SceneRendered/Updated events
}

export class SceneEvents {
  private static listeners: Map<SceneEventType, ((event: SceneEvent) => void)[]> = new Map();
  private static originalSceneAdd: Function | null = null;
  private static originalSceneRemove: Function | null = null;


  static init() {
    if (SceneEvents.originalSceneAdd !== null) {
      Logger.log("SceneEvents already initialized.");
      return;
    }

    // Patch THREE.Scene.add
    SceneEvents.originalSceneAdd = THREE.Scene.prototype.add;
    (THREE.Scene.prototype.add as any) = function<T extends THREE.Object3D>(this: THREE.Scene, ...object: T[]): T {
      const result = SceneEvents.originalSceneAdd!.apply(this, object);
      for (const obj of object) {
        SceneEvents.dispatchEvent({ type: SceneEventType.ObjectAdded, object: obj, scene: this });
      }
      return result;
    };

    // Patch THREE.Scene.remove
    SceneEvents.originalSceneRemove = THREE.Scene.prototype.remove as any;
    (THREE.Scene.prototype.remove as any) = function<T extends THREE.Object3D>(this: THREE.Scene, ...object: T[]): T {
      const result = SceneEvents.originalSceneRemove!.apply(this, object);
      for (const obj of object) {
        SceneEvents.dispatchEvent({ type: SceneEventType.ObjectRemoved, object: obj, scene: this });
      }
      return result;
    };

    Logger.log("SceneEvents initialized: THREE.Scene.add and .remove patched.");
  }

  static addEventListener(eventType: SceneEventType, callback: (event: SceneEvent) => void) {
    if (!SceneEvents.listeners.has(eventType)) {
      SceneEvents.listeners.set(eventType, []);
    }
    SceneEvents.listeners.get(eventType)!.push(callback);
  }

  static removeEventListener(eventType: SceneEventType, callback: (event: SceneEvent) => void) {
    if (SceneEvents.listeners.has(eventType)) {
      const callbacks = SceneEvents.listeners.get(eventType)!;
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  static dispatchEvent(event: SceneEvent) {
    if (SceneEvents.listeners.has(event.type)) {
      SceneEvents.listeners.get(event.type)!.forEach(callback => callback(event));
    }
  }

  /**
   * Call this method at the end of your main render loop to dispatch a SceneRendered event.
   * @param scene The scene that was just rendered.
   */
  static dispatchSceneRendered(scene: THREE.Scene) {
    SceneEvents.dispatchEvent({ type: SceneEventType.SceneRendered, scene: scene });
  }

  /**
   * Call this method at the beginning of your main update loop to dispatch a SceneUpdated event.
   * @param scene The scene that is about to be updated.
   */
  static dispatchSceneUpdated(scene: THREE.Scene) {
    SceneEvents.dispatchEvent({ type: SceneEventType.SceneUpdated, scene: scene });
  }

}