import * as RE from 'rogue-engine';
import * as THREE from 'three';
import { Logger } from './Logger';
import { Scene } from './Scene';
import { AssetManager } from './AssetManager';
import { Prefab } from './Prefab';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Utils } from './Utils';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

/**
 * A simplified interface based on Rogue Engine's internal ComponentInterface.
 * This is used by the Debug Inspector to create appropriate UI controls.
 */
interface REComponentInterface {
    [propName: string]: "String" | "Number" | "Boolean" | "Vector3" | "Vector2" | "Select" | "Object3D" | "Prefab" | "Texture" | "Material" | "Color" | "Audio" | "PositionalAudio";
}

declare global {
    interface Window {
        performance: Performance;
    }

    interface Performance {
        memory?: {
            totalJSHeapSize: number;
            usedJSHeapSize: number;
            jsHeapSizeLimit: number;
        };
    }
}

export class Debug {
    private static initialized: boolean = false;
    private static mainDebugContainer: HTMLDivElement; // Overall container for left and right panels
    private static fpsElement: HTMLDivElement; // Independent FPS display (top-right)
    private static customTextElement: HTMLDivElement; // Independent custom text display (top-right, below FPS)

    // Left-aligned Scene Graph Panel and its controls
    private static sceneGraphPanel: HTMLDivElement;
    private static sceneGraphContainer: HTMLDivElement;
    private static sceneGraphControlsContainer: HTMLDivElement;
    private static sceneGraphListContainer: HTMLDivElement;

    // Right-aligned Stats Panels
    private static statsColumnContainer: HTMLDivElement;
    private static sceneObjectsStatsElement: HTMLDivElement;
    private static rendererInfoElement: HTMLDivElement;
    private static memoryInfoElement: HTMLDivElement;
    private static executionTimeInfoElement: HTMLDivElement;
    private static cameraStatsElement: HTMLDivElement;
    private static inspectorPanel: HTMLDivElement;
    private static prefabPanel: HTMLDivElement;

    // Global Buttons (positioned below scene graph)
    private static globalButtonContainer: HTMLDivElement;

    private static lastFrameTime: number = 0;
    private static frameCount: number = 0;
    private static fps: number = 0;
    private static frameData: { deltaTime: number, timestamp: number }[] = [];
    private static lastUpdateTime: number = 0;
    private static boundingBoxHelpers: Map<THREE.Object3D, THREE.BoxHelper> = new Map();
    private static axesHelpers: Map<THREE.Object3D, THREE.AxesHelper> = new Map();
    private static renderer: THREE.WebGLRenderer;
    private static wireframeEnabled: boolean = false;
    private static originalWireframeState: Map<THREE.Material, boolean> = new Map();

    private static debugUIEnabled: boolean = true;
    private static lastSceneGraphUpdateTime: number = 0;
    private static expandedNodes: Set<string> = new Set();
    private static currentSortBy: 'vertices' | 'faces' | 'name' = 'name';
    private static currentFilter: string = '';

    // New: Selected object for actions
    private static selectedObjectUuid: string | null = null;
    private static transformControls: TransformControls | null = null;
    private static originalCamera: THREE.Camera | null = null;
    private static debugCameraControls: OrbitControls | null = null;
    private static isTransforming: boolean = false;

    private static positionInputs: { x: HTMLInputElement, y: HTMLInputElement, z: HTMLInputElement } | null = null;
    private static rotationInputs: { x: HTMLInputElement, y: HTMLInputElement, z: HTMLInputElement } | null = null;
    private static scaleInputs: { x: HTMLInputElement, y: HTMLInputElement, z: HTMLInputElement } | null = null;

    private static formatNumber(num: number): string {
        return num.toLocaleString();
    }

    public static init(createCamera: boolean = false) {
        if (this.initialized) {
            Logger.warn("Debug module already initialized.", "Debug");
            return;
        }

        if (createCamera) {
            this.setupDebugCamera();
        }

        this.setupDebugUI();
        this.setupGlobalKeyListener();

        if (RE.Runtime.renderer instanceof THREE.WebGLRenderer) {
            this.renderer = RE.Runtime.renderer;
        } else {
            Logger.warn("Could not get WebGLRenderer instance from RE.Runtime.renderer.", "Debug");
        }

        RE.onBeforeUpdate(() => {
            // If a debug camera is active, ensure it remains the runtime camera.
            // This prevents other camera controllers from taking over.
            if (this.debugCameraControls) {
                const debugCam = RE.Runtime.scene.getObjectByName("DebugCamera");
                if (debugCam && debugCam instanceof THREE.Camera && RE.Runtime.camera !== debugCam) {
                    RE.Runtime.camera = debugCam;
                }
                this.debugCameraControls.update();
            }

            // The rest of the UI updates should only happen if the UI is enabled.
            if (!this.debugUIEnabled) {
                return;
            }

            const now = performance.now();
            const deltaTime = now - this.lastUpdateTime;
            this.lastUpdateTime = now;
            this.frameData.push({ deltaTime, timestamp: now });

            this.updateFPS();
            this.updateExecutionTimes();
            this.updateSceneStats();
            this.updateCameraStats();
            this.updateSceneGraph();
        });

        RE.Runtime.onStop(() => {
            this.mainDebugContainer.remove();
            this.fpsElement.remove();
            this.customTextElement.remove();
            this.deselectObject();

            if (this.debugCameraControls) {
                this.debugCameraControls.dispose();
                this.debugCameraControls = null;
                const debugCam = RE.Runtime.scene.getObjectByName("DebugCamera");

                // Restore the original camera
                if (this.originalCamera) {
                    RE.Runtime.camera = this.originalCamera;
                    this.originalCamera = null;
                }

                if (debugCam) debugCam.removeFromParent();
            }

            this.clearAllHelpers();
            this.removeGlobalKeyListener();
            this.initialized = false;
            Logger.log("Debug module stopped and cleaned up.", "Debug");
        });

        this.initialized = true;
        Logger.log("Debug module initialized.", "Debug");
    }

    private static setupDebugCamera() {
        if (!RE.Runtime.rogueDOMContainer) {
            Logger.warn("Cannot create DebugCamera: rogueDOMContainer not available.", "Debug");
            return;
        }

        // Store the original camera before creating the debug one
        if (RE.Runtime.camera) {
            this.originalCamera = RE.Runtime.camera;
        }

        const aspect = window.innerWidth / window.innerHeight;
        const debugCamera = new THREE.PerspectiveCamera(75, aspect, 0.1, 10000);
        debugCamera.name = "DebugCamera";
        debugCamera.position.set(15, 15, 15);
        debugCamera.lookAt(0, 0, 0);

        RE.Runtime.scene.add(debugCamera);
        RE.Runtime.camera = debugCamera; // Set as the active camera

        this.debugCameraControls = new OrbitControls(debugCamera, RE.Runtime.rogueDOMContainer);
        this.debugCameraControls.enableDamping = true;
        this.debugCameraControls.dampingFactor = 0.05;

        Logger.log("DebugCamera created and set as active camera.", "Debug");
    }

    private static setupDebugUI() {
        // --- Setup for FPS and Custom Text elements (top-right, independent) ---
        const createSmallInfoPanel = (top: string, initialText: string = ''): HTMLDivElement => {
            const panel = document.createElement('div');
            panel.style.position = 'absolute';
            panel.style.top = top;
            panel.style.right = '10px';
            panel.style.color = '#E0E0E0';
            panel.style.backgroundColor = 'rgba(0,0,0,.4)';
            panel.style.padding = '5px 10px';
            panel.style.fontFamily = 'monospace';
            panel.style.fontSize = '13px';
            panel.style.borderRadius = '4px';
            panel.style.border = '1px solid rgba(255,255,255,.2)';
            panel.style.boxShadow = '0 1px 5px rgba(0, 0, 0, .4)';
            panel.style.zIndex = '9999';
            panel.style.whiteSpace = 'nowrap';
            panel.innerText = initialText;
            document.body.appendChild(panel);
            return panel;
        };

        this.fpsElement = createSmallInfoPanel('10px', 'FPS: 0');
        this.customTextElement = createSmallInfoPanel('45px', '');

        // --- Main Debug Container (holds left and right panels) ---
        this.mainDebugContainer = document.createElement('div');
        this.mainDebugContainer.style.position = 'absolute';
        this.mainDebugContainer.style.top = '10px';
        this.mainDebugContainer.style.left = '10px';
        this.mainDebugContainer.style.display = 'flex'; // Flex row for left and right panels
        this.mainDebugContainer.style.gap = '15px'; // Space between left and right columns
        this.mainDebugContainer.style.zIndex = '9999';
        this.mainDebugContainer.style.height = 'calc(100vh - 20px)'; // Take full vertical space
        this.mainDebugContainer.style.maxWidth = 'calc(100vw - 20px)'; // Max width to avoid horizontal scroll
        document.body.appendChild(this.mainDebugContainer);
 
        // --- Left Panel: Scene Graph and Global Buttons ---
        this.sceneGraphPanel = document.createElement('div');
        this.sceneGraphPanel.style.display = 'flex';
        this.sceneGraphPanel.style.flexDirection = 'column';
        this.sceneGraphPanel.style.flexBasis = '300px'; // Fixed width for scene graph
        this.sceneGraphPanel.style.flexShrink = '0';
        this.sceneGraphPanel.style.gap = '10px'; // Space between scene graph and buttons
        this.mainDebugContainer.appendChild(this.sceneGraphPanel);

        // --- Middle Panel: Inspector ---
        this.inspectorPanel = document.createElement('div');
        this.inspectorPanel.style.color = '#E0E0E0';
        this.inspectorPanel.style.backgroundColor = 'rgba(0,0,0,.5)';
        this.inspectorPanel.style.padding = '8px 12px';
        this.inspectorPanel.style.borderRadius = '6px';
        this.inspectorPanel.style.border = '1px solid rgba(255,255,255,.25)';
        this.inspectorPanel.style.flexBasis = '350px';
        this.inspectorPanel.style.flexShrink = '0';
        this.inspectorPanel.style.overflowY = 'auto';
        this.inspectorPanel.style.display = 'none'; // Initially hidden
        this.mainDebugContainer.appendChild(this.inspectorPanel);

        // Scene Graph Container Element
        this.sceneGraphContainer = document.createElement('div');
        this.sceneGraphContainer.style.color = '#E0E0E0';
        this.sceneGraphContainer.style.backgroundColor = 'rgba(0,0,0,.5)';
        this.sceneGraphContainer.style.padding = '8px 12px';
        this.sceneGraphContainer.style.fontFamily = 'monospace';
        this.sceneGraphContainer.style.fontSize = '14px';
        this.sceneGraphContainer.style.borderRadius = '6px';
        this.sceneGraphContainer.style.border = '1px solid rgba(255,255,255,.25)';
        this.sceneGraphContainer.style.boxShadow = '0 2px 10px rgba(0, 0, 0, .6)';
        this.sceneGraphContainer.style.lineHeight = '1.4';
        this.sceneGraphContainer.style.textAlign = 'left';
        this.sceneGraphContainer.style.flexGrow = '1'; // Allow it to fill available height
        this.sceneGraphContainer.style.display = 'flex';
        this.sceneGraphContainer.style.flexDirection = 'column';
        this.sceneGraphContainer.style.overflow = 'hidden'; // Hide overflow from container
        this.sceneGraphPanel.appendChild(this.sceneGraphContainer);

        // Scene Graph Controls Container (moved to top)
        this.sceneGraphControlsContainer = document.createElement('div');
        this.sceneGraphControlsContainer.style.display = 'flex';
        this.sceneGraphControlsContainer.style.flexWrap = 'wrap';
        this.sceneGraphControlsContainer.style.gap = '5px';
        this.sceneGraphControlsContainer.style.marginTop = '10px';
        this.sceneGraphControlsContainer.style.paddingBottom = '5px';
        this.sceneGraphControlsContainer.style.borderBottom = '1px solid rgba(255,255,255,.1)';
        this.sceneGraphContainer.appendChild(this.sceneGraphControlsContainer);

        const createSceneGraphButton = (text: string, onClick: () => void): HTMLButtonElement => {
            const button = document.createElement('button');
            button.innerText = text;
            button.style.cssText = `
                background-color: rgba(70, 70, 70, .6);
                color: #E0E0E0;
                border: 1px solid rgba(255, 255, 255, .35);
                padding: 4px 8px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
                font-family: monospace;
                transition: background-color .2s ease, border-color .2s ease, box-shadow .2s ease;
                box-shadow: 0 1px 3px rgba(0, 0, 0, .3);
            `;
            button.onmouseover = () => { button.style.backgroundColor = 'rgba(90, 90, 90, .7)'; button.style.borderColor = 'rgba(255,255,255,.6)'; button.style.boxShadow = '0 2px 5px rgba(0, 0, 0, .5)'; };
            button.onmouseout = () => { button.style.backgroundColor = 'rgba(70, 70, 70, .6)'; button.style.borderColor = 'rgba(255,255,255,.35)'; button.style.boxShadow = '0 1px 3px rgba(0, 0, 0, .3)'; };
            button.onclick = onClick;
            return button;
        };

        const sortByNameButton = createSceneGraphButton('Sort: Name', () => { this.currentSortBy = 'name'; this.updateSceneGraph(true); });
        this.sceneGraphControlsContainer.appendChild(sortByNameButton);
        const sortByVerticesButton = createSceneGraphButton('Sort: Verts', () => { this.currentSortBy = 'vertices'; this.updateSceneGraph(true); });
        this.sceneGraphControlsContainer.appendChild(sortByVerticesButton);
        const sortByFacesButton = createSceneGraphButton('Sort: Faces', () => { this.currentSortBy = 'faces'; this.updateSceneGraph(true); });
        this.sceneGraphControlsContainer.appendChild(sortByFacesButton);

        const filterNameInput = document.createElement('input');
        filterNameInput.type = 'text';
        filterNameInput.placeholder = 'Filter by name...';
        filterNameInput.style.cssText = `
            background-color: rgba(0,0,0,.4);
            color: #E0E0E0;
            border: 1px solid rgba(255,255,255,.2);
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-family: monospace;
            flex-grow: 1;
            min-width: 100px;
        `;
        filterNameInput.oninput = () => { this.currentFilter = filterNameInput.value; this.updateSceneGraph(true); };
        this.sceneGraphControlsContainer.appendChild(filterNameInput);

        // List Container
        this.sceneGraphListContainer = document.createElement('div');
        this.sceneGraphListContainer.style.overflowY = 'auto';
        this.sceneGraphListContainer.style.flexGrow = '1';
        this.sceneGraphContainer.appendChild(this.sceneGraphListContainer);

        // Global Buttons Container (below scene graph, within sceneGraphPanel)
        this.globalButtonContainer = document.createElement('div');
        this.globalButtonContainer.style.display = 'flex';
        this.globalButtonContainer.style.flexWrap = 'wrap'; // Allow buttons to wrap
        this.globalButtonContainer.style.gap = '10px';
        this.globalButtonContainer.style.justifyContent = 'center';
        this.globalButtonContainer.style.marginTop = '10px';
        this.globalButtonContainer.style.paddingTop = '10px';
        this.globalButtonContainer.style.borderTop = '1px solid rgba(255,255,255,.1)';
        this.sceneGraphPanel.appendChild(this.globalButtonContainer);

        const createButton = (text: string, onClick: () => void): HTMLButtonElement => {
            const button = document.createElement('button');
            button.innerText = text;
            button.style.cssText = `
                background-color: rgba(50, 50, 50, .6);
                color: #E0E0E0;
                border: 1px solid rgba(255, 255, 255, .35);
                padding: 6px 15px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 12px;
                font-family: monospace;
                transition: background-color .2s ease, border-color .2s ease, box-shadow .2s ease;
                box-shadow: 0 2px 5px rgba(0, 0, 0, .4);
            `;
            button.onmouseover = () => {
                button.style.backgroundColor = 'rgba(70, 70, 70, .7)';
                button.style.borderColor = 'rgba(255,255,255,.6)';
                button.style.boxShadow = '0 3px 8px rgba(0, 0, 0, .6)';
            };
            button.onmouseout = () => {
                button.style.backgroundColor = 'rgba(50, 50, 50, .6)';
                button.style.borderColor = 'rgba(255,255,255,.35)';
                button.style.boxShadow = '0 2px 5px rgba(0, 0, 0, .4)';
            };
            button.onclick = onClick;
            return button;
        };

        const toggleBBoxesButton = createButton('Toggle All BBoxes', () => this.toggleAllBoundingBoxes());
        this.globalButtonContainer.appendChild(toggleBBoxesButton);

        const toggleWireframeButton = createButton('Toggle All Wireframes', () => this.toggleAllWireframes());
        this.globalButtonContainer.appendChild(toggleWireframeButton);

        const screenshotButton = createButton('Screenshot', () => AssetManager.screenshot());
        this.globalButtonContainer.appendChild(screenshotButton);

        const toggleDebugUIButton = createButton('Toggle Debug (Q)', () => this.toggleDebugUI(!this.debugUIEnabled));
        this.globalButtonContainer.appendChild(toggleDebugUIButton);

        // --- Prefab Library Panel (now inside sceneGraphPanel) ---
        this.prefabPanel = document.createElement('div');
        this.prefabPanel.style.color = '#E0E0E0';
        this.prefabPanel.style.backgroundColor = 'rgba(0,0,0,.5)';
        this.prefabPanel.style.padding = '8px 12px';
        this.prefabPanel.style.borderRadius = '6px';
        this.prefabPanel.style.border = '1px solid rgba(255,255,255,.25)';
        this.prefabPanel.style.flexGrow = '1';
        this.prefabPanel.style.overflowY = 'hidden';
        this.prefabPanel.style.display = 'none'; // Initially hidden
        this.prefabPanel.style.flexDirection = 'column';
        this.sceneGraphPanel.appendChild(this.prefabPanel);

        // --- View Toggler for Scene Graph / Prefabs ---
        const viewToggleContainer = document.createElement('div');
        viewToggleContainer.style.display = 'flex';
        viewToggleContainer.style.gap = '5px';
        viewToggleContainer.style.marginBottom = '10px';

        const createToggleButton = (text: string, isActive: boolean) => {
            const button = createSceneGraphButton(text, () => {}); // Use scene graph button style
            button.style.flexGrow = '1';
            if (isActive) {
                button.style.backgroundColor = 'rgba(60, 120, 255, 0.8)';
                button.style.borderColor = 'rgba(100, 150, 255, 1)';
            }
            return button;
        };

        const sceneButton = createToggleButton('Scene', true);
        const prefabButton = createToggleButton('Prefabs', false);

        sceneButton.onclick = () => {
            this.sceneGraphContainer.style.display = 'flex';
            this.prefabPanel.style.display = 'none';
            sceneButton.style.backgroundColor = 'rgba(60, 120, 255, 0.8)';
            sceneButton.style.borderColor = 'rgba(100, 150, 255, 1)';
            prefabButton.style.backgroundColor = 'rgba(70, 70, 70, .6)';
            prefabButton.style.borderColor = 'rgba(255,255,255,.35)';
        };

        prefabButton.onclick = () => {
            this.sceneGraphContainer.style.display = 'none';
            this.prefabPanel.style.display = 'flex';
            prefabButton.style.backgroundColor = 'rgba(60, 120, 255, 0.8)';
            prefabButton.style.borderColor = 'rgba(100, 150, 255, 1)';
            sceneButton.style.backgroundColor = 'rgba(70, 70, 70, .6)';
            sceneButton.style.borderColor = 'rgba(255,255,255,.35)';
        };

        viewToggleContainer.appendChild(sceneButton);
        viewToggleContainer.appendChild(prefabButton);

        // Insert toggler at the top of the scene graph panel
        this.sceneGraphPanel.insertBefore(viewToggleContainer, this.sceneGraphContainer);

        // --- Crash Test Buttons ---
        const crashTestContainer = document.createElement('div');
        crashTestContainer.style.display = 'flex';
        crashTestContainer.style.flexDirection = 'column';
        crashTestContainer.style.gap = '5px';
        crashTestContainer.style.marginTop = '10px';
        crashTestContainer.style.paddingTop = '10px';
        crashTestContainer.style.borderTop = '1px solid rgba(255,100,100,.2)';
        this.sceneGraphPanel.appendChild(crashTestContainer);

        const crashHeader = document.createElement('div');
        crashHeader.innerText = '--- Crash Tests ---';
        crashHeader.style.textAlign = 'center';
        crashHeader.style.color = '#ffcc00'; // Warning color
        crashHeader.style.marginBottom = '5px';
        crashHeader.style.fontWeight = 'bold';
        crashTestContainer.appendChild(crashHeader);

        const crashButtonRow = document.createElement('div');
        crashButtonRow.style.display = 'flex';
        crashButtonRow.style.flexWrap = 'wrap';
        crashButtonRow.style.gap = '10px';
        crashButtonRow.style.justifyContent = 'center';
        crashTestContainer.appendChild(crashButtonRow);

        const createCrashButton = (text: string, onClick: () => void): HTMLButtonElement => {
            const button = createButton(text, onClick); // Reuse existing button factory
            button.style.backgroundColor = 'rgba(100, 40, 40, .6)'; // Reddish tint
            button.style.borderColor = 'rgba(255, 100, 100, .35)';
            return button;
        };

        crashButtonRow.appendChild(createCrashButton('Add 1k Cubes', () => this.testAdd1000Cubes()));
        crashButtonRow.appendChild(createCrashButton('Deep Hierarchy', () => this.testDeepHierarchy()));
        crashButtonRow.appendChild(createCrashButton('JS Error', () => this.testTriggerError()));
        crashButtonRow.appendChild(createCrashButton('Nuke Scene', () => this.testNukeScene()));

        // --- Right Panel: Other Stats ---
        this.statsColumnContainer = document.createElement('div');
        this.statsColumnContainer.style.display = 'flex';
        this.statsColumnContainer.style.flexDirection = 'column'; // Stack stats vertically
        this.statsColumnContainer.style.flexBasis = '300px';
        this.statsColumnContainer.style.flexShrink = '0';
        this.statsColumnContainer.style.gap = '10px'; // Space between individual stats panels
        this.mainDebugContainer.appendChild(this.statsColumnContainer);

        // Helper function for right-aligned stats panels
        const createRightStatsPanel = (initialText: string = ''): HTMLDivElement => {
            const panel = document.createElement('div');
            panel.style.color = '#E0E0E0';
            panel.style.backgroundColor = 'rgba(0,0,0,.5)';
            panel.style.padding = '8px 12px';
            panel.style.fontFamily = 'monospace';
            panel.style.fontSize = '14px';
            panel.style.borderRadius = '6px';
            panel.style.border = '1px solid rgba(255,255,255,.25)';
            panel.style.boxShadow = '0 2px 10px rgba(0, 0, 0, .6)';
            panel.style.lineHeight = '1.4';
            panel.style.whiteSpace = 'pre-wrap';
            panel.style.textAlign = 'center';
            panel.innerText = initialText;
            this.statsColumnContainer.appendChild(panel);
            return panel;
        };

        this.sceneObjectsStatsElement = createRightStatsPanel('--- Scene Stats ---\nObjects: 0\nVisible Meshes: 0\nVertices: 0\nFaces: 0\nMaterials: 0');
        this.rendererInfoElement = createRightStatsPanel('--- Renderer Info ---\nCalls: 0\nTriangles: 0\nPoints: 0\nLines: 0\nGeometries: 0\nTextures: 0\nPrograms: 0');
        this.memoryInfoElement = createRightStatsPanel('--- Memory Info ---\nJS Heap Total: 0 MB\nJS Heap Used: 0 MB');
        this.executionTimeInfoElement = createRightStatsPanel('--- Execution Times ---\nCurrent Frame: 0.00 ms\nAvg 1s: 0.00 ms\nAvg 5s: 0.00 ms\nAvg 30s: 0.00 ms\nAvg 60s: 0.00 ms');
        this.cameraStatsElement = createRightStatsPanel('--- Camera Stats ---\nPos: X:0.00 Y:0.00 Z:0.00\nRot(deg): X:0.00 Y:0.00 Z:0.00');

        // Initial visibility state
        this.toggleDebugUI(true);
        this.updatePrefabList(); // Populate the prefab list on init

        // Event listener for clicking on scene graph objects (delegation)
        this.sceneGraphListContainer.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent document click from firing immediately
            const target = event.target as HTMLElement;
            const objectEntry = target.closest('.debug-scene-object-entry');
            if (objectEntry && objectEntry instanceof HTMLElement) {
                const uuid = objectEntry.dataset.uuid;
                if (uuid) {
                    this.selectObjectForInspector(uuid);
                }
            }
        });

        // Hide action panel if clicking anywhere else on the document
        document.addEventListener('click', (event) => {
            if (this.inspectorPanel && !this.inspectorPanel.contains(event.target as Node) &&
                !this.sceneGraphContainer.contains(event.target as Node)) {
                this.deselectObject();
            }
        });
    }

    private static setupGlobalKeyListener() {
        document.addEventListener('keydown', this.handleGlobalKeyDown);
    }

    private static removeGlobalKeyListener() {
        document.removeEventListener('keydown', this.handleGlobalKeyDown);
    }

    private static handleGlobalKeyDown = (event: KeyboardEvent) => {
        // Do not interfere if user is typing in an input field
        if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
            return;
        }

        const key = event.key.toLowerCase();

        if (key === 'q') {
            this.toggleDebugUI(!this.debugUIEnabled);
        }

        // Transform controls shortcuts
        if (this.transformControls) {
            switch (key) {
                case 't':
                    this.transformControls.setMode('translate');
                    this.updateTransformModeUI('translate');
                    break;
                case 'r':
                    this.transformControls.setMode('rotate');
                    this.updateTransformModeUI('rotate');
                    break;
                case 's':
                    this.transformControls.setMode('scale');
                    this.updateTransformModeUI('scale');
                    break;
            }
        }

        if (key === 'e') this.selectObjectFromScreenCenter();
    };

    private static toggleDebugUI(enable: boolean) {
        this.debugUIEnabled = enable;
        const displayStyle = enable ? 'flex' : 'none';

        this.mainDebugContainer.style.display = displayStyle;
        this.fpsElement.style.display = enable ? 'block' : 'none';
        this.customTextElement.style.display = enable ? 'block' : 'none';

        Logger.log(`Debug UI ${enable ? 'enabled' : 'disabled'}.`, "Debug");
    }

    private static updateFPS() {
        const now = performance.now();
        this.frameCount++;
        if (now - this.lastFrameTime >= 1000) {
            this.fps = (this.frameCount * 1000) / (now - this.lastFrameTime);
            this.fpsElement.innerText = `FPS: ${this.fps.toFixed(0)}`;
            this.frameCount = 0;
            this.lastFrameTime = now;
        }
    }

    private static getAverageFrameTime(duration: number): number {
        const now = performance.now();
        let totalDuration = 0;
        let frameCount = 0;
        let i = this.frameData.length;
        while (i--) {
            const frame = this.frameData[i];
            if (now - frame.timestamp <= duration) {
                totalDuration += frame.deltaTime;
                frameCount++;
            } else {
                break;
            }
        }
        return frameCount === 0 ? 0 : totalDuration / frameCount;
    }

    private static updateExecutionTimes() {
        const now = performance.now();
        this.frameData = this.frameData.filter(frame => (now - frame.timestamp) < 60000);

        const currentFrameTime = this.frameData.length > 0 ? this.frameData[this.frameData.length - 1].deltaTime : 0;
        const avg1s = this.getAverageFrameTime(1000);
        const avg5s = this.getAverageFrameTime(5000);
        const avg30s = this.getAverageFrameTime(30000);
        const avg60s = this.getAverageFrameTime(60000);

        this.executionTimeInfoElement.innerHTML = `--- Execution Times ---\nCurrent Frame: ${currentFrameTime.toFixed(2)} ms\nAvg 1s: ${avg1s.toFixed(2)} ms\nAvg 5s: ${avg5s.toFixed(2)} ms\nAvg 30s: ${avg30s.toFixed(2)} ms\nAvg 60s: ${avg60s.toFixed(2)} ms`;
    }

    private static updateSceneStats() {
        let totalObjects = 0;
        let visibleMeshes = 0;
        let totalVertices = 0;
        let totalFaces = 0;
        const uniqueMaterials = new Set<THREE.Material>();

        RE.Runtime.scene.traverse(object => {
            totalObjects++;
            if (object instanceof THREE.Mesh && object.visible) {
                visibleMeshes++;
                const geometry = object.geometry;
                if (geometry) {
                    if (geometry.isBufferGeometry) {
                        totalVertices += geometry.attributes.position ? geometry.attributes.position.count : 0;
                        totalFaces += geometry.index ? geometry.index.count / 3 : (geometry.attributes.position ? object.geometry.attributes.position.count / 3 : 0);
                    } else { // Geometry (deprecated)
 totalVertices += (geometry as any).vertices.length;
 totalFaces += (geometry as any).faces.length;
                    }
                }
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(mat => uniqueMaterials.add(mat));
                    } else {
                        uniqueMaterials.add(object.material);
                    }
                }
            }
        });

        this.sceneObjectsStatsElement.innerHTML = `--- Scene Stats ---\nObjects: ${this.formatNumber(totalObjects)}\nVisible Meshes: ${this.formatNumber(visibleMeshes)}\nVertices: ${this.formatNumber(totalVertices)}\nFaces: ${this.formatNumber(totalFaces)}\nMaterials: ${this.formatNumber(uniqueMaterials.size)}`;

        if (this.renderer) {
            const info = this.renderer.info;
            this.rendererInfoElement.innerHTML = `--- Renderer Info ---\nCalls: ${this.formatNumber(info.render.calls)}\nTriangles: ${this.formatNumber(info.render.triangles)}\nPoints: ${this.formatNumber(info.render.points)}\nLines: ${this.formatNumber(info.render.lines)}\nGeometries: ${this.formatNumber(info.memory.geometries)}\nTextures: ${this.formatNumber(info.memory.textures)}\nPrograms: ${this.formatNumber(info.programs ? info.programs.length : 0)}`;
        } else {
            this.rendererInfoElement.innerHTML = `--- Renderer Info ---\nRenderer not available.`;
        }

        if (performance && performance.memory) {
            const mem = performance.memory;
            this.memoryInfoElement.innerHTML = `--- Memory Info ---\nJS Heap Total: ${this.formatNumber(Math.round(mem.totalJSHeapSize / (1024 * 1024)))} MB\nJS Heap Used: ${this.formatNumber(Math.round(mem.usedJSHeapSize / (1024 * 1024)))} MB`;
        } else {
            this.memoryInfoElement.innerHTML = `--- Memory Info ---\nMemory stats not available.`;
        }
    }

    private static updateCameraStats() {
        if (RE.Runtime.camera) {
            const position = RE.Runtime.camera.position;
            const rotation = RE.Runtime.camera.rotation; // Euler angles

            this.cameraStatsElement.innerHTML = `--- Camera Stats ---\nPos: X:${position.x.toFixed(2)} Y:${position.y.toFixed(2)} Z:${position.z.toFixed(2)}\nRot(deg): X:${THREE.MathUtils.radToDeg(rotation.x).toFixed(2)} Y:${THREE.MathUtils.radToDeg(rotation.y).toFixed(2)} Z:${THREE.MathUtils.radToDeg(rotation.z).toFixed(2)}`;
        } else {
            this.cameraStatsElement.innerHTML = `--- Camera Stats ---\nCamera not available.`;
        }
    }

    private static updateSceneGraph(forceUpdate: boolean = false) {
        if (!this.debugUIEnabled && !forceUpdate) return;

        const now = performance.now();
        if (!forceUpdate && now - this.lastSceneGraphUpdateTime < 1000) {
            return;
        }
        this.lastSceneGraphUpdateTime = now;

        this.sceneGraphListContainer.innerHTML = ''; // Clear previous content

        const filterText = this.currentFilter.toLowerCase();

        if (filterText) {
            // Render a flat, filtered list
            const allObjects: { object: THREE.Object3D, vertices: number, faces: number }[] = [];
            RE.Runtime.scene.traverse(object => {
                if (object.name.toLowerCase().includes(filterText) || object.type.toLowerCase().includes(filterText)) {
                    let vertices = 0, faces = 0;
                    if (object instanceof THREE.Mesh && object.geometry?.isBufferGeometry) {
                        vertices = object.geometry.attributes.position?.count || 0;
                        faces = (object.geometry.index?.count || vertices) / 3;
                    }
                    allObjects.push({ object, vertices, faces });
                }
            });

            allObjects.sort((a, b) => {
                if (this.currentSortBy === 'name') return a.object.name.localeCompare(b.object.name);
                if (this.currentSortBy === 'vertices') return b.vertices - a.vertices;
                if (this.currentSortBy === 'faces') return b.faces - a.faces;
                return 0;
            });

            allObjects.forEach(({ object, vertices, faces }) => {
                const objectEntry = this.createObjectEntryElement(object, 0, false);
                objectEntry.innerHTML += ` - V:${this.formatNumber(vertices)} F:${this.formatNumber(Math.floor(faces))}`;
                this.sceneGraphListContainer.appendChild(objectEntry);
            });
        } else {
            // Render the hierarchy
            this.renderHierarchy(RE.Runtime.scene, this.sceneGraphListContainer, 0);
        }
    }

    private static renderHierarchy(parentObject: THREE.Object3D, parentElement: HTMLElement, depth: number) {
        let children = [...parentObject.children];

        // Sorting logic
        children.sort((a, b) => {
            if (this.currentSortBy === 'name') {
                return (a.name || 'Unnamed').localeCompare(b.name || 'Unnamed');
            }
            const getMetric = (obj: THREE.Object3D, metric: 'vertices' | 'faces') => {
                let count = 0;
                // Only count the object's own metrics, not children, for hierarchical sort
                if (obj instanceof THREE.Mesh && obj.geometry?.isBufferGeometry) {
                    if (metric === 'vertices') count = obj.geometry.attributes.position?.count || 0;
                    if (metric === 'faces') count = (obj.geometry.index?.count || obj.geometry.attributes.position?.count || 0) / 3;
                }
                return count;
            };
            return getMetric(b, this.currentSortBy) - getMetric(a, this.currentSortBy);
        });

        children.forEach(object => {
            const hasChildren = object.children.length > 0;
            const isExpanded = this.expandedNodes.has(object.uuid);

            const objectEntry = this.createObjectEntryElement(object, depth, hasChildren, !isExpanded);
            parentElement.appendChild(objectEntry);

            if (hasChildren && isExpanded) {
                this.renderHierarchy(object, parentElement, depth + 1);
            }
        });
    }

    private static createObjectEntryElement(object: THREE.Object3D, depth: number, hasChildren: boolean, isCollapsed?: boolean): HTMLDivElement {
        const objectEntry = document.createElement('div');
        objectEntry.className = 'debug-scene-object-entry';
        objectEntry.dataset.uuid = object.uuid;
        objectEntry.style.padding = '2px 0';
        objectEntry.style.cursor = 'pointer';
        objectEntry.style.whiteSpace = 'nowrap';
        objectEntry.style.overflow = 'hidden';
        objectEntry.style.textOverflow = 'ellipsis';
        objectEntry.style.paddingLeft = `${depth * 15}px`;

        if (this.selectedObjectUuid === object.uuid) {
            objectEntry.style.backgroundColor = 'rgba(255,255,255,0.1)';
        }

        const toggleIcon = document.createElement('span');
        toggleIcon.style.display = 'inline-block';
        toggleIcon.style.width = '1em';
        toggleIcon.style.cursor = hasChildren ? 'pointer' : 'default';
        toggleIcon.innerText = hasChildren ? (isCollapsed ? '▶' : '▼') : '●';
        if (hasChildren) {
            toggleIcon.onclick = (e) => {
                e.stopPropagation();
                this.toggleNodeExpansion(object.uuid);
            };
        }
        objectEntry.appendChild(toggleIcon);

        const textNode = document.createElement('span');
        let vertices = 0, faces = 0;
        if (object instanceof THREE.Mesh && object.geometry) {
            if (object.geometry.isBufferGeometry) {
                vertices = object.geometry.attributes.position ? object.geometry.attributes.position.count : 0;
                faces = object.geometry.index ? object.geometry.index.count / 3 : (vertices / 3);
            }
        }
        let textContent = ` ${object.visible ? '✅' : '❌'} ${object.name || 'Unnamed'} (${object.type})`;
        if (object instanceof THREE.Mesh && vertices > 0) {
            textContent += ` - V:${this.formatNumber(vertices)} F:${this.formatNumber(Math.floor(faces))}`;
        }
        textNode.innerText = textContent;
        
        objectEntry.appendChild(textNode);

        return objectEntry;
    }

    private static toggleNodeExpansion(uuid: string) {
        if (this.expandedNodes.has(uuid)) {
            this.expandedNodes.delete(uuid);
        } else {
            this.expandedNodes.add(uuid);
        }
        this.updateSceneGraph(true);
    }

    private static updateSceneGraph_OLD(forceUpdate: boolean = false, sortBy?: 'vertices' | 'faces' | 'name', filterByName?: string) {
        if (!this.debugUIEnabled && !forceUpdate) return;

        const now = performance.now();
        if (!forceUpdate && now - this.lastSceneGraphUpdateTime < 1000) {
            return;
        }
        this.lastSceneGraphUpdateTime = now;

        const sceneObjects: {
            object: THREE.Object3D; // Store reference to the actual object
            name: string;
            type: string;
            uuid: string;
            vertices: number;
            faces: number;
            visible: boolean;
            depth: number;
        }[] = [];

        RE.Runtime.scene.traverse((object) => {
            let vertices = 0;
            let faces = 0;

            if (object instanceof THREE.Mesh && object.geometry) {
                if (object.geometry.isBufferGeometry) {
                    vertices = object.geometry.attributes.position ? object.geometry.attributes.position.count : 0;
                    faces = object.geometry.index ? object.geometry.index.count / 3 : (object.geometry.attributes.position ? object.geometry.attributes.position.count / 3 : 0);
                } else {
                    vertices = (object.geometry as any).vertices.length;
                    faces = (object.geometry as any).faces.length;
                }
            }

            let depth = 0;
            let parent = object.parent;
            while (parent && parent !== RE.Runtime.scene) {
                depth++;
                parent = parent.parent;
            }

            sceneObjects.push({
                object: object, // Store the object reference
                name: object.name || 'Unnamed',
                type: object.type,
                uuid: object.uuid,
                vertices: vertices,
                faces: faces,
                visible: object.visible,
                depth: depth,
            });
        });

        let filteredObjects = sceneObjects;

        if (filterByName) {
            const lowerCaseFilter = filterByName.toLowerCase();
            filteredObjects = filteredObjects.filter(obj =>
                obj.name.toLowerCase().includes(lowerCaseFilter) ||
                obj.type.toLowerCase().includes(lowerCaseFilter) ||
                obj.uuid.toLowerCase().includes(lowerCaseFilter)
            );
        }

        if (sortBy) {
            filteredObjects.sort((a, b) => {
                if (sortBy === 'vertices') {
                    return b.vertices - a.vertices;
                } else if (sortBy === 'faces') {
                    return b.faces - a.faces;
                } else if (sortBy === 'name') {
                    return a.name.localeCompare(b.name);
                }
                return 0;
            });
        } else { return; }

    }

    private static selectObjectForInspector(uuid: string) {
        if (this.selectedObjectUuid === uuid && this.transformControls) return;

        this.deselectObject(); // Clean up previous selection first

        this.selectedObjectUuid = uuid;
        const selectedObject = RE.Runtime.scene.getObjectByProperty('uuid', uuid);
    
        if (selectedObject) {
            this.inspectorPanel.style.display = 'block';
            this.buildInspectorUI(selectedObject);
            this.setupTransformControls(selectedObject);
        } else {
            this.deselectObject();
        }
    
        this.updateSceneGraph(true); // Re-render scene graph to show selection highlight
    }

    private static deselectObject() {
        if (!this.selectedObjectUuid) return;

        if (this.transformControls) {
            this.transformControls.detach();
            this.transformControls.dispose();
            RE.Runtime.scene.remove(this.transformControls);
            this.transformControls = null;
        }

        this.selectedObjectUuid = null;
        this.inspectorPanel.style.display = 'none';
        this.inspectorPanel.innerHTML = ''; // Reset content
        this.updateSceneGraph(true); // Re-render to remove selection highlight
    }

    private static selectObjectFromScreenCenter() {
        if (!RE.Runtime.camera) return;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), RE.Runtime.camera);

        const intersects = raycaster.intersectObjects(RE.Runtime.scene.children, true);

        if (intersects.length > 0) {
            for (const intersect of intersects) {
                if (intersect.object.visible) {
                    this.selectObjectForInspector(intersect.object.uuid);
                    return;
                }
            }
        } else {
            this.deselectObject();
        }
    }

    private static buildInspectorUI(object: THREE.Object3D) {
        this.inspectorPanel.innerHTML = ''; // Clear previous content
    
        const header = document.createElement('div');
        header.style.fontWeight = 'bold';
        header.style.textAlign = 'center';
        header.style.marginBottom = '10px';
        header.innerText = `--- Inspector: ${object.name || 'Unnamed'} ---`;
        this.inspectorPanel.appendChild(header);

        // --- Transform Mode Buttons ---
        const transformModeContainer = document.createElement('div');
        transformModeContainer.style.display = 'flex';
        transformModeContainer.style.gap = '5px';
        transformModeContainer.style.marginBottom = '10px';

        const createModeButton = (mode: 'translate' | 'rotate' | 'scale', label: string, key: string) => {
            const button = this.createActionButton(`${label} (${key})`, () => {
                if (this.transformControls) {
                    this.transformControls.setMode(mode);
                    this.updateTransformModeUI(mode);
                }
            });
            button.dataset.mode = mode;
            transformModeContainer.appendChild(button);
        };

        createModeButton('translate', 'Move', 'T');
        createModeButton('rotate', 'Rotate', 'R');
        createModeButton('scale', 'Scale', 'S');
        this.inspectorPanel.appendChild(transformModeContainer);

        // --- Object3D Properties ---
        this.createSectionHeader(this.inspectorPanel, 'Object3D');
        this.createStringInput(this.inspectorPanel, 'Name', object.name, (val) => { object.name = val; this.updateSceneGraph(true); });
        this.createBooleanInput(this.inspectorPanel, 'Visible', object.visible, (val) => object.visible = val);

        const posRow = this.createVectorInput(this.inspectorPanel, 'Position', object.position, 0.01, 3);
        this.positionInputs = this.getVectorInputsFromRow(posRow);
        const rotRow = this.createVectorInput(this.inspectorPanel, 'Rotation (deg)', object.rotation, 1, 3, true);
        this.rotationInputs = this.getVectorInputsFromRow(rotRow);
        const scaleRow = this.createVectorInput(this.inspectorPanel, 'Scale', object.scale, 0.01, 3);
        this.scaleInputs = this.getVectorInputsFromRow(scaleRow);

        this.createUserDataInput(this.inspectorPanel, 'Object UserData', object.userData, (newVal) => {
            object.userData = newVal;
        });
    
        // --- Components ---
        const components = Scene.getAllComponents(object);
        if (components.length === 0) {
            const noComponents = document.createElement('div');
            noComponents.innerText = '(No components found)';
            noComponents.style.textAlign = 'center';
            noComponents.style.marginTop = '10px';
            noComponents.style.fontStyle = 'italic';
            this.inspectorPanel.appendChild(noComponents);
        } else {
            components.forEach(component => {
                this.buildComponentInspector(component);
            });
        }

        // --- Actions ---
        this.createSectionHeader(this.inspectorPanel, 'Actions');
        const actionsContainer = document.createElement('div');
        actionsContainer.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            margin-top: 8px;
        `;
        this.inspectorPanel.appendChild(actionsContainer);

        const createActionButton = (text: string, action: () => void): HTMLButtonElement => {
            const button = this.createActionButton(text, action);
            actionsContainer.appendChild(button);
            return button;
        };

        createActionButton('Duplicate', () => this.duplicateObject(object.uuid));
        createActionButton('Teleport Cam', () => this.teleportCameraToObject(object.uuid));
        createActionButton('Toggle BBox', () => this.toggleBoundingBox(object));
        createActionButton('Toggle Axes', () => this.toggleAxesHelper(object));
        createActionButton('Log to Console', () => this.logObjectToConsole(object.uuid));
        createActionButton('Delete', () => {
            this.deleteObject(object.uuid);
            this.deselectObject();
        });
    }

    private static async duplicateObject(uuid: string) {
        const originalObject = RE.Runtime.scene.getObjectByProperty('uuid', uuid);
        if (!originalObject) {
            Logger.error(`Cannot duplicate: Object with UUID ${uuid} not found.`, "Debug");
            return;
        }
    
        let newInstance: THREE.Object3D | null = null;
    
        // Check if it's a prefab instance we know how to re-instantiate
        if (originalObject.userData.isPrefab && originalObject.userData.prefabPath) {
            Logger.log(`Duplicating prefab: ${originalObject.userData.prefabPath}`, "Debug");
            newInstance = await Prefab.instantiate(originalObject.userData.prefabPath);
        } else {
            // Fallback for non-prefab objects
            Logger.warn("Duplicating non-prefab object. Components will not be copied.", "Debug");
            newInstance = originalObject.clone(); // Note: This is a shallow clone of components
        }
    
        if (newInstance) {
            // Position the new instance near the original
            const offset = new THREE.Vector3(1, 0, 0); // Simple offset to the side
            newInstance.position.copy(originalObject.position).add(offset);
            newInstance.rotation.copy(originalObject.rotation);
            newInstance.scale.copy(originalObject.scale);
    
            // Add to the same parent as the original
            const parent = originalObject.parent || RE.Runtime.scene;
            parent.add(newInstance);
    
            this.updateSceneGraph(true);
            this.selectObjectForInspector(newInstance.uuid); // Select the new object
        } else {
            Logger.error("Failed to create a duplicate instance.", "Debug");
        }
    }

    private static createActionButton = (text: string, action: () => void): HTMLButtonElement => {
        const button = document.createElement('button');
        button.innerText = text;
        button.style.cssText = `
            background-color: rgba(60, 60, 60, .8);
            color: #E0E0E0;
            border: 1px solid rgba(255, 255, 255, .2);
            padding: 4px 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            font-family: monospace;
            transition: background-color .2s ease;
            flex-grow: 1;
        `;
        button.onmouseover = () => { button.style.backgroundColor = 'rgba(80, 80, 80, .9)'; };
        button.onmouseout = () => { button.style.backgroundColor = 'rgba(60, 60, 60, .8)'; };
        button.onclick = action;
        return button;
    };

    private static buildComponentInspector(component: RE.Component) {
        this.createSectionHeader(this.inspectorPanel, `Component: ${component.constructor.name}`);
        
        const componentClass = component.constructor as any;
        const propInterface = componentClass.interface as REComponentInterface | undefined;
    
        const handledProps = new Set<string>();
    
        if (propInterface) {
            for (const propName in propInterface) {
                handledProps.add(propName);
                const propType = propInterface[propName];
                const propValue = (component as any)[propName];
    
                switch (propType) {
                    case 'Number':
                        this.createNumberInput(this.inspectorPanel, propName, propValue, (newVal) => (component as any)[propName] = newVal, 0.1);
                        break;
                    case 'String':
                        this.createStringInput(this.inspectorPanel, propName, propValue, (newVal) => (component as any)[propName] = newVal);
                        break;
                    case 'Boolean':
                        this.createBooleanInput(this.inspectorPanel, propName, propValue, (newVal) => (component as any)[propName] = newVal);
                        break;
                    case 'Vector2':
                        this.createVectorInput(this.inspectorPanel, propName, propValue, 0.01, 2);
                        break;
                    case 'Vector3':
                        this.createVectorInput(this.inspectorPanel, propName, propValue, 0.01, 3);
                        break;
                    case 'Color':
                        this.createColorInput(this.inspectorPanel, propName, propValue, (newVal) => (component as any)[propName].set(newVal));
                        break;
                    case 'Select':
                        const optionsArray = (component as any)[`${propName}Options`];
                        if (Array.isArray(optionsArray)) {
                            const selectOptions = optionsArray.map((opt, index) => ({ value: String(index), text: String(opt) }));
                            this.createSelectInput(this.inspectorPanel, propName, selectOptions, String(propValue), (newVal) => (component as any)[propName] = parseInt(newVal, 10));
                        }
                        break;
                    case 'Object3D':
                    case 'Prefab':
                    case 'Texture':
                    case 'Material':
                    case 'Audio':
                    case 'PositionalAudio':
                        this.createDisplayField(this.inspectorPanel, propName, propValue ? (propValue.name || propValue.uuid || 'Assigned') : 'None');
                        break;
                    default:
                        this.createDisplayField(this.inspectorPanel, propName, String(propValue));
                        break;
                }
            }
        }
    
        // Always add a userData editor for the component
        this.createUserDataInput(this.inspectorPanel, 'Component UserData', (component as any).userData, (newVal) => {
            (component as any).userData = newVal;
        });
    }

    private static createSectionHeader(parent: HTMLElement, title: string) {
        const header = document.createElement('div');
        header.innerText = title;
        header.style.cssText = `
            font-weight: bold;
            margin-top: 12px;
            padding-bottom: 4px;
            border-bottom: 1px solid rgba(255,255,255,0.2);
        `;
        parent.appendChild(header);
    }
    
    private static createRow(parent: HTMLElement, label: string): HTMLElement {
        const row = document.createElement('div');
        row.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 4px 0;
            font-size: 12px;
        `;
        const labelEl = document.createElement('label');
        labelEl.innerText = label;
        labelEl.style.marginRight = '10px';
        row.appendChild(labelEl);
        parent.appendChild(row);
        return row;
    }
    
    private static createStringInput(parent: HTMLElement, label: string, value: string, onChange: (newValue: string) => void) {
        const row = this.createRow(parent, label);
        const input = document.createElement('input');
        input.type = 'text';
        input.value = value;
        input.style.cssText = `
            background-color: rgba(0,0,0,.4);
            color: #E0E0E0;
            border: 1px solid rgba(255,255,255,.2);
            padding: 2px 4px;
            border-radius: 3px;
            font-size: 11px;
            font-family: monospace;
            width: 60%;
        `;
        input.onchange = () => onChange(input.value);
        row.appendChild(input);
    }
    
    private static createNumberInput(parent: HTMLElement, label: string, value: number, onChange: (newValue: number) => void, step: number) {
        const row = this.createRow(parent, label);
        const input = document.createElement('input');
        input.type = 'number';
        input.value = String(value);
        input.step = String(step);
        input.style.cssText = `
            background-color: rgba(0,0,0,.4);
            color: #E0E0E0;
            border: 1px solid rgba(255,255,255,.2);
            padding: 2px 4px;
            border-radius: 3px;
            font-size: 11px;
            font-family: monospace;
            width: 60%;
        `;
        input.onchange = () => onChange(parseFloat(input.value));
        row.appendChild(input);
    }
    
    private static createBooleanInput(parent: HTMLElement, label: string, value: boolean, onChange: (newValue: boolean) => void) {
        const row = this.createRow(parent, label);
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = value;
        input.style.cssText = `
            margin-left: auto; /* Push to the right */
        `;
        input.onchange = () => {
            onChange(input.checked);
            if (label.toLowerCase() === 'visible') {
                this.updateSceneGraph(true);
            }
        };
        row.appendChild(input);
    }
    
    private static createVectorInput(parent: HTMLElement, label: string, vector: THREE.Vector2 | THREE.Vector3 | THREE.Euler, step: number, dimensions: 2 | 3, isEuler: boolean = false): HTMLElement {
        const row = this.createRow(parent, label);
        const container = document.createElement('div');
        container.style.cssText = `
            display: flex;
            gap: 4px;
            width: 70%;
        `;
    
        const axes: ('x' | 'y' | 'z')[] = dimensions === 2 ? ['x', 'y'] : ['x', 'y', 'z'];
        axes.forEach(axis => {
            const input = document.createElement('input');
            input.type = 'number';
            input.value = isEuler ? THREE.MathUtils.radToDeg((vector as THREE.Euler)[axis]).toFixed(2) : (vector as any)[axis].toFixed(2);
            input.step = String(step);
            input.style.cssText = `
                background-color: rgba(0,0,0,.4);
                color: #E0E0E0;
                border: 1px solid rgba(255,255,255,.2);
                padding: 2px 4px;
                border-radius: 3px;
                font-size: 11px;
                font-family: monospace;
                width: ${100 / dimensions}%;
            `;
            input.onchange = () => {
                const val = parseFloat(input.value);
                (vector as any)[axis] = isEuler ? THREE.MathUtils.degToRad(val) : val;
            };
            container.appendChild(input);
        });
    
        row.appendChild(container);
        return row;
    }

    private static getVectorInputsFromRow(row: HTMLElement): { x: HTMLInputElement, y: HTMLInputElement, z: HTMLInputElement } {
        const inputs = row.querySelectorAll('input');
        return {
            x: inputs[0],
            y: inputs[1],
            z: inputs[2]
        };
    }
    
    private static createColorInput(parent: HTMLElement, label: string, value: THREE.Color, onChange: (newValue: string) => void) {
        const row = this.createRow(parent, label);
        const input = document.createElement('input');
        input.type = 'color';
        input.value = `#${value.getHexString()}`;
        input.style.cssText = `
            background-color: transparent;
            border: 1px solid rgba(255,255,255,.2);
            border-radius: 3px;
            height: 24px;
            width: 70%;
        `;
        input.onchange = () => onChange(input.value);
        row.appendChild(input);
    }

    private static createSelectInput(parent: HTMLElement, label: string, options: { value: string, text: string }[], currentValue: string, onChange: (newValue: string) => void) {
        const row = this.createRow(parent, label);
        const select = document.createElement('select');
        select.style.cssText = `
            background-color: rgba(0,0,0,.4);
            color: #E0E0E0;
            border: 1px solid rgba(255,255,255,.2);
            padding: 2px 4px;
            border-radius: 3px;
            font-size: 11px;
            font-family: monospace;
            width: 70%;
        `;
        options.forEach(opt => {
            const optionEl = document.createElement('option');
            optionEl.value = opt.value;
            optionEl.text = opt.text;
            select.appendChild(optionEl);
        });
        select.value = currentValue;
        select.onchange = () => onChange(select.value);
        row.appendChild(select);
    }

    private static createDisplayField(parent: HTMLElement, label: string, value: string) {
        const row = this.createRow(parent, label);
        const valueEl = document.createElement('span');
        valueEl.innerText = value;
        valueEl.style.cssText = `
            color: #aaa;
            text-align: right;
            width: 70%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        `;
        row.appendChild(valueEl);
    }

    private static createUserDataInput(parent: HTMLElement, label: string, value: object, onChange: (newValue: object) => void) {
        const row = this.createRow(parent, label);
        row.style.flexDirection = 'column';
        row.style.alignItems = 'stretch';
    
        const textarea = document.createElement('textarea');
        textarea.rows = 4;
        textarea.value = JSON.stringify(value, null, 2);
        textarea.style.cssText = `
            background-color: rgba(0,0,0,.4);
            color: #E0E0E0;
            border: 1px solid rgba(255,255,255,.2);
            padding: 4px;
            border-radius: 3px;
            font-size: 11px;
            font-family: monospace;
            width: 100%;
            margin-top: 4px;
            resize: vertical;
        `;
        textarea.onchange = () => {
            try {
                const newValue = JSON.parse(textarea.value);
                onChange(newValue);
                textarea.style.borderColor = 'rgba(255,255,255,.2)'; // Reset border on success
            } catch (e) {
                console.error("Invalid JSON in userData:", e);
                textarea.style.borderColor = 'red'; // Indicate error
            }
        };
        row.appendChild(textarea);
    }

    private static setupTransformControls(object: THREE.Object3D) {
        if (!RE.Runtime.camera || !RE.Runtime.rogueDOMContainer) {
            Logger.warn("Cannot create TransformControls: camera or DOM container not available.", "Debug");
            return;
        }

        this.transformControls = new TransformControls(RE.Runtime.camera, RE.Runtime.rogueDOMContainer);
        this.transformControls.attach(object);
        RE.Runtime.scene.add(this.transformControls);

        this.transformControls.addEventListener('change', () => {
            this.updateInspectorTransforms(object);
        });

        this.transformControls.addEventListener('dragging-changed', (event) => {
            this.isTransforming = (event as any).value as boolean;
        });

        this.updateTransformModeUI('translate');
    }

    private static updateInspectorTransforms(object: THREE.Object3D) {
        if (!object) return;

        if (this.positionInputs) {
            this.positionInputs.x.value = object.position.x.toFixed(3);
            this.positionInputs.y.value = object.position.y.toFixed(3);
            this.positionInputs.z.value = object.position.z.toFixed(3);
        }
        if (this.rotationInputs) {
            this.rotationInputs.x.value = THREE.MathUtils.radToDeg(object.rotation.x).toFixed(2);
            this.rotationInputs.y.value = THREE.MathUtils.radToDeg(object.rotation.y).toFixed(2);
            this.rotationInputs.z.value = THREE.MathUtils.radToDeg(object.rotation.z).toFixed(2);
        }
        if (this.scaleInputs) {
            this.scaleInputs.x.value = object.scale.x.toFixed(3);
            this.scaleInputs.y.value = object.scale.y.toFixed(3);
            this.scaleInputs.z.value = object.scale.z.toFixed(3);
        }
    }

    private static updateTransformModeUI(activeMode: 'translate' | 'rotate' | 'scale') {
        const buttons = this.inspectorPanel.querySelectorAll<HTMLButtonElement>('[data-mode]');
        buttons.forEach(button => {
            if (button.dataset.mode === activeMode) {
                button.style.backgroundColor = 'rgba(60, 120, 255, 0.8)';
                button.style.borderColor = 'rgba(100, 150, 255, 1)';
            } else {
                button.style.backgroundColor = 'rgba(60, 60, 60, .8)';
                button.style.borderColor = 'rgba(255, 255, 255, .2)';
            }
        });
    }

    private static teleportCameraToObject(uuid: string) {
        const object = RE.Runtime.scene.getObjectByProperty('uuid', uuid);
        if (object && RE.Runtime.camera) {
            const camera = RE.Runtime.camera;
            const objectWorldPos = new THREE.Vector3();
            object.getWorldPosition(objectWorldPos);

            // Calculate a position slightly in front and above the object
            const offset = new THREE.Vector3(0, 1, 3); // Adjust as needed
            const newCameraPos = objectWorldPos.clone().add(offset);

            camera.position.copy(newCameraPos);
            camera.lookAt(objectWorldPos);
            Logger.log(`Camera teleported to ${object.name || object.uuid}`, "Debug");
        } else {
            Logger.error(`Failed to teleport camera: Object with UUID ${uuid} or camera not found.`, "Debug");
        }
    }

    private static deleteObject(uuid: string) {
        const object = RE.Runtime.scene.getObjectByProperty('uuid', uuid);
        if (object) {
            // Remove any associated helpers first
            if (this.boundingBoxHelpers.has(object)) {
                this.toggleBoundingBox(object); // This will remove and dispose
            }
            if (this.axesHelpers.has(object)) {
                this.toggleAxesHelper(object); // This will remove and dispose
            }

            // Dispose of geometry and materials to prevent memory leaks
            if (object instanceof THREE.Mesh) {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    const materials = Array.isArray(object.material) ? object.material : [object.material];
                    materials.forEach(mat => mat.dispose());
                }
            }

            // Remove from parent
            if (object.parent) {
                object.parent.remove(object);
                Logger.log(`Object ${object.name || object.uuid} deleted.`, "Debug");
                this.updateSceneGraph(true); // Force update scene graph
            } else {
                Logger.warn(`Object ${object.name || object.uuid} has no parent to remove from.`, "Debug");
            }
        } else {
            Logger.error(`Failed to delete object: Object with UUID ${uuid} not found.`, "Debug");
        }
    }

    private static toggleObjectVisibility(uuid: string) {
        const object = RE.Runtime.scene.getObjectByProperty('uuid', uuid);
        if (object) {
            object.visible = !object.visible;
            Logger.log(`Object ${object.name || object.uuid} visibility toggled to ${object.visible}.`, "Debug");
            this.updateSceneGraph(true); // Force update scene graph to reflect visibility
        } else {
            Logger.error(`Failed to toggle visibility: Object with UUID ${uuid} not found.`, "Debug");
        }
    }

    private static logObjectToConsole(uuid: string) {
        const object = RE.Runtime.scene.getObjectByProperty('uuid', uuid);
        if (object) {
            Logger.log(`Logging object ${object.name || object.uuid} to console:`, "Debug");
            console.log(object);
        } else {
            Logger.error(`Failed to log object: Object with UUID ${uuid} not found.`, "Debug");
        }
    }

    public static showCustomText(text: string) {
        this.customTextElement.innerText = text;
    }

    public static hideCustomText() {
        this.customTextElement.innerText = '';
    }

    public static toggleBoundingBox(object: THREE.Object3D, color: THREE.ColorRepresentation = 0xff0000) {
        if (!this.initialized) {
            Logger.error("Debug module not initialized. Call Debug.init() first.", "Debug");
            return;
        }

        if (this.boundingBoxHelpers.has(object)) {
            const helper = this.boundingBoxHelpers.get(object);
            if (helper) {
                helper.removeFromParent();
                helper.dispose();
            }
            this.boundingBoxHelpers.delete(object);
            Logger.debug(`Removed bounding box for ${object.name || object.uuid}`, "Debug");
        } else {
            const helper = new THREE.BoxHelper(object, color);
            RE.Runtime.scene.add(helper);
            this.boundingBoxHelpers.set(object, helper);
            Logger.debug(`Added bounding box for ${object.name || object.uuid}`, "Debug");
        }
    }

    public static toggleAxesHelper(object: THREE.Object3D, size: number = 1) {
        if (!this.initialized) {
            Logger.error("Debug module not initialized. Call Debug.init() first.", "Debug");
            return;
        }

        if (this.axesHelpers.has(object)) {
            const helper = this.axesHelpers.get(object);
            if (helper) {
                helper.removeFromParent();
                helper.dispose();
            }
            this.axesHelpers.delete(object);
            Logger.debug(`Removed axes helper for ${object.name || object.uuid}`, "Debug");
        } else {
            const helper = new THREE.AxesHelper(size);
            object.add(helper); // Add to the object itself so it moves with the object
            this.axesHelpers.set(object, helper);
            Logger.debug(`Added axes helper for ${object.name || object.uuid}`, "Debug");
        }
    }

    public static clearAllHelpers() {
        this.boundingBoxHelpers.forEach(helper => {
            helper.removeFromParent();
            helper.dispose();
        });
        this.boundingBoxHelpers.clear();

        this.axesHelpers.forEach(helper => {
            helper.removeFromParent();
            helper.dispose();
        });
        this.axesHelpers.clear();
        Logger.debug("Cleared all debug helpers.", "Debug");
    }

    public static toggleAllBoundingBoxes() {
        if (!this.initialized) {
            Logger.error("Debug module not initialized. Call Debug.init() first.", "Debug");
            return;
        }

        const enable = this.boundingBoxHelpers.size === 0; // If no bounding boxes are currently shown, enable them all

        RE.Runtime.scene.traverse(object => {
            if (object instanceof THREE.Mesh) {
                if (enable) {
                    if (!this.boundingBoxHelpers.has(object)) {
                        this.toggleBoundingBox(object);
                    }
                } else {
                    if (this.boundingBoxHelpers.has(object)) {
                        this.toggleBoundingBox(object);
                    }
                }
            }
        });
        Logger.log(`${enable ? 'Enabled' : 'Disabled'} bounding boxes for all meshes.`, "Debug");
    }

    public static toggleAllWireframes() {
        if (!this.initialized) {
            Logger.error("Debug module not initialized. Call Debug.init() first.", "Debug");
            return;
        }

        this.wireframeEnabled = !this.wireframeEnabled;

        RE.Runtime.scene.traverse(object => {
            if (object instanceof THREE.Mesh) {
                const materials = Array.isArray(object.material) ? object.material : [object.material];
                materials.forEach(material => {
                    if (material) {
                        if (this.wireframeEnabled) {
                            // Store original state only when enabling wireframe
                            if (!this.originalWireframeState.has(material)) {
                                this.originalWireframeState.set(material, material.wireframe);
                            }
                            material.wireframe = true;
                        } else {
                            // Restore original state when disabling wireframe
                            if (this.originalWireframeState.has(material)) {
                                material.wireframe = this.originalWireframeState.get(material)!;
                                this.originalWireframeState.delete(material); // Clean up
                            } else {
                                material.wireframe = false; // Default to false if no original state was stored
                            }
                        }
                    }
                });
            }
        });
        Logger.log(`${this.wireframeEnabled ? 'Enabled' : 'Disabled'} wireframes for all meshes.`, "Debug");
    }

    // --- Crash Test Methods ---

    private static testAdd1000Cubes() {
        Logger.warn("Starting test: Adding 1000 cubes.", "Debug");
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        const parent = new THREE.Object3D();
        parent.name = "1000_Cubes_Container";
        RE.Runtime.scene.add(parent);

        for (let i = 0; i < 1000; i++) {
            const cube = new THREE.Mesh(geometry, material);
            cube.name = `TestCube_${i}`;
            cube.position.set(
                (Math.random() - 0.5) * 50,
                (Math.random() - 0.5) * 50,
                (Math.random() - 0.5) * 50
            );
            parent.add(cube);
        }
        Logger.log("Finished adding 1000 cubes.", "Debug");
        this.updateSceneGraph(true);
    }

    private static testDeepHierarchy() {
        Logger.warn("Starting test: Creating deep hierarchy (50 levels).", "Debug");
        let parent = new THREE.Object3D();
        parent.name = "Hierarchy_L0";
        RE.Runtime.scene.add(parent);

        for (let i = 1; i <= 50; i++) {
            const child = new THREE.Object3D();
            child.name = `Hierarchy_L${i}`;
            parent.add(child);
            parent = child;
        }
        Logger.log("Finished creating deep hierarchy.", "Debug");
        this.updateSceneGraph(true);
    }

    private static testTriggerError() {
        Logger.error("Triggering a deliberate JavaScript error in 100ms.", "Debug");
        setTimeout(() => {
            throw new Error("Controlled crash test from Debug UI.");
        }, 100);
    }

    private static testNukeScene() {
        Logger.error("NUKE INITIATED. This will clear the scene and may cause instability.", "Debug");
        Utils.nuke();
        this.deselectObject();
        this.updateSceneGraph(true);
    }

    // --- Prefab Library Methods ---

    private static updatePrefabList() {
        this.prefabPanel.innerHTML = ''; // Clear it

        const header = document.createElement('div');
        header.style.textAlign = 'center';
        header.style.fontWeight = 'bold';
        header.style.marginBottom = '10px';
        header.style.flexShrink = '0';
        header.innerText = '--- Prefab Library ---';
        this.prefabPanel.appendChild(header);

        const filterInput = document.createElement('input');
        filterInput.type = 'text';
        filterInput.placeholder = 'Filter prefabs...';
        filterInput.style.cssText = `
            background-color: rgba(0,0,0,.4);
            color: #E0E0E0;
            border: 1px solid rgba(255,255,255,.2);
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-family: monospace;
            width: 100%;
            box-sizing: border-box;
            margin-bottom: 10px;
            flex-shrink: 0;
        `;
        this.prefabPanel.appendChild(filterInput);

        const listContainer = document.createElement('div');
        listContainer.style.overflowY = 'auto';
        listContainer.style.flexGrow = '1';
        this.prefabPanel.appendChild(listContainer);

        const allPaths = Prefab.getAllPaths();

        const renderList = (paths: string[]) => {
            listContainer.innerHTML = '';
            paths.forEach(path => {
                const item = document.createElement('div');
                item.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 4px; border-radius: 3px;`;
                item.onmouseover = () => item.style.backgroundColor = 'rgba(255,255,255,0.05)';
                item.onmouseout = () => item.style.backgroundColor = 'transparent';

                const nameSpan = document.createElement('span');
                nameSpan.textContent = path.split('/').pop() || path;
                nameSpan.title = path;
                nameSpan.style.whiteSpace = 'nowrap';
                nameSpan.style.overflow = 'hidden';
                nameSpan.style.textOverflow = 'ellipsis';
                item.appendChild(nameSpan);

                const loadBtn = this.createActionButton('Load', async () => {
                    if (!RE.Runtime.camera) {
                        Logger.warn("Cannot load prefab: Camera not found.", "Debug");
                        return;
                    }
                    const camera = RE.Runtime.camera;
                    const spawnPosition = new THREE.Vector3();
                    camera.getWorldPosition(spawnPosition);
                    const forward = new THREE.Vector3();
                    camera.getWorldDirection(forward);
                    spawnPosition.add(forward.multiplyScalar(10)); // Spawn 10 units in front of camera

                    const instance = await Prefab.instantiate(path, { position: spawnPosition });
                    if (instance) {
                        Logger.log(`Loaded prefab "${path}"`, "Debug");
                        this.updateSceneGraph(true);
                    }
                });
                loadBtn.style.flexShrink = '0';
                item.appendChild(loadBtn);
                listContainer.appendChild(item);
            });
        };

        filterInput.oninput = () => renderList(allPaths.filter(p => p.toLowerCase().includes(filterInput.value.toLowerCase())));
        renderList(allPaths);
    }
}
