import * as RE from 'rogue-engine';
import * as THREE from 'three';
import { Logger } from './Logger';
import { Utils } from './Utils';

// --- Scene Graph Utilities ---

/**
 * # Scene - Advanced Scene Management & Utilities
 *
 * Provides a powerful set of tools for interacting with the Three.js scene graph,
 * including advanced object searching, component retrieval, and general scene utilities.
 * For scene streaming, use the `ChunkStreamer` module.
 */
export class Scene {

    /**
     * Finds the first Object3D that satisfies the given criteria.
     * @param criteria A set of conditions to match against.
     * @param parent The object to start the search from (defaults to the current scene).
     * @returns The first matching Object3D or null if not found.
     */
    public static findObject(
        criteria: {
            name?: string | RegExp;
            tag?: string;
            component?: new (...args: any[]) => RE.Component;
            predicate?: (obj: THREE.Object3D) => boolean;
        },
        parent: THREE.Object3D = RE.Runtime.scene
    ): THREE.Object3D | null {
        let found: THREE.Object3D | null = null;

        parent.traverse(obj => {
            if (found) return; // Stop traversal once an object is found

            let isMatch = true;
            if (criteria.name) {
                if (typeof criteria.name === 'string') {
                    isMatch = isMatch && obj.name === criteria.name;
                } else {
                    isMatch = isMatch && criteria.name.test(obj.name);
                }
            }
            if (criteria.tag) {
                isMatch = isMatch && obj.userData.tag === criteria.tag;
            }
            if (criteria.component) {
                isMatch = isMatch && RE.getComponent(criteria.component, obj) !== null;
            }
            if (criteria.predicate) {
                isMatch = isMatch && criteria.predicate(obj);
            }

            if (isMatch) {
                found = obj;
            }
        });

        return found;
    }

    /**
     * Finds all Object3Ds that satisfy the given criteria.
     * @param criteria A set of conditions to match against.
     * @param parent The object to start the search from (defaults to the current scene).
     * @returns An array of matching Object3Ds.
     */
    public static findObjects(
        criteria: {
            name?: string | RegExp;
            tag?: string;
            component?: new (...args: any[]) => RE.Component;
            predicate?: (obj: THREE.Object3D) => boolean;
        },
        parent: THREE.Object3D = RE.Runtime.scene
    ): THREE.Object3D[] {
        const found: THREE.Object3D[] = [];

        parent.traverse(obj => {
            let isMatch = true;
            if (criteria.name) {
                if (typeof criteria.name === 'string') {
                    isMatch = isMatch && obj.name === criteria.name;
                } else {
                    isMatch = isMatch && criteria.name.test(obj.name);
                }
            }
            if (criteria.tag) {
                isMatch = isMatch && obj.userData.tag === criteria.tag;
            }
            if (criteria.component) {
                isMatch = isMatch && RE.getComponent(criteria.component, obj) !== null;
            }
            if (criteria.predicate) {
                isMatch = isMatch && criteria.predicate(obj);
            }

            if (isMatch) {
                found.push(obj);
            }
        });

        return found;
    }

    /**
     * Finds an object by its name.
     * @param name The name of the object to find.
     * @param parent The object to search within.
     * @returns The found object or null.
     */
    public static findObjectByName(name: string, parent?: THREE.Object3D): THREE.Object3D | null {
        return this.findObject({ name }, parent);
    }

    /**
     * Finds the first object that has a specific component attached.
     * @param component The component class to search for.
     * @param parent The object to search within.
     * @returns The found object or null.
     */
    public static findObjectByComponent<T extends RE.Component>(component: new (...args: any[]) => T, parent?: THREE.Object3D): THREE.Object3D | null {
        return this.findObject({ component }, parent);
    }

    /**
     * Finds all objects that have a specific component attached.
     * @param component The component class to search for.
     * @param parent The object to search within.
     * @returns An array of found objects.
     */
    public static findObjectsByComponent<T extends RE.Component>(component: new (...args: any[]) => T, parent?: THREE.Object3D): THREE.Object3D[] {
        return this.findObjects({ component }, parent);
    }

    /**
     * Retrieves a component from an object or its children.
     * @param component The component class to retrieve.
     * @param obj The object to search on.
     * @returns The component instance or null.
     */
    public static getComponent<T extends RE.Component>(component: new (...args: any[]) => T, obj: THREE.Object3D): T | null {
        return RE.getComponent(component, obj);
    }

    /**
     * Retrieves all component instances attached to a specific object.
     * @param obj The object to get components from.
     * @returns An array of all component instances on the object.
     */
    public static getAllComponents(obj: THREE.Object3D): RE.Component[] {
        return (obj as any).components || [];
    }

    /**
     * Retrieves all instances of a component from an object and its direct children.
     * @param component The component class to retrieve.
     * @param obj The parent object to search.
     * @returns An array of component instances.
     */
    public static getComponentsInChildren<T extends RE.Component>(component: new (...args: any[]) => T, obj: THREE.Object3D): T[] {
        const components: T[] = [];
        for (const child of obj.children) {
            const comp = RE.getComponent(component, child);
            if (comp) {
                components.push(comp);
            }
        }
        return components;
    }

    /**
     * Retrieves a component from an object or its ancestors.
     * @param component The component class to retrieve.
     * @param obj The object to start searching from.
     * @returns The component instance or null.
     */
    public static getComponentInParent<T extends RE.Component>(component: new (...args: any[]) => T, obj: THREE.Object3D): T | null {
        let current = obj.parent;
        while (current) {
            const comp = RE.getComponent(component, current);
            if (comp) {
                return comp;
            }
            current = current.parent;
        }
        return null;
    }

    /**
     * Traverses up the scene graph from the given object.
     * @param obj The object to start from.
     * @param callback A function to call for each ancestor. If it returns true, traversal stops.
     */
    public static traverseUp(obj: THREE.Object3D, callback: (ancestor: THREE.Object3D) => boolean | void): void {
        let current = obj.parent;
        while (current) {
            if (callback(current)) {
                break;
            }
            current = current.parent;
        }
    }

    /**
     * Sets the visibility of an object and all its descendants.
     * @param object The root object.
     * @param visible Whether the object should be visible.
     * @param includeRoot Whether to apply the visibility to the root object itself.
     */
    public static setVisibility(object: THREE.Object3D, visible: boolean, includeRoot: boolean = true): void {
        if (includeRoot) {
            object.visible = visible;
        }
        object.traverse(child => {
            child.visible = visible;
        });
    }

    /**
     * Destroys an object and its descendants, properly disposing of geometries and materials.
     * @param object The object to destroy.
     */
    public static destroy(object: THREE.Object3D, disposeAssets: boolean = false): void {
        if (!object) return;

        if (disposeAssets) {
            object.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    child.geometry?.dispose();

                    const material = child.material as THREE.Material | THREE.Material[];
                    if (Array.isArray(material)) {
                        material.forEach(mat => mat.dispose());
                    } else if (material) {
                        material.dispose();
                    }
                }
            });
        }

        object.removeFromParent();
    }

    /**
     * Finds and destroys all objects whose names contain a specific string.
     * This is useful for cleaning up objects that may have dynamic IDs in their names but share a common identifier.
     * @param namePart The string to search for within the object names. The search is case-sensitive.
     * @param parent The object to start the search from (defaults to the current scene).
     * @param disposeAssets If true, also disposes of the geometries and materials of the destroyed objects to free up memory.
     */
    public static destroyObjectsByNameContaining(
        namePart: string,
        parent: THREE.Object3D = RE.Runtime.scene,
        disposeAssets: boolean = false
    ): void {
        // Use a regular expression to find objects whose names contain the given string.
        const objectsToDestroy = this.findObjects({ name: new RegExp(namePart) }, parent);

        if (objectsToDestroy.length === 0) {
            Logger.log(`No objects found with name containing "${namePart}" to destroy.`, "Scene");
            return;
        }

        Logger.log(`Destroying ${objectsToDestroy.length} objects with name containing "${namePart}".`, "Scene");
        objectsToDestroy.forEach(obj => this.destroy(obj, disposeAssets));
    }

    /**
     * Adds a component to an object by the component's class name.
     * @param object The Object3D to add the component to.
     * @param componentName The string name of the component class (e.g., "MyComponent").
     * @param componentInstanceName Optional. A unique name for this component instance.
     * @returns The newly created component instance, or null if the component class was not found.
     */
    public static addComponentByName<T extends RE.Component>(
        object: THREE.Object3D,
        componentName: string,
        componentInstanceName?: string
    ): Promise<T | null> {
        // Accessing the internal component registry. This might be an undocumented API.
        // Wrapped in a setTimeout to allow Rogue Engine's component registry to initialize.
        return new Promise((resolve) => {
            setTimeout(() => {
    

                const componentClasses = (RE as any).Components.classes;

                if (!componentClasses) {
                    Logger.error("Scene.addComponentByName: Could not find the internal component registry (RE.Components.classes).");
                    resolve(null);
                    return;
                }

                const ComponentClass = componentClasses.get(componentName);

                if (!ComponentClass) {
                    Logger.error(`Scene.addComponentByName: Component class "${componentName}" is not registered or does not exist.`);
                    resolve(null);
                    return;
                }

                // Check if the component already exists to avoid duplicates
                if (RE.getComponent(ComponentClass, object)) {
                    Logger.warn(`Scene.addComponentByName: Component "${componentName}" already exists on object "${object.name}".`);
                    resolve(RE.getComponent(ComponentClass, object) as T);
                    return;
                }

                const instanceName = componentInstanceName || `${componentName}_${Utils.uuid().substring(0, 8)}`;
                const newComponent = new ComponentClass(instanceName, object);

                RE.addComponent(newComponent);

                resolve(newComponent as T);
            }, 100); // Increased delay to 100ms
        });
    }

    /**
     * Adds an Object3D to the scene or a specified parent.
     * @param object The Object3D to add.
     * @param parent The parent to add the object to (defaults to the current scene).
     */
    public static addObject(object: THREE.Object3D, parent: THREE.Object3D = RE.Runtime.scene): void {
        parent.add(object);
    }

    /**
     * Creates an empty Object3D and adds it to the scene or a specified parent.
     * Useful for grouping objects or as a placeholder.
     * @param name The name of the empty object.
     * @param parent The parent to add the empty object to (defaults to the current scene).
     * @returns The newly created empty Object3D.
     */
    public static createEmpty(name: string = "EmptyObject", parent: THREE.Object3D = RE.Runtime.scene): THREE.Object3D {
        const empty = new THREE.Object3D();
        empty.name = name;
        parent.add(empty);
        return empty;
    }

    /**
     * Creates a THREE.Mesh with the given geometry and material and adds it to the scene or a specified parent.
     * @param geometry The geometry for the mesh.
     * @param material The material(s) for the mesh.
     * @param name The name of the mesh.
     * @param parent The parent to add the mesh to (defaults to the current scene).
     * @returns The newly created THREE.Mesh.
     */
    public static createMesh(geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], name: string = "MeshObject", parent: THREE.Object3D = RE.Runtime.scene): THREE.Mesh {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = name;
        parent.add(mesh);
        return mesh;
    }

    /**
     * Creates an empty Object3D, acting as a folder, and adds it to the scene or a specified parent.
     * This is an alias for createEmpty for better semantic understanding.
     * @param name The name of the folder.
     * @param parent The parent to add the folder to (defaults to the current scene).
     * @returns The newly created folder Object3D.
     */
    public static createFolder(name: string = "NewFolder", parent: THREE.Object3D = RE.Runtime.scene): THREE.Object3D {
        return this.createEmpty(name, parent);
    }

    /**
     * Sets the position of an Object3D.
     * @param object The object to position.
     * @param x The x-coordinate.
     * @param y The y-coordinate.
     * @param z The z-coordinate.
     */
    public static setPosition(object: THREE.Object3D, x: number, y: number, z: number): void {
        object.position.set(x, y, z);
    }

    /**
     * Sets the rotation of an Object3D using Euler angles (in radians).
     * @param object The object to rotate.
     * @param x The rotation around the x-axis (in radians).
     * @param y The rotation around the y-axis (in radians).
     * @param z The rotation around the z-axis (in radians).
     */
    public static setRotation(object: THREE.Object3D, x: number, y: number, z: number): void {
        object.rotation.set(x, y, z);
    }

    /**
     * Sets the scale of an Object3D.
     * @param object The object to scale.
     * @param x The scale factor along the x-axis.
     * @param y The scale factor along the y-axis.
     * @param z The scale factor along the z-axis.
     */
    public static setScale(object: THREE.Object3D, x: number, y: number, z: number): void {
        object.scale.set(x, y, z);
    }

    /**
     * Resets the position, rotation, and scale of an Object3D to their default values.
     * Position: (0, 0, 0)
     * Rotation: (0, 0, 0)
     * Scale: (1, 1, 1)
     * @param object The object to reset.
     */
    public static resetTransform(object: THREE.Object3D): void {
        object.position.set(0, 0, 0);
        object.rotation.set(0, 0, 0);
        object.scale.set(1, 1, 1);
    }

    /**
     * Registers multiple functions to be called when the Rogue Engine runtime stops.
     * Each function will be called with its original 'this' context.
     * @param callbacks A list of functions to call on stop.
     */
    public static onStop(...callbacks: Function[]): void {
        RE.Runtime.onStop(() => {
            callbacks.forEach(callback => {
                try {
                    callback();
                } catch (error) {
                    Logger.error(`Error executing onStop callback: ${error}`, "Scene");
                }
            });
        });
    }

    /**
     * Logs a formatted, interactive tree of the scene graph to the console.
     * This helps in visualizing the hierarchy, attached components, and properties of objects.
     * @param parent The object to start the traversal from (defaults to the current scene).
     */
    public static logSceneGraph(parent: THREE.Object3D = RE.Runtime.scene): void {
        Logger.log(`%c--- Scene Graph for: ${parent.name || 'Unnamed Scene'} ---`, 'color: #2196F3; font-weight: bold;');

        const traverseAndLog = (obj: THREE.Object3D) => {
            const components = this.getAllComponents(obj);
            const hasChildren = obj.children.length > 0;
            const hasComponents = components.length > 0;

            const objectInfo = {
                name: obj.name || '(unnamed)',
                type: obj.type,
                id: obj.id,
                uuid: obj.uuid,
                visible: obj.visible,
                position: obj.position.toArray(),
                rotation: obj.rotation.toArray(),
                scale: obj.scale.toArray(),
            };

            const groupLabel = `${objectInfo.name} (${objectInfo.type})`;

            if (hasChildren || hasComponents) {
                Logger.log('%cObject Details:', 'color: #9E9E9E; font-weight: bold;', objectInfo);

                if (hasComponents) {
                    components.forEach(comp => {
                        Logger.log(comp); // Log the component instance for full inspection
                    });
                }

                if (hasChildren) {
                    obj.children.forEach(child => traverseAndLog(child));
                }

            }
        };
        parent.children.forEach(child => traverseAndLog(child));
    }




}