import * as RE from 'rogue-engine';
import { Object3D, Vector3, Box3, Sphere } from 'three';
import * as THREE from 'three';
import { Scene } from './Scene';
import { Logger } from "./Logger";
import { Octree } from './Octree';
import { Utils } from './Utils';

export class Prefab {
    /**
     * Asynchronously finds a prefab's full path from its name or a partial path.
     * This method will wait and retry for a short period if the engine's prefab list
     * is not yet populated, preventing race conditions on startup.
     * @param nameOrPath The simple name (e.g., "MyPrefab") or path (e.g., "Enemies/Goblin") of the prefab.
     * @param retries The number of times to check for the prefab list before failing.
     * @param delay The delay in milliseconds between retries.
     * @returns A promise that resolves to the full, normalized prefab path or null if not found.
     */
    public static async find(nameOrPath: string, retries: number = 5, delay: number = 50): Promise<string | null> {
        // Wait for the prefab list to be populated, retrying a few times.
        for (let i = 0; i < retries; i++) {
            if (Object.keys(RE.Prefab.namedPrefabUUIDs).length > 0) {
                break; // List is populated, we can proceed
            }
            await Utils.wait(delay);
        }

        const namedUUIDs = RE.Prefab.namedPrefabUUIDs;
        if (Object.keys(namedUUIDs).length === 0) {
            Logger.error(`Prefab list is empty. Could not find "${nameOrPath}".`);
            return null;
        }

        // Normalize input: remove .roguePrefab extension if present and normalize slashes
        let normalizedNameOrPath = nameOrPath.endsWith('.roguePrefab')
            ? nameOrPath.slice(0, -'.roguePrefab'.length)
            : nameOrPath;
        normalizedNameOrPath = normalizedNameOrPath.replace(/\\/g, '/'); // Ensure input also uses forward slashes

        const allNormalizedPrefabKeys = Object.keys(namedUUIDs).map(p => p.replace(/\\/g, '/')); // Normalize keys from RE.Prefab.namedPrefabUUIDs

        // 1. Exact match with normalized path
        if (allNormalizedPrefabKeys.includes(normalizedNameOrPath)) {
            return normalizedNameOrPath;
        }

        // 2. Case-insensitive match for full path
        const lowerCaseNormalizedNameOrPath = normalizedNameOrPath.toLowerCase();
        const caseInsensitiveMatch = allNormalizedPrefabKeys.find(p => p.toLowerCase() === lowerCaseNormalizedNameOrPath);
        if (caseInsensitiveMatch) {
            return caseInsensitiveMatch;
        }

        // 3. Handle simple names (no slashes in input)
        if (!normalizedNameOrPath.includes('/')) {
            const matchingPaths = allNormalizedPrefabKeys.filter(p => {
                const fileName = p.substring(p.lastIndexOf('/') + 1);
                return fileName.toLowerCase() === lowerCaseNormalizedNameOrPath; // Case-insensitive match for file name
            });

            if (matchingPaths.length === 1) {
                return matchingPaths[0];
            }
            if (matchingPaths.length > 1) {
                Logger.error(`Ambiguous prefab name "${nameOrPath}". Found multiple matches: ${matchingPaths.join(', ')}. Please provide a more specific path.`);
                return null;
            }
        }

        Logger.error(`Could not resolve prefab name or path: "${nameOrPath}"`);
        return null;
    }

    public static async fetch(nameOrPath: string): Promise<RE.Prefab | null> {
        let path = await this.find(nameOrPath);
        if (!path) {
            Logger.error(`Could not fetch prefab. Prefab not found: "${nameOrPath}"`);
            return null;
        }

        try {
            const prefab = await RE.Prefab.fetch(path);
            return prefab;
        } catch (error) {
            Logger.error(`Error fetching prefab "${path}":`, error);
            return null;
        }
    }

    public static async get(nameOrPath: string): Promise<RE.Prefab | null> {
        let path = await this.find(nameOrPath);
        if (!path) {
            return null;
        }

        try {
            return RE.Prefab.get(path);
        } catch (error) {
            Logger.log(`Could not get prefab for "${path}". It may not be preloaded.`);
            return null;
        }
    }

    public static async preload(nameOrPaths: string | string[]): Promise<void> {
        const paths = Array.isArray(nameOrPaths) ? nameOrPaths : [nameOrPaths];
        const fetchPromises = paths.map(p => this.fetch(p).catch(e => Logger.error(e)));
        await Promise.all(fetchPromises);
    }

    public static getAllPaths(basePath: string = ""): string[] {
        const namedUUIDs = RE.Prefab.namedPrefabUUIDs;
        let allPaths = Object.keys(namedUUIDs);

        // Normalize all paths to use forward slashes
        allPaths = allPaths.map(p => p.replace(/\\/g, '/'));

        if (!basePath) {
            return allPaths;
        }

        return allPaths.filter(path => path.startsWith(basePath));
    }

    public static async instantiate(
        nameOrPath: string,
        options: {
            parent?: THREE.Object3D | null;
            position?: THREE.Vector3;
            rotation?: THREE.Euler;
            scale?: THREE.Vector3;
            name?: string;
        } = {}
    ): Promise<THREE.Object3D | null> {
        let path = await this.find(nameOrPath);
        if (!path) {
            return null;
        }

        try {
            // Defensive step: Ensure path passed to RE.Prefab.instantiate is without .roguePrefab extension
            if (path.endsWith('.roguePrefab')) {
                path = path.slice(0, -'.roguePrefab'.length);
            }
            Logger.log(`Attempting to instantiate prefab with path: ${path}`);
            const instance = await RE.Prefab.instantiate(path);
            if (!instance) {
                Logger.error(`RE.Prefab.instantiate failed for path: ${path}`);
                return null;
            }

            // Add metadata to the instance for later identification
            instance.userData.isPrefab = true;
            instance.userData.prefabPath = path;

            if (options.parent !== undefined) {
                instance.removeFromParent();
                if (options.parent) {
                    options.parent.add(instance);
                }
            }

            if (options.position) instance.position.copy(options.position);
            if (options.rotation) instance.rotation.copy(options.rotation);
            if (options.scale) instance.scale.copy(options.scale);
            if (options.name) instance.name = options.name;

            return instance;
        } catch (error) {
            Logger.error(`Error during instantiation of prefab "${path}":`, error);
            return null;
        }
    }

    /**
     * Instantiates multiple prefabs by their names or paths.
     * This is a convenience method for calling `instantiate` on a list of prefabs.
     * It will return an array of successfully instantiated objects, filtering out any that failed.
     * @param namesOrPaths A list of prefab names or paths to instantiate.
     * @returns A promise that resolves to an array of the instantiated Object3D instances.
     */
    public static async instantiateMultiple(...namesOrPaths: string[]): Promise<THREE.Object3D[]> {
        const instantiationPromises = namesOrPaths.map(nameOrPath => this.instantiate(nameOrPath));
        const instances = await Promise.all(instantiationPromises);
        // Filter out any null results from failed instantiations and ensure type safety
        return instances.filter((instance): instance is THREE.Object3D => instance !== null);
    }

    /**
     * Applies a shader to all meshes within a given Object3D instance.
     * This will replace the existing material(s) on each mesh and dispose of the old ones to prevent memory leaks.
     *
     * @param instance The root Object3D of the prefab or model.
     * @param shader A `THREE.ShaderMaterial` instance or a shader definition object.
     *               A single material instance will be created from the provided shader and shared across all meshes.
     *               This is efficient and allows you to control all meshes by modifying one material's uniforms.
     * @example
     * // --- 1. Using a shader definition object (e.g., from another file) ---
     * import { DissolveShader } from './DissolveShader';
     *
     * const myInstance = await Prefab.instantiate("MyObject");
     *
     * // This will create ONE material from the DissolveShader definition
     * // and apply it to ALL meshes within myInstance.
     * Prefab.applyShader(myInstance, DissolveShader);
     *
     * // --- 2. Using a pre-created THREE.ShaderMaterial instance ---
     * const mySharedMaterial = new THREE.ShaderMaterial({ ... });
     * Prefab.applyShader(myInstance, mySharedMaterial);
     *
     * // Now you can animate mySharedMaterial.uniforms.some_value.value
     * // and all meshes in myInstance will update together.
     */
    public static applyShader(
        instance: THREE.Object3D,
        shader: THREE.ShaderMaterial | { vertexShader: string, fragmentShader: string, uniforms?: { [uniform: string]: THREE.IUniform } }
    ): void {
        if (!instance) {
            Logger.error("Prefab.applyShader: Provided instance is null or undefined.");
            return;
        }

        let materialToApply: THREE.ShaderMaterial;

        if (shader instanceof THREE.ShaderMaterial) {
            materialToApply = shader;
        } else {
            materialToApply = new THREE.ShaderMaterial({
                vertexShader: shader.vertexShader,
                fragmentShader: shader.fragmentShader,
                uniforms: shader.uniforms || {},
                transparent: true, // Common default for effects
                side: THREE.DoubleSide,
            });
        }

        instance.traverse(child => {
            if (child instanceof THREE.Mesh) {
                if (Array.isArray(child.material)) child.material.forEach(mat => mat.dispose());
                else if (child.material) child.material.dispose();
                child.material = materialToApply;
            }
        });
    }

    public static destroy(instance: THREE.Object3D, disposeAssets: boolean = false): void {
        if (!instance) {
            Logger.warn("Prefab.destroy was called with a null or undefined instance.");
            return;
        }
        Scene.destroy(instance, disposeAssets);
    }
}

interface StreamablePrefab {
    id: string;
    path: string;
    position: THREE.Vector3;
    instance?: THREE.Object3D;
    isLoaded: boolean;
    folder?: string;
    originalScale?: THREE.Vector3;
    originalRotation?: THREE.Euler;

    // Optimization properties
    renderDistance: number;
    loadDistanceSq: number;
    priority: number;
    unloadDistanceSq: number;

    // Fade properties
    fadeState: 'none' | 'in' | 'out' | 'visible';
    fadeProgress: number; // 0 to 1
    animationParams?: {
        scaleOvershoot: number;
        stretchAxis: Vector3;
        stretchAmount: number;
        rotationAxis: Vector3;
        rotationAmount: number;
    };
}

export class PrefabStreamer {

    public prefabs: Map<string, StreamablePrefab> = new Map();
    public target: THREE.Object3D | null;
    private folders: Map<string, THREE.Object3D> = new Map();
    private enableLogging: boolean;
    public unloadDistanceMultiplier: number = 1.2;
    public fadeInDuration: number; // ms
    public fadeOutDuration: number; // ms
    private octree: Octree<StreamablePrefab>;
    private querySphere: Sphere;
    private loadedPrefabs: Map<string, StreamablePrefab> = new Map();
    private maxRenderDistance: number = 0;
    private updateInterval: number;
    private lastUpdateTime: number = 0;
    private maxConcurrentLoads: number;
    private currentlyLoadingCount: number = 0;
    public useFancyFade: boolean;

    // Queues for smooth loading/unloading
    private loadQueue: StreamablePrefab[] = [];
    private unloadQueue: StreamablePrefab[] = [];
    private isProcessingQueues: boolean = false;

    constructor(options: {
        target: THREE.Object3D | null;
        worldBounds?: Box3;
        octreeCapacity?: number;
        enableLogging?: boolean;
        updateInterval?: number;
        fadeInDuration?: number;
        fadeOutDuration?: number;
        maxConcurrentLoads?: number;
        useFancyFade?: boolean;
    }) {
        const {
            target,
            worldBounds = new Box3(new Vector3(-10000, -10000, -10000), new Vector3(10000, 10000, 10000)),
            octreeCapacity = 8,
            enableLogging = true,
            updateInterval = 250,
            fadeInDuration = 500,
            fadeOutDuration = 500,
            maxConcurrentLoads = 1,
            useFancyFade = true
        } = options;

        this.target = target;
        this.enableLogging = enableLogging;
        this.octree = new Octree<StreamablePrefab>(worldBounds, octreeCapacity);
        this.querySphere = new Sphere();
        this.updateInterval = updateInterval;
        this.fadeInDuration = fadeInDuration;
        this.fadeOutDuration = fadeOutDuration;
        this.maxConcurrentLoads = maxConcurrentLoads;
        this.useFancyFade = useFancyFade;
    }

    async add(options: { id: string; path?: string; renderDistance: number; position?: THREE.Vector3; folder?: string }) {
        const { id, path: pathOrName = id, renderDistance, position, folder } = options;

        if (this.prefabs.has(id)) {
            if (this.enableLogging) {
                Logger.warn(`PrefabStreamer: A prefab with the ID '${id}' already exists.`);
            }
            return;
        }

        const fullPath = await Prefab.find(pathOrName);
        if (!fullPath) {
            if (this.enableLogging) {
                Logger.error(`PrefabStreamer: Could not find prefab: "${pathOrName}"`);
            }
            return;
        }

        let finalPosition = position;

        if (!finalPosition) {
            const tempInstance = await Prefab.instantiate(fullPath);
            if (tempInstance) {
                finalPosition = tempInstance.position.clone();
                Prefab.destroy(tempInstance);
            } else {
                Logger.error(`PrefabStreamer: Could not instantiate prefab to get position: ${fullPath}`);
                finalPosition = new Vector3(); // Fallback
            }
        }

        const loadDistanceSq = renderDistance * renderDistance;
        const unloadDistance = renderDistance * this.unloadDistanceMultiplier;
        const unloadDistanceSq = unloadDistance * unloadDistance;

        this.maxRenderDistance = Math.max(this.maxRenderDistance, renderDistance);

        const streamablePrefab: StreamablePrefab = {
            id,
            path: fullPath,
            renderDistance,
            position: finalPosition,
            loadDistanceSq,
            unloadDistanceSq,
            priority: 0,
            isLoaded: false,
            folder,
            fadeState: 'none',
            fadeProgress: 0,
        };

        this.prefabs.set(id, streamablePrefab);
        this.octree.insert({ position: finalPosition, data: streamablePrefab });
    }

    private generateRandomAnimationParams() {
        const stretchAxes = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)];
        const randomAxis = stretchAxes[Utils.randomInt(0, 2)];

        return {
            scaleOvershoot: Utils.random(1.1, 1.4), // Pop effect
            stretchAxis: randomAxis, // Stretch along X, Y, or Z
            stretchAmount: Utils.random(1.2, 1.6), // Stretch by 20% to 60%
            rotationAxis: new Vector3(Utils.random(-1, 1), Utils.random(-1, 1), Utils.random(-1, 1)).normalize(),
            rotationAmount: Utils.random(-Math.PI / 12, Math.PI / 12) // Rotate up to 15 degrees
        };
    }

    remove(id: string) {
        const prefab = this.prefabs.get(id);
        if (prefab) {
            if (prefab.isLoaded) {
                this.unload(prefab);
            }
            // Note: A full octree remove implementation would be more complex.
            // For this use case, clearing and re-adding is simpler if removals are rare.
            // Or, we can just let it be, as it won't be in the main `prefabs` map anymore.
            this.prefabs.delete(id);
        }
    }

    updateRenderDistance(id: string, distance: number) {
        const prefab = this.prefabs.get(id);
        if (prefab) {
            prefab.renderDistance = distance;
            prefab.loadDistanceSq = distance * distance;
            prefab.unloadDistanceSq = (distance * this.unloadDistanceMultiplier) * (distance * this.unloadDistanceMultiplier);
            if (this.enableLogging) {
                Logger.log(`Updated render distance for ${id} to ${distance}`);
            }
        }
    }

    updateDistanceChecks() {
        if (!this.target) return;

        const now = performance.now();
        if (now - this.lastUpdateTime < this.updateInterval) {
            return; // Not time to update yet
        }
        this.lastUpdateTime = now;

        this.populateQueues();

        if (!this.isProcessingQueues) {
            this.processQueues();
        }
    }

    updateFades(deltaTimeMs: number) {
        if (this.loadedPrefabs.size === 0 || deltaTimeMs <= 0) return;

        const prefabsToUpdate = Array.from(this.loadedPrefabs.values());

        for (const prefab of prefabsToUpdate) {
            if (!prefab.instance || !prefab.originalScale || !prefab.originalRotation) continue;

            if (prefab.fadeState === 'in') {
                prefab.fadeProgress = Math.min(1, prefab.fadeProgress + (deltaTimeMs / this.fadeInDuration));
                const easedProgress = Utils.easeInOutCubic(prefab.fadeProgress);

                if (this.useFancyFade) {
                    if (prefab.animationParams) {
                        const { scaleOvershoot, stretchAxis, stretchAmount, rotationAxis, rotationAmount } = prefab.animationParams;

                        this.setPrefabOpacity(prefab.instance, easedProgress);

                        const overshootPoint = 0.7;
                        let overallScale: number, stretchMultiplier: number, overallRotation: number;

                        if (easedProgress < overshootPoint) {
                            const progress = Utils.easeInOutCubic(easedProgress / overshootPoint);
                            overallScale = progress * scaleOvershoot;
                            stretchMultiplier = 1 + (stretchAmount - 1) * progress;
                            overallRotation = rotationAmount * progress;
                        } else {
                            const progress = Utils.easeInOutCubic((easedProgress - overshootPoint) / (1 - overshootPoint));
                            overallScale = scaleOvershoot - (scaleOvershoot - 1) * progress;
                            stretchMultiplier = stretchAmount - (stretchAmount - 1) * progress;
                            overallRotation = rotationAmount - rotationAmount * progress;
                        }

                        const finalScale = new Vector3().copy(prefab.originalScale).multiplyScalar(overallScale);
                        const stretchVec = new Vector3(
                            (stretchAxis.x !== 0) ? stretchMultiplier : 1,
                            (stretchAxis.y !== 0) ? stretchMultiplier : 1,
                            (stretchAxis.z !== 0) ? stretchMultiplier : 1
                        );
                        finalScale.multiply(stretchVec);
                        prefab.instance.scale.copy(finalScale);

                        const q = new THREE.Quaternion().setFromAxisAngle(rotationAxis, overallRotation);
                        prefab.instance.quaternion.setFromEuler(prefab.originalRotation).multiply(q);

                    } else { // Fallback to old animation
                        this.setPrefabOpacity(prefab.instance, easedProgress);
                        const scale = 0.8 + (0.2 * easedProgress);
                        prefab.instance.scale.copy(prefab.originalScale).multiplyScalar(scale);
                    }
                } else {
                    this.setPrefabOpacity(prefab.instance, easedProgress);
                }

                if (prefab.fadeProgress >= 1) {
                    prefab.fadeState = 'visible';
                    prefab.instance.scale.copy(prefab.originalScale);
                    prefab.instance.rotation.copy(prefab.originalRotation);
                    this.setPrefabOpacity(prefab.instance, 1);
                }
            } else if (prefab.fadeState === 'out') {
                prefab.fadeProgress = Math.min(1, prefab.fadeProgress + (deltaTimeMs / this.fadeOutDuration));
                const easedProgress = Utils.easeInOutCubic(prefab.fadeProgress);

                if (this.useFancyFade) {
                    if (prefab.animationParams) {
                        const { scaleOvershoot, stretchAxis, stretchAmount, rotationAxis, rotationAmount } = prefab.animationParams;

                        this.setPrefabOpacity(prefab.instance, 1.0 - easedProgress);

                        const exaggerationPoint = 0.4;
                        let overallScale: number, stretchMultiplier: number, overallRotation: number;

                        if (easedProgress < exaggerationPoint) {
                            const progress = Utils.easeInOutCubic(easedProgress / exaggerationPoint);
                            overallScale = 1 + (scaleOvershoot - 1) * progress;
                            stretchMultiplier = 1 + (stretchAmount - 1) * progress;
                            overallRotation = rotationAmount * progress;
                        } else {
                            const progress = Utils.easeInOutCubic((easedProgress - exaggerationPoint) / (1 - exaggerationPoint));
                            overallScale = scaleOvershoot * (1 - progress);
                            stretchMultiplier = stretchAmount * (1 - progress);
                            overallRotation = rotationAmount * (1 - progress);
                        }

                        const finalScale = new Vector3().copy(prefab.originalScale).multiplyScalar(overallScale);
                        const stretchVec = new Vector3(
                            (stretchAxis.x !== 0) ? stretchMultiplier : 1,
                            (stretchAxis.y !== 0) ? stretchMultiplier : 1,
                            (stretchAxis.z !== 0) ? stretchMultiplier : 1
                        );
                        finalScale.multiply(stretchVec);
                        prefab.instance.scale.copy(finalScale);

                        const q = new THREE.Quaternion().setFromAxisAngle(rotationAxis, overallRotation);
                        prefab.instance.quaternion.setFromEuler(prefab.originalRotation).multiply(q);

                    } else { // Fallback to old animation
                        this.setPrefabOpacity(prefab.instance, 1.0 - easedProgress);
                        const scale = 1.0 - (0.2 * easedProgress);
                        prefab.instance.scale.copy(prefab.originalScale).multiplyScalar(scale);
                    }
                } else {
                    this.setPrefabOpacity(prefab.instance, 1.0 - easedProgress);
                }

                if (prefab.fadeProgress >= 1) {
                    this._destroyPrefab(prefab);
                }
            }
        }
    }

    private populateQueues() {
        if (!this.target) return;

        const targetPosition = this.target.position;
        const queryRadius = this.maxRenderDistance * this.unloadDistanceMultiplier;

        this.querySphere.center.copy(targetPosition);
        this.querySphere.radius = queryRadius;

        // Find all prefabs within the maximum possible range
        const nearbyPoints = this.octree.query(this.querySphere);
        const nearbyPrefabIDs = new Set(nearbyPoints.map(p => p.data.id));

        // Queue for unloading: Check currently loaded prefabs
        for (const loadedPrefab of this.loadedPrefabs.values()) {
            // Do not queue for unloading if it's already fading out
            if (loadedPrefab.fadeState === 'out') continue;

            const distanceSq = targetPosition.distanceToSquared(loadedPrefab.position);
            if (distanceSq > loadedPrefab.unloadDistanceSq || !nearbyPrefabIDs.has(loadedPrefab.id)) {
                if (!this.unloadQueue.includes(loadedPrefab)) {
                    this.unloadQueue.push(loadedPrefab);
                }
            }
        }

        // Queue for loading: Check prefabs returned by the broad query
        for (const point of nearbyPoints) {
            const prefab = point.data;
            // Check if it's not loaded and not already in the queue
            if (!prefab.isLoaded && !this.loadQueue.find(p => p.id === prefab.id)) {
                const distanceSq = targetPosition.distanceToSquared(prefab.position);
                if (distanceSq <= prefab.loadDistanceSq) {
                    // Higher priority for closer objects
                    prefab.priority = 1 / (distanceSq + 1);
                    this.loadQueue.push(prefab);
                }
            }
        }

        // Sort the load queue by priority so closer objects load first
        this.loadQueue.sort((a, b) => b.priority - a.priority);
    }

    private processQueues() {
        this.isProcessingQueues = true;

        // Unload as many as possible within the frame budget
        while (this.unloadQueue.length > 0) {
            const prefabToUnload = this.unloadQueue.shift();
            if (prefabToUnload) {
                this.unload(prefabToUnload);
            }
        }

        // Load prefabs up to the concurrent limit
        while (this.loadQueue.length > 0 && this.currentlyLoadingCount < this.maxConcurrentLoads) {
            const prefabToLoad = this.loadQueue.shift();
            if (prefabToLoad) {
                this.load(prefabToLoad);
            }
        }

        this.isProcessingQueues = false;
    }

    private async load(prefab: StreamablePrefab) {
        if (prefab.isLoaded) return;

        this.currentlyLoadingCount++;
        prefab.isLoaded = true; // Mark as loaded to prevent re-queueing

        let parentFolder: THREE.Object3D | undefined;
        if (prefab.folder) {
            if (this.folders.has(prefab.folder)) {
                parentFolder = this.folders.get(prefab.folder);
            } else {
                parentFolder = new THREE.Object3D();
                parentFolder.name = prefab.folder;
                RE.Runtime.scene.add(parentFolder);
                this.folders.set(prefab.folder, parentFolder);
            }
        }

        if (this.enableLogging) {
            Logger.log(`PrefabStreamer: Loading prefab: ${prefab.path}`);
        }

        try {
            const instance = await Prefab.instantiate(prefab.path, { position: prefab.position });
            if (instance) {
                prefab.instance = instance;
                prefab.originalScale = instance.scale.clone();
                prefab.originalRotation = instance.rotation.clone();

                if (parentFolder) {
                    parentFolder.add(instance);
                }
                
                this.setPrefabOpacity(instance, 0);
                prefab.fadeState = 'in';
                prefab.fadeProgress = 0;
                prefab.animationParams = this.generateRandomAnimationParams();

                this.loadedPrefabs.set(prefab.id, prefab);
            } else {
                prefab.isLoaded = false; // Reset if instantiation failed
                this.prefabs.delete(prefab.id);
                if (this.enableLogging) {
                    Logger.error(`PrefabStreamer: Failed to instantiate prefab: ${prefab.path}`)
                }
            }
        } catch (error) {
            prefab.isLoaded = false;
            this.prefabs.delete(prefab.id);
            Logger.error(`PrefabStreamer: Error during prefab instantiation: ${prefab.path}`, error);
        } finally {
            this.currentlyLoadingCount--;
            if (!this.isProcessingQueues) {
                this.processQueues();
            }
        }
    }

    private unload(prefab: StreamablePrefab) {
        // This method no longer destroys the object. It just triggers the fade-out state.
        if (!prefab.isLoaded || !prefab.instance || prefab.fadeState === 'out') return;

        if (this.enableLogging) {
            Logger.log(`PrefabStreamer: Fading out prefab: ${prefab.path}`);
        }

        prefab.fadeState = 'out';
        prefab.fadeProgress = 0;
        prefab.animationParams = this.generateRandomAnimationParams();
    }

    private _destroyPrefab(prefab: StreamablePrefab) {
        if (!prefab.instance) return;

        if (this.enableLogging) {
            Logger.log(`PrefabStreamer: Unloading prefab: ${prefab.path}`);
        }
        const parentFolder = prefab.instance.parent;

        // Restore materials to their original state before destroying the object
        this.restorePrefabOpacity(prefab.instance);

        Prefab.destroy(prefab.instance);
        prefab.instance = undefined;
        prefab.isLoaded = false;
        this.loadedPrefabs.delete(prefab.id);

        if (parentFolder && parentFolder.children.length === 0) {
            const folderName = parentFolder.name;
            if (this.folders.has(folderName)) {
                this.folders.delete(folderName);
                Scene.destroy(parentFolder);
                if (this.enableLogging) {
                    Logger.log(`PrefabStreamer: Removed empty folder: ${folderName}`);
                }
            }
        }
    }

    private setPrefabOpacity(instance: THREE.Object3D, opacity: number): void {
        instance.traverse(child => {
            if (child instanceof THREE.Mesh) {
                const material = child.material;
                if (Array.isArray(material)) {
                    material.forEach(m => this.setMaterialFade(m, opacity));
                } else if (material) {
                    this.setMaterialFade(material, opacity);
                }
            }
        });
    }

    private setMaterialFade(material: any, opacity: number): void {
        // Use a unique key to avoid conflicts with other scripts
        if (material.userData._fade_originalOpacity === undefined) {
            material.userData._fade_originalOpacity = material.opacity;
            material.userData._fade_wasTransparent = material.transparent;
        }
        material.transparent = true;
        material.opacity = opacity;
    }

    private restorePrefabOpacity(instance: THREE.Object3D): void {
        instance.traverse(child => {
            if (child instanceof THREE.Mesh) {
                const material = child.material;
                if (Array.isArray(material)) {
                    material.forEach(m => this.restoreMaterial(m));
                } else if (material) {
                    this.restoreMaterial(material);
                }
            }
        });
    }

    private restoreMaterial(material: any): void {
        if (material.userData._fade_originalOpacity !== undefined) {
            material.opacity = material.userData._fade_originalOpacity;
            material.transparent = material.userData._fade_wasTransparent;
            delete material.userData._fade_originalOpacity;
            delete material.userData._fade_wasTransparent;
        }
    }


}