import * as THREE from 'three';

export class OctreeNode {
  public bounds: THREE.Box3;
  public objects: THREE.Object3D[] = [];
  public children: OctreeNode[] = [];
  public parent: OctreeNode | null = null;
  public depth: number;

  constructor(bounds: THREE.Box3, depth: number, parent: OctreeNode | null = null) {
    this.bounds = bounds;
    this.depth = depth;
    this.parent = parent;
  }

  /**
   * Subdivides the current node into 8 children nodes.
   */
  subdivide(): void {
    if (this.children.length > 0) {
      return; // Already subdivided
    }

    const min = this.bounds.min;
    const max = this.bounds.max;
    const size = new THREE.Vector3().subVectors(max, min);
    const halfSize = new THREE.Vector3().copy(size).multiplyScalar(0.5);
    const center = new THREE.Vector3().addVectors(min, halfSize);

    // Create 8 children nodes
    this.children.push(
      // Bottom layer
      new OctreeNode(new THREE.Box3(min, center), this.depth + 1, this), // 0: ---
      new OctreeNode(new THREE.Box3(new THREE.Vector3(center.x, min.y, min.z), new THREE.Vector3(max.x, center.y, center.z)), this.depth + 1, this), // 1: +--
      new OctreeNode(new THREE.Box3(new THREE.Vector3(min.x, min.y, center.z), new THREE.Vector3(center.x, center.y, max.z)), this.depth + 1, this), // 2: -+-
      new OctreeNode(new THREE.Box3(new THREE.Vector3(center.x, min.y, center.z), new THREE.Vector3(max.x, center.y, max.z)), this.depth + 1, this), // 3: +++

      // Top layer
      new OctreeNode(new THREE.Box3(new THREE.Vector3(min.x, center.y, min.z), new THREE.Vector3(center.x, max.y, center.z)), this.depth + 1, this), // 4: -+-
      new OctreeNode(new THREE.Box3(new THREE.Vector3(center.x, center.y, min.z), new THREE.Vector3(max.x, max.y, center.z)), this.depth + 1, this), // 5: +--
      new OctreeNode(new THREE.Box3(new THREE.Vector3(min.x, center.y, center.z), new THREE.Vector3(center.x, max.y, max.z)), this.depth + 1, this), // 6: --+
      new OctreeNode(new THREE.Box3(center, max), this.depth + 1, this) // 7: +++
    );

    // Distribute existing objects to children
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const obj = this.objects[i];
      const objBox = new THREE.Box3().setFromObject(obj);
      for (const child of this.children) {
        if (child.bounds.intersectsBox(objBox)) {
          child.objects.push(obj);
        }
      }
      this.objects.splice(i, 1); // Remove from parent after distribution
    }
  }

  /**
   * Clears all objects and children from this node.
   */
  clear(): void {
    this.objects = [];
    for (const child of this.children) {
      child.clear();
    }
    this.children = [];
  }
}
