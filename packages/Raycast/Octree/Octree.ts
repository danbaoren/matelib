import * as THREE from 'three';
import { OctreeNode } from './OctreeNode';
import { Logger } from '../../../modules/Logger';

export class Octree {
  private root: OctreeNode;
  private maxDepth: number;
  private maxObjectsPerNode: number;

  // Reusable temporary objects to avoid repeated allocations
  private static tempBox = new THREE.Box3();
  private static tempSphere = new THREE.Sphere();

  /**
   * @param worldBounds The bounding box of the entire world/scene that the Octree will cover.
   * @param maxDepth The maximum depth the Octree can subdivide to.
   * @param maxObjectsPerNode The maximum number of objects a node can hold before it subdivides.
   */
  constructor(worldBounds: THREE.Box3, maxDepth: number = 8, maxObjectsPerNode: number = 10) {
    this.root = new OctreeNode(worldBounds, 0);
    this.maxDepth = maxDepth;
    this.maxObjectsPerNode = maxObjectsPerNode;
    Logger.log(`Octree initialized with bounds: ${worldBounds.min.toArray()} to ${worldBounds.max.toArray()}, maxDepth: ${maxDepth}, maxObjectsPerNode: ${maxObjectsPerNode}`);
  }

  /**
   * Inserts an object into the Octree.
   * @param object The object to insert. It must have a valid world bounding box.
   */
  insert(object: THREE.Object3D): void {
    Octree.tempBox.setFromObject(object);
    if (Octree.tempBox.isEmpty()) {
      // Logger.log(`Octree: Cannot insert object ${object.name} with empty bounding box.`);
      return; // Cannot insert objects without a valid bounding box
    }
    this.insertIntoNode(this.root, object, Octree.tempBox);
  }

  private insertIntoNode(node: OctreeNode, object: THREE.Object3D, objectBox: THREE.Box3): void {
    if (!node.bounds.intersectsBox(objectBox)) {
      return; // Object is not in this node's bounds
    }

    if (node.children.length > 0) {
      // If subdivided, try to insert into children
      for (const child of node.children) {
        this.insertIntoNode(child, object, objectBox);
      }
    } else {
      // If not subdivided, add to this node
      node.objects.push(object);

      // Check for subdivision criteria
      if (node.objects.length > this.maxObjectsPerNode && node.depth < this.maxDepth) {
        node.subdivide();
        // After subdivision, redistribute objects from this node to its new children
        for (let i = node.objects.length - 1; i >= 0; i--) {
          const obj = node.objects[i];
          Octree.tempBox.setFromObject(obj);
          for (const child of node.children) {
            if (child.bounds.intersectsBox(Octree.tempBox)) {
              child.objects.push(obj);
            }
          }
          node.objects.splice(i, 1); // Remove from parent after distribution
        }
      }
    }
  }

  /**
   * Queries the Octree for objects intersecting a given sphere.
   * @param sphere The query sphere.
   * @returns An array of objects intersecting the sphere.
   */
  querySphere(sphere: THREE.Sphere): THREE.Object3D[] {
    const result: THREE.Object3D[] = [];
    this.querySphereInNode(this.root, sphere, result);
    return result;
  }

  private querySphereInNode(node: OctreeNode, sphere: THREE.Sphere, result: THREE.Object3D[]): void {
    if (!node.bounds.intersectsSphere(sphere)) {
      return; // Node's bounds do not intersect the sphere
    }

    // Add objects in this node that intersect the sphere
    for (const obj of node.objects) {
      Octree.tempBox.setFromObject(obj);
      if (!Octree.tempBox.isEmpty()) {
        Octree.tempBox.getBoundingSphere(Octree.tempSphere);
        if (sphere.intersectsSphere(Octree.tempSphere)) {
          result.push(obj);
        }
      } else {
        // Fallback for objects without geometry
        if (sphere.containsPoint(obj.position)) {
          result.push(obj);
        }
      }
    }

    // Recurse into children
    for (const child of node.children) {
      this.querySphereInNode(child, sphere, result);
    }
  }

  /**
   * Queries the Octree for objects intersecting a given ray.
   * @param ray The query ray.
   * @returns An array of objects intersecting the ray.
   */
  queryRay(ray: THREE.Ray): THREE.Object3D[] {
    const result: THREE.Object3D[] = [];
    this.queryRayInNode(this.root, ray, result);
    return result;
  }

  private queryRayInNode(node: OctreeNode, ray: THREE.Ray, result: THREE.Object3D[]): void {
    if (!ray.intersectsBox(node.bounds)) {
      return; // Node's bounds do not intersect the ray
    }

    // Add objects in this node that intersect the ray
    for (const obj of node.objects) {
      Octree.tempBox.setFromObject(obj);
      if (!Octree.tempBox.isEmpty()) {
        if (ray.intersectsBox(Octree.tempBox)) {
          result.push(obj);
        }
      } else {
        // Fallback for objects without geometry
        // For a ray, checking just the position is not sufficient for non-point objects.
        // More sophisticated checks would be needed here if these objects are meant to be raycastable.
        // For now, we'll skip them if they don't have a bounding box.
      }
    }

    // Recurse into children
    for (const child of node.children) {
      this.queryRayInNode(child, ray, result);
    }
  }

  /**
   * Removes an object from the Octree.
   * @param object The object to remove.
   */
  remove(object: THREE.Object3D): void {
    this.removeFromNode(this.root, object);
  }

  private removeFromNode(node: OctreeNode, object: THREE.Object3D): boolean {
    // Check if the object is in this node's direct object list
    const index = node.objects.indexOf(object);
    if (index > -1) {
      node.objects.splice(index, 1);
      return true; // Object found and removed
    }

    // If not found here, check children
    for (const child of node.children) {
      if (this.removeFromNode(child, object)) {
        return true; // Object found and removed in a child node
      }
    }
    return false; // Object not found in this node or its children
  }

  /**
   * Clears all objects from the Octree, effectively resetting it.
   */
  clear(): void {
    this.root.clear();
    // Re-initialize the root node with its original bounds if needed, or just clear its contents.
    // For now, clearing its contents is sufficient.
    Logger.log("Octree cleared.");
  }
}
