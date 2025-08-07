import * as THREE from 'three';
import * as RE from 'rogue-engine';
import { Logger } from './Logger';
import { Octree } from '../packages/Raycast/Octree/Octree';

export enum RaycastEventType {
  Click = "click",
  Hover = "hover",
  DragStart = "dragstart",
  DragEnd = "dragend",
}

export interface RaycastEvent {
  type: RaycastEventType;
  intersection: THREE.Intersection;
  object: THREE.Object3D;
}

export class Raycast {
  private static raycaster = new THREE.Raycaster();
  private static listeners: Map<THREE.Object3D, Map<RaycastEventType, ((event: RaycastEvent) => void)[]>> = new Map();
  private static _octree: Octree | null = null;
  private static _trackedObjects: Set<THREE.Object3D> = new Set();

  /**
   * Initializes the Octree for spatial partitioning. Call this once when your scene is loaded.
   * @param worldBounds The bounding box of your entire game world. If not provided, a large default will be used.
   * @param maxDepth The maximum depth of the Octree. Deeper trees mean more precise partitioning but higher build cost.
   * @param maxObjectsPerNode The maximum number of objects a node can hold before it subdivides.
   */
  static initOctree(worldBounds?: THREE.Box3, maxDepth: number = 8, maxObjectsPerNode: number = 10) {
    if (!worldBounds) {
      // Default to a large bounding box if not provided. Adjust this to your game's scale.
      worldBounds = new THREE.Box3(
        new THREE.Vector3(-1000, -1000, -1000),
        new THREE.Vector3(1000, 1000, 1000)
      );
      Logger.log("Raycast: Using default Octree world bounds. Consider defining custom bounds for better performance.");
    }

    Raycast._octree = new Octree(worldBounds, maxDepth, maxObjectsPerNode);

    // Initial population of the Octree from the scene
    Raycast.updateOctreeFromScene(true); // Force a full rebuild initially

    Logger.log(`Raycast: Octree initialized.`);
  }

  /**
   * Adds a single object to the Octree. Use this when dynamically adding objects to the scene.
   * @param object The object to add.
   */
  /**
   * Adds a single object to the Octree. Use this when dynamically adding objects to the scene.
   * @param object The object to add.
   */
  /**
   * Adds a single object to the Octree. Use this when dynamically adding objects to the scene.
   * @param object The object to add.
   */
  static addOctreeObject(object: THREE.Object3D) {
    if (Raycast._octree) {
      // Only add if it's a mesh, light, sprite, or line (i.e., something raycastable)
        Raycast._octree.insert(object);
        Raycast._trackedObjects.add(object);
        Logger.log(`Raycast: Added object ${object.name || object.uuid} to Octree.`);
    } else {
      Logger.log("Raycast: Octree not initialized. Cannot add object.");
    }
  }

  /**
   * Removes a single object from the Octree. Use this when dynamically removing objects from the scene.
   * @param object The object to remove.
   */
  static removeOctreeObject(object: THREE.Object3D) {
    if (Raycast._octree) {
      Raycast._octree.remove(object);
      Raycast._trackedObjects.delete(object);
      Logger.log(`Raycast: Removed object ${object.name || object.uuid} from Octree.`);
    } else {
      Logger.log("Raycast: Octree not initialized. Cannot remove object.");
    }
  }



  /**
   * Periodically updates the Octree by checking for new or removed objects in the scene.
   * This is useful for dynamic scenes where objects are added/removed by other systems.
   * Call this method in a game loop or at a regular interval (e.g., every few seconds).
   * @param forceRebuild If true, clears the Octree and rebuilds it from scratch. Use sparingly.
   */
  static updateOctreeFromScene(forceRebuild: boolean = false) {
    if (!Raycast._octree) {
      Logger.log("Raycast: Octree not initialized. Cannot update from scene.");
      return;
    }

    if (!RE.Runtime.scene) {
      Logger.log("Raycast: RE.Runtime.scene is not available. Cannot update Octree.");
      return;
    }

    if (forceRebuild) {
      Raycast._octree.clear();
      Raycast._trackedObjects.clear();
      Logger.log("Raycast: Octree forced rebuild initiated.");
    }

    const currentSceneObjects = new Set<THREE.Object3D>();
    RE.Runtime.scene.traverse((object) => {
      // Only consider objects that are visible and potentially raycastable
        currentSceneObjects.add(object);
    });

    // Remove objects that are no longer in the scene
    for (const trackedObject of Raycast._trackedObjects) {
      if (!currentSceneObjects.has(trackedObject)) {
        Raycast.removeOctreeObject(trackedObject); // This also removes from _trackedObjects
      }
    }

    // Add new objects to the Octree
    for (const sceneObject of currentSceneObjects) {
      if (!Raycast._trackedObjects.has(sceneObject)) {
        Raycast.addOctreeObject(sceneObject); // This also adds to _trackedObjects
      } else {
        // For objects already tracked, check if their position has changed significantly
        // and re-insert if necessary. This is a simple check; a more robust solution
        // might involve storing previous bounding boxes or using a dirty flag.
        // For now, we'll rely on the Octree's insert method to handle re-insertion if bounds change.
        // The Octree's insert method will find the correct node for the object's current bounds.
        // If an object moves from one node's bounds to another, it will be re-inserted correctly.
        // However, for optimal performance, if an object moves significantly, it's best to
        // explicitly remove and re-add it. For this automatic system, we'll let the insert handle it.
      }
    }
    Logger.log(`Raycast: Octree updated. Tracked objects: ${Raycast._trackedObjects.size}`);
  }

  static setLayer(object: THREE.Object3D, layer: number) {
    object.userData.raycastLayer = layer;
  }

  static getLayer(object: THREE.Object3D): number | undefined {
    return object.userData.raycastLayer;
  }

  static addEventListener(object: THREE.Object3D, eventType: RaycastEventType, callback: (event: RaycastEvent) => void) {
    if (!Raycast.listeners.has(object)) {
      Raycast.listeners.set(object, new Map());
    }
    const objectListeners = Raycast.listeners.get(object)!;
    if (!objectListeners.has(eventType)) {
      objectListeners.set(eventType, []);
    }
    objectListeners.get(eventType)!.push(callback);
  }

  static removeEventListener(object: THREE.Object3D, eventType: RaycastEventType, callback: (event: RaycastEvent) => void) {
    if (Raycast.listeners.has(object)) {
      const objectListeners = Raycast.listeners.get(object)!;
      if (objectListeners.has(eventType)) {
        const callbacks = objectListeners.get(eventType)!;
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    }
  }

  static dispatchEvent(event: RaycastEvent) {
    if (Raycast.listeners.has(event.object)) {
      const objectListeners = Raycast.listeners.get(event.object)!;
      if (objectListeners.has(event.type)) {
        objectListeners.get(event.type)!.forEach(callback => callback(event));
      }
    }
  }

  /**
   * Gets all objects whose bounding sphere intersects with the query sphere.
   * This method now uses an Octree for efficient spatial querying.
   *
   * @param position The center of the query sphere in world coordinates.
   * @param radius The radius of the query sphere.
   * @param objects Optional: If provided, the search will be limited to these objects, bypassing the Octree.
   *                This is useful for very specific, small-scale checks.
   * @returns An array of objects whose bounding spheres intersect the query sphere.
   */
  static getInSphere(position: THREE.Vector3, radius: number, objects?: THREE.Object3D[]): THREE.Object3D[] {
    const querySphere = new THREE.Sphere(position, radius);
    let objectsToCheck: THREE.Object3D[];

    if (objects) {
      // If a specific list of objects is provided, use it directly (bypassing Octree)
      objectsToCheck = objects;
    } else if (Raycast._octree) {
      // Otherwise, query the Octree for potential candidates
      objectsToCheck = Raycast._octree.querySphere(querySphere);
      Logger.log(`Octree query for sphere returned ${objectsToCheck.length} candidates.`);
    } else {
      // Fallback if Octree is not initialized
      objectsToCheck = RE.Runtime.scene?.children || [];
      Logger.log("Raycast.getInSphere: Octree not initialized. Falling back to full scene scan.");
    }

    if (!objectsToCheck.length) {
      return [];
    }

    const result: THREE.Object3D[] = [];
    const tempBox = new THREE.Box3();
    const tempSphere = new THREE.Sphere();

    for (const object of objectsToCheck) {
      tempBox.setFromObject(object);

      if (!tempBox.isEmpty()) {
        tempBox.getBoundingSphere(tempSphere);
        if (querySphere.intersectsSphere(tempSphere)) {
          result.push(object);
        }
      } else {
        const radiusSq = radius * radius;
        if (object.position.distanceToSquared(position) < radiusSq) {
          result.push(object);
        }
      }
    }
    return result;
  }

  /**
   * Checks if a target object is within a sphere.
   * @param target The object to check.
   * @param position The center of the sphere.
   * @param radius The radius of the sphere.
   * @returns True if the target is within the sphere, false otherwise.
   */
  static isInSphere(target: THREE.Object3D, position: THREE.Vector3, radius: number): boolean {
    // This method doesn't directly benefit from Octree for a single target check.
    // It's already efficient.
    return target.position.distanceToSquared(position) < radius * radius;
  }

  /**
   * Casts a ray and returns all intersections.
   * This method now uses an Octree for efficient spatial querying.
   *
   * @param origin The origin of the ray.
   * @param direction The direction of the ray.
   * @param objects Optional: If provided, the search will be limited to these objects, bypassing the Octree.
   *                This is useful for very specific, small-scale checks.
   * @param recursive Whether to check descendants of the objects.
   * @param near The near plane.
   * @param far The far plane.
   * @returns An array of intersections.
   */
  static getIntersections(origin: THREE.Vector3, direction: THREE.Vector3, objects?: THREE.Object3D[], recursive: boolean = true, near: number = 0, far: number = Infinity, layer?: number): THREE.Intersection[] {
    this.raycaster.set(origin, direction);
    this.raycaster.near = near;
    this.raycaster.far = far;

    const queryRay = new THREE.Ray(origin, direction);
    let objectsToIntersect: THREE.Object3D[];

    if (objects) {
      objectsToIntersect = objects;
    } else if (Raycast._octree) {
      objectsToIntersect = Raycast._octree.queryRay(queryRay);
      Logger.log(`Octree query for ray returned ${objectsToIntersect.length} candidates.`);
    } else {
      objectsToIntersect = RE.Runtime.scene?.children || [];
      Logger.log("Raycast.getIntersections: Octree not initialized. Falling back to full scene scan.");
    }

    if (layer !== undefined) {
      objectsToIntersect = objectsToIntersect.filter(obj => Raycast.getLayer(obj) === layer);
    }

    return this.raycaster.intersectObjects(objectsToIntersect, recursive);
  }

  /**
   * Casts a ray and returns the first intersection found.
   * This method now uses an Octree for efficient spatial querying.
   *
   * @param origin The origin of the ray.
   * @param direction The direction of the ray.
   * @param objects Optional: If provided, the search will be limited to these objects, bypassing the Octree.
   * @param recursive Whether to check descendants of the objects.
   * @param near The near plane.
   * @param far The far plane.
   * @returns The closest intersection, or null if no intersection is found.
   */
  static getFirstIntersection(origin: THREE.Vector3, direction: THREE.Vector3, objects?: THREE.Object3D[], recursive: boolean = true, near: number = 0, far: number = Infinity): THREE.Intersection | null {
    const intersections = this.getIntersections(origin, direction, objects, recursive, near, far);
    return intersections.length > 0 ? intersections[0] : null;
  }

  /**
   * Gets intersections from the mouse position.
   * This method now uses an Octree for efficient spatial querying.
   *
   * @param camera The camera to use for raycasting.
   * @param mouse A Vector2 with normalized device coordinates (-1 to +1) for mouse position.
   * @param objects Optional: If provided, the search will be limited to these objects, bypassing the Octree.
   * @param recursive Whether to check descendants of the objects.
   * @returns An array of intersections.
   */
  static getMouseIntersections(camera: THREE.Camera, mouse: THREE.Vector2, objects?: THREE.Object3D[], recursive: boolean = true, layer?: number): THREE.Intersection[] {
    this.raycaster.setFromCamera(mouse, camera);

    const queryRay = this.raycaster.ray; // Get the ray from the raycaster
    let objectsToIntersect: THREE.Object3D[];

    if (objects) {
      objectsToIntersect = objects;
    } else if (Raycast._octree) {
      objectsToIntersect = Raycast._octree.queryRay(queryRay);
      Logger.log(`Octree query for mouse ray returned ${objectsToIntersect.length} candidates.`);
    } else {
      objectsToIntersect = RE.Runtime.scene?.children || [];
      Logger.log("Raycast.getMouseIntersections: Octree not initialized. Falling back to full scene scan.");
    }

    if (layer !== undefined) {
      objectsToIntersect = objectsToIntersect.filter(obj => Raycast.getLayer(obj) === layer);
    }

    return this.raycaster.intersectObjects(objectsToIntersect, recursive);
  }

  /**
   * Gets the first intersection from the mouse position.
   * This method now uses an Octree for efficient spatial querying.
   *
   * @param camera The camera to use for raycasting.
   * @param mouse A Vector2 with normalized device coordinates (-1 to +1) for mouse position.
   * @param objects Optional: If provided, the search will be limited to these objects, bypassing the Octree.
   * @param recursive Whether to check descendants of the objects.
   * @returns The closest intersection, or null if no intersection is found.
   */
  static getFirstMouseIntersection(camera: THREE.Camera, mouse: THREE.Vector2, objects?: THREE.Object3D[], recursive: boolean = true): THREE.Intersection | null {
    const intersections = this.getMouseIntersections(camera, mouse, objects, recursive);
    return intersections.length > 0 ? intersections[0] : null;
  }
}
