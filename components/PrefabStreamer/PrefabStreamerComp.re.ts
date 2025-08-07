import * as RE from 'rogue-engine';
import { Prefab, PrefabStreamer } from "../../modules/Prefab";
import { Scene } from "../../modules/Scene"
import { Object3D, Vector3, Camera, Box3 } from 'three';
import { Logger } from "../../modules/Logger";
import MATE from '../../mate';
import { docs } from './PrefabStreamer.docs';

@RE.registerComponent
export default class PrefabStreamerComp extends RE.Component {
    @RE.props.button() showDocs() { MATE.docmaker.open(docs); }
    showDocsLabel = "📖 Documentation"

    public streamer: PrefabStreamer;

    @RE.props.text()
    public streamingFolderPath: string = "Streamer/";

    @RE.props.text()
    public targetObjects: string = "ThirdPersonCharacter";

    @RE.props.num()
    public defaultRenderDistance: number = 2000;

    @RE.props.num(0, 5000)
    public fadeInDurationMs: number = 500;

    @RE.props.num(0, 5000)
    public fadeOutDurationMs: number = 500;

    @RE.props.num(0, 1000)
    public updateIntervalMs: number = 250; // How often to check for prefabs (in ms)

    @RE.props.vector3()
    public worldSize: Vector3 = new Vector3(100000, 100000, 100000);

    @RE.props.checkbox()
    public enableLogging: boolean = true;

    awake() {
        const halfSize = this.worldSize.clone().multiplyScalar(0.5);
        const worldBounds = new Box3(
            new Vector3().copy(halfSize).negate(),
            halfSize
        );
        this.streamer = new PrefabStreamer({
            target: null, // Will be found in the first update.
            worldBounds,
            octreeCapacity: 8,
            enableLogging: this.enableLogging,
            updateInterval: this.updateIntervalMs,
            fadeInDuration: this.fadeInDurationMs,
            fadeOutDuration: this.fadeOutDurationMs,
        });

    }

    start() {
        this.loadPrefabsFromFolder();
    }

    async loadPrefabsFromFolder() {
        const prefabPaths = Prefab.getAllPaths(this.streamingFolderPath);

        if (prefabPaths.length === 0) {
            if (this.enableLogging) {
                Logger.warn(`PrefabStreamer: No prefabs found in ${this.streamingFolderPath}`);
            }
            return;
        }

        if (this.enableLogging) {
            Logger.group("PrefabStreamer: Initializing...");
            Logger.log(`Found ${prefabPaths.length} prefabs in ${this.streamingFolderPath}:`);
        }

        for (const path of prefabPaths) {
            const pathSegments = path.split('/').filter(segment => segment.length > 0);
            let folderName: string | undefined;

            if (pathSegments.length > 2) {
                folderName = pathSegments[pathSegments.length - 2];
            }

            const options = {
                id: path,
                path: path,
                renderDistance: this.defaultRenderDistance,
                folder: folderName
            };

            this.streamer.add(options);

            if (this.enableLogging) {
                if (folderName) {
                    Logger.log(`  - ${path}  (Folder: ${folderName})`);
                } else {
                    Logger.log(`  - ${path}`);
                }
            }
        }
        if (this.enableLogging) {
            Logger.groupEnd();
        }
    }

    update() {
        if (!this.streamer) return;

        // Check if current target is valid (still in the scene graph)
        if (!this.streamer.target || !this.streamer.target.parent) {
            const newTarget = this.findTarget();
            if (newTarget && this.streamer.target !== newTarget) {
                this.streamer.target = newTarget;
                if (this.enableLogging) {
                    Logger.log(`PrefabStreamer: Target acquired: "${newTarget.name}".`);
                }
            } else if (!newTarget && this.streamer.target) {
                // Target was lost and no new one was found
                this.streamer.target = null;
                if (this.enableLogging) {
                    Logger.warn("PrefabStreamer: Target lost. Searching for a new one on next update...");
                }
            }
        }

        // The streamer's update method will now handle the null target case
        // Update distance checks at the specified interval
        this.streamer.updateDistanceChecks();
        // Update fade animations every frame for smoothness
        this.streamer.updateFades(RE.Runtime.deltaTime * 1000); // Pass delta time in ms
    }

    private findTarget(): Object3D | null {
        if (this.targetObjects) {
            const names = this.targetObjects.split(',').map(name => name.trim()).filter(name => name);
            for (const name of names) {
                const target = Scene.findObjectByName(name);
                if (target) {
                    if (this.enableLogging) {
                        Logger.log(`PrefabStreamer: Found target object: "${name}"`);
                    }
                    return target;
                }
            }
        }

        // Fallback to camera if no named targets are provided or found.
        let cameraTarget = RE.Runtime.camera;
        if (!cameraTarget) {
            cameraTarget = Scene.findObject({ predicate: (obj) => obj instanceof Camera }) as Camera;
        }

        if (cameraTarget) {
            if (this.enableLogging) {
                Logger.log("PrefabStreamer: No named target found. Falling back to scene camera.");
            }
            return cameraTarget;
        }

        if (this.enableLogging) {
            Logger.warn(`PrefabStreamer: Could not find any target objects or a camera in the scene.`);
        }
        return null;
    }

    // Overload signatures for the add method
    add(id: string): void;
    add(id: string, renderDistance: number): void;
    add(id: string, renderDistance: number, position: Vector3): void;
    add(id: string, path: string, renderDistance: number): void;
    add(id: string, path: string, renderDistance: number, position: Vector3): void;
    add(options: { id: string; path?: string; renderDistance: number; position?: Vector3; folder?: string }): void;

    // Implementation of the add method
    add(
        arg1: string | { id: string; path?: string; renderDistance: number; position?: Vector3, folder?: string },
        arg2?: number | string,
        arg3?: number | Vector3,
        arg4?: Vector3
    ): void {
        if (!this.streamer) {
            Logger.error("PrefabStreamer is not initialized.");
            return;
        }

        if (typeof arg1 === 'object') {
            // Handle the options object signature
            this.streamer.add(arg1);
            return;
        }

        // Handle string-based signatures
        const options: { id: string; path?: string; renderDistance: number; position?: Vector3, folder?: string } = {
            id: arg1,
            renderDistance: this.defaultRenderDistance, // Default value
        };

        if (typeof arg2 === 'number') {
            // add(id, renderDistance, position?)
            options.renderDistance = arg2;
            options.position = arg3 as Vector3;
        } else if (typeof arg2 === 'string') {
            // add(id, path, renderDistance, position?)
            options.path = arg2;
            if (typeof arg3 === 'number') {
                options.renderDistance = arg3;
                options.position = arg4;
            } else {
                 Logger.error("PrefabStreamer: Invalid arguments for add(). Path must be followed by a renderDistance.");
                 return;
            }
        } else if (arg2 !== undefined) {
            Logger.error("PrefabStreamer: Invalid arguments for add().");
            return;
        }

        this.streamer.add(options);
    }


    /**
     * Removes a prefab from the streaming system using its unique ID.
     * @param id The unique identifier of the prefab to remove.
     */
    remove(id: string) {
        if (!this.streamer) return;
        this.streamer.remove(id);
    }
}
