import { Box3, Sphere, Vector3 } from 'three';

/**
 * Represents a point within the Octree, linking a position to its data.
 */
export interface OctreePoint<T> {
    position: Vector3;
    data: T;
}

/**
 * A 3D spatial partitioning data structure that divides space into eight octants.
 * It's highly efficient for querying objects within a specific region, significantly
 * reducing the number of checks needed in large-scale environments.
 */
export class Octree<T> {
    private boundary: Box3;
    private capacity: number;
    private points: OctreePoint<T>[] = [];
    private children: Octree<T>[] | null = null;

    /**
     * @param boundary The bounding box that defines the space of this Octree node.
     * @param capacity The maximum number of points a node can hold before it subdivides.
     */
    constructor(boundary: Box3, capacity: number) {
        this.boundary = boundary;
        this.capacity = capacity;
    }

    /**
     * Inserts a point into the Octree.
     * @param point The point to insert, containing a position and associated data.
     * @returns True if the point was inserted successfully, false otherwise.
     */
    public insert(point: OctreePoint<T>): boolean {
        if (!this.boundary.containsPoint(point.position)) {
            return false;
        }

        if (this.points.length < this.capacity && this.children === null) {
            this.points.push(point);
            return true;
        }

        if (this.children === null) {
            this.subdivide();
        }

        for (const child of this.children!) {
            if (child.insert(point)) {
                return true;
            }
        }
        
        return false; // Should not happen if boundary check is correct
    }

    private subdivide(): void {
        const center = new Vector3();
        this.boundary.getCenter(center);
        const halfSize = new Vector3();
        this.boundary.getSize(halfSize).multiplyScalar(0.5);

        this.children = [];
        for (let i = 0; i < 8; i++) {
            const min = this.boundary.min.clone();
            min.x += (i & 1) ? halfSize.x : 0;
            min.y += (i & 2) ? halfSize.y : 0;
            min.z += (i & 4) ? halfSize.z : 0;
            
            const max = min.clone().add(halfSize);
            const childBoundary = new Box3(min, max);
            this.children.push(new Octree<T>(childBoundary, this.capacity));
        }

        // Move existing points to children
        for (const point of this.points) {
            for (const child of this.children) {
                if (child.insert(point)) break;
            }
        }
        this.points = [];
    }

    /**
     * Queries the Octree for points within a given range.
     * @param range The Box3 or Sphere defining the query area.
     * @param found An optional array to store the found points.
     * @returns An array of points found within the range.
     */
    public query(range: Box3 | Sphere, found: OctreePoint<T>[] = []): OctreePoint<T>[] {
        // Use the appropriate intersection test based on the range type.
        // This is more accurate and efficient than converting a sphere to a box.
        const intersects = (range instanceof Sphere)
            ? range.intersectsBox(this.boundary)
            : this.boundary.intersectsBox(range);

        if (!intersects) {
            return found;
        }

        for (const point of this.points) {
            if (range.containsPoint(point.position)) {
                found.push(point);
            }
        }

        if (this.children !== null) {
            for (const child of this.children) {
                child.query(range, found);
            }
        }

        return found;
    }

    /**
     * Clears all points and children from the Octree.
     */
    public clear(): void {
        this.points = [];
        this.children = null;
    }
im
    /**
     * Gets the boundary of the current Octree node.
     * @returns The Box3 boundary.
     */
    public getBoundary(): Box3 {
        return this.boundary;
    }

    /**
     * Traverses the Octree and executes a callback for each node.
     * @param callback The function to execute for each Octree node.
     */
    public traverse(callback: (octree: Octree<T>) => void): void {
        callback(this);
        this.children?.forEach(child => child.traverse(callback));
    }
}