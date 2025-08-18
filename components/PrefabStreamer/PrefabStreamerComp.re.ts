import * as RE from 'rogue-engine';
import { Prefab, PrefabStreamer } from "../../modules/Prefab";
import { Scene } from "../../modules/Scene"
import { Object3D, Vector3, Camera, Box3 } from 'three';
import { Logger } from "../../modules/Logger";
import { rogueEditorAPI } from "../../modules/RogueEditorAPI";
import { DOM } from "../../modules/DOM";
import MATE from '../../mate';

@RE.registerComponent
export default class PrefabStreamerComp extends RE.Component {

    public docs = `# PrefabStreamer
## Description
The \`PrefabStreamerComp\` efficiently manages prefab instances in the scene. It automatically loads prefabs when the target enters their specified \`renderDistance\` and unloads them when the target moves away. The primary way to use the streamer is by pointing it to a folder. It will automatically find all prefabs within that folder and its subdirectories, organizing them based on their folder structure. This makes it incredibly easy to manage large collections of environmental Prefabs, dungeons, or points of interest.
`;

    @RE.props.button() showDocs() {
        MATE.docmaker.open(this.docs);
    }
    showDocsLabel = "📖 Documentation"


    @RE.props.button()
    openPrefabSettings() {
        if (this.menu) {
            this.menu.element.focus();
            return;
        }

        if (!RE.Runtime.isRunning) {
            MATE.ui.notify("Prefab settings can only be accessed during runtime.", { backgroundColor: "#ffc107", textColor: "#000" });
            return;
        }
        this.createPrefabSettingsUI();
    }
    openPrefabSettingsLabel = "⚙️ Prefab Settings";

    @RE.props.button()
    cachePrefabPositions() {
        if (!RE.Runtime.isRunning) {
            MATE.ui.notify("Caching can only be done during runtime.", { backgroundColor: "#ffc107", textColor: "#000" });
            return;
        }
        this.cacheAndSavePrefabPositions();
    }
    cachePrefabPositionsLabel = "💾 Cache Prefab Positions";

    public streamer: PrefabStreamer;

    @RE.props.group("General", false)
    @RE.props.text()
    public streamingFolderPath: string = "Streamer/";
    @RE.props.text()
    public targetObjects: string = "ThirdPersonCharacter";
    @RE.props.num()
    public defaultRenderDistance: number = 2000;
    @RE.props.checkbox()
    public enableLogging: boolean = true;


    @RE.props.group("Perfomance & Octree", false)
    @RE.props.num()
    public maxConcurrentLoads: number = 3;
    @RE.props.num(0, 1000)
    public updateIntervalMs: number = 250;
    @RE.props.vector3()
    public worldSize: Vector3 = new Vector3(100000, 100000, 100000);
    @RE.props.num()
    public octreeLevel: number = 4;

    
    @RE.props.group("Appearance")
    @RE.props.checkbox()
    public useFancyFade: boolean = true;
    @RE.props.num(0, 5000)
    public fadeInDurationMs: number = 500;
    @RE.props.num(0, 5000)
    public fadeOutDurationMs: number = 500;


    private menu: any = null;


    private prefabsConfig: { [path: string]: number } = {};
    private positionsConfig: { [path: string]: { x: number, y: number, z: number } } = {};
    private renderConfigPath = "PrefabStreamer/prefabsConfig.json";
    private positionsConfigPath = "PrefabStreamer/prefabsPositions.json";

    private async loadConfigs() {
        const renderConfigUrl = RE.getStaticPath(this.renderConfigPath);
        if (renderConfigUrl) {
            try {
                const response = await fetch(renderConfigUrl);
                if (response.ok) {
                    this.prefabsConfig = await response.json();
                    if (this.enableLogging) Logger.log("PrefabStreamer: Successfully loaded custom prefab configs.");
                }
            } catch (e) {
                Logger.error("PrefabStreamer: Failed to fetch or parse render config:", e);
            }
        }

        const positionsConfigUrl = RE.getStaticPath(this.positionsConfigPath);
        if (positionsConfigUrl) {
            try {
                const response = await fetch(positionsConfigUrl);
                if (response.ok) {
                    this.positionsConfig = await response.json();
                    if (this.enableLogging) Logger.log("PrefabStreamer: Successfully loaded cached prefab positions.");
                }
            } catch (e) {
                Logger.error("PrefabStreamer: Failed to fetch or parse positions config:", e);
            }
        }
    }

    private async savePrefabConfig() {
        try {
            await rogueEditorAPI.createFile("/Static/" + this.renderConfigPath, JSON.stringify(this.prefabsConfig, null, 2));
            MATE.ui.notify("Prefab settings saved!", { backgroundColor: "#28a745" });

            for (const path in this.prefabsConfig) {
                this.streamer.updateRenderDistance(path, this.prefabsConfig[path]);
            }

        } catch (e) {
            MATE.ui.notify("Error saving settings.", { backgroundColor: "#dc3545" });
            Logger.error("Failed to save prefab config:", e);
        }
    }

    private async cacheAndSavePrefabPositions() {
        MATE.ui.notify("Caching prefab positions... This may take a moment.", { backgroundColor: "#007bff" });
        const positions: { [path: string]: { x: number, y: number, z: number } } = {};
        const prefabPaths = Prefab.getAllPaths(this.streamingFolderPath);

        for (const path of prefabPaths) {
            const tempInstance = await Prefab.instantiate(path);
            if (tempInstance) {
                positions[path] = { x: tempInstance.position.x, y: tempInstance.position.y, z: tempInstance.position.z };
                Prefab.destroy(tempInstance);
            }
        }

        try {
            await rogueEditorAPI.createFile("/Static/" + this.positionsConfigPath, JSON.stringify(positions, null, 2));
            MATE.ui.notify("Prefab positions cached successfully!", { backgroundColor: "#28a745" });
            this.positionsConfig = positions;
        } catch (e) {
            MATE.ui.notify("Error caching positions.", { backgroundColor: "#dc3545" });
            Logger.error("Failed to save positions config:", e);
        }
    }

    private createPrefabSettingsUI() {
        this.menu = new MATE.ui.Window({
            id: 'prefab-settings-window',
            title: 'Prefab Render Distances',
            resizable: true,
            collapsible: true,
            initialPosition: { top: '50%', left: '50%' },
            style: { transform: 'translate(-50%, -50%)' },
            onClose: () => this.menu = null
        });

        const prefabPaths = Prefab.getAllPaths(this.streamingFolderPath);

        prefabPaths.forEach(path => {
            const prefabName = path.split('/').pop()?.replace('.roguePrefab', '') || 'Unknown';
            
            const row = DOM.create('div', {
                parent: this.menu.content,
                style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }
            });

            new MATE.ui.Label({ parent: row, text: prefabName, style: { color: '#ccc' } });

            const input = new MATE.ui.TextInput({
                parent: row,
                onInput: (value) => {
                    const distance = parseInt(value, 10);
                    if (!isNaN(distance)) {
                        this.prefabsConfig[path] = distance;
                    }
                }
            });
            input.setValue(String(this.prefabsConfig[path] || this.defaultRenderDistance));
        });

        new MATE.ui.Button({
            parent: this.menu.content,
            text: 'Save Settings',
            onClick: () => this.savePrefabConfig()
        });
    }

    awake() {
        const halfSize = this.worldSize.clone().multiplyScalar(0.5);
        const worldBounds = new Box3(
            new Vector3().copy(halfSize).negate(),
            halfSize
        );
        this.streamer = new PrefabStreamer({
            target: null,
            worldBounds,
            octreeCapacity: this.octreeLevel,
            enableLogging: this.enableLogging,
            updateInterval: this.updateIntervalMs,
            fadeInDuration: this.fadeInDurationMs,
            fadeOutDuration: this.fadeOutDurationMs,
            maxConcurrentLoads: this.maxConcurrentLoads,
            useFancyFade: this.useFancyFade
        });
    }

    async start() {
        await this.loadConfigs();
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

            const renderDistance = this.prefabsConfig[path] || this.defaultRenderDistance;
            const positionData = this.positionsConfig[path];
            const position = positionData ? new Vector3(positionData.x, positionData.y, positionData.z) : undefined;

            const options = {
                id: path,
                path: path,
                renderDistance: renderDistance,
                folder: folderName,
                position: position
            };

            this.streamer.add(options);

            if (this.enableLogging) {
                if (folderName) {
                    Logger.log(`  - ${path} (Render Distance: ${renderDistance}) (Folder: ${folderName})`);
                } else {
                    Logger.log(`  - ${path} (Render Distance: ${renderDistance})`);
                }
            }
        }
        if (this.enableLogging) {
            Logger.groupEnd();
        }
    }

    update() {
        if (!this.streamer) return;

        if (!this.streamer.target || !this.streamer.target.parent) {
            const newTarget = this.findTarget();
            if (newTarget && this.streamer.target !== newTarget) {
                this.streamer.target = newTarget;
                if (this.enableLogging) {
                    Logger.log(`PrefabStreamer: Target acquired: "${newTarget.name}".`);
                }
            } else if (!newTarget && this.streamer.target) {
                this.streamer.target = null;
                if (this.enableLogging) {
                    Logger.warn("PrefabStreamer: Target lost. Searching for a new one on next update...");
                }
            }
        }

        this.streamer.updateDistanceChecks();
        this.streamer.updateFades(RE.Runtime.deltaTime * 1000);


      
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

    add(options: { id: string; path?: string; renderDistance: number; position?: Vector3; folder?: string }): void {
        if (!this.streamer) {
            Logger.error("PrefabStreamer is not initialized.");
            return;
        }
        this.streamer.add(options);
    }

    remove(id: string) {
        if (!this.streamer) return;
        this.streamer.remove(id);
    }
}