import * as RE from 'rogue-engine';
import * as THREE from 'three';
import { Window, Container, Button, WindowProps } from '../../modules/UI';
import { DOM } from '../../modules/DOM';
import { Logger } from '../../modules/Logger';

declare global {
    interface Window {
        __MATE_SCENESTATS_INITIALIZED__?: boolean;
    }
}

class SceneStatisticsManager {
    private window: SceneStatisticsWindow;
    private totalObjectsSpan: Container;
    private totalMeshesSpan: Container;
    private totalPolygonsSpan: Container;
    private fpsSpan: Container;
    private drawCallsSpan: Container;
    private geometriesSpan: Container;
    private texturesSpan: Container;
    private rendererTypeSpan: Container;
    private webGLVersionSpan: Container;
    private statusSpan: Container;
    private jsHeapTotalSpan: Container;
    private jsHeapUsedSpan: Container;
    private executionTime30sSpan: Container;
    private executionTime10sSpan: Container;
    private executionTime1sSpan: Container;

    private frameTimes: number[] = [];

    private lastFrameTime: number = 0;
    private frameCount: number = 0;
    private fps: number = 0;

    constructor() {
        this.initUI();
    }

    private createSectionTitle(title: string): Container {
        const container = new Container({
            style: {
                color: '#00aaff',
                fontSize: '14px',
                fontWeight: 'bold',
                marginTop: '10px',
                marginBottom: '5px',
                borderBottom: '1px solid #00aaff',
                paddingBottom: '3px'
            }
        });
        container.element.textContent = title;
        return container;
    }

    private createStatLine(): Container {
        return new Container({ style: { color: '#fff', fontSize: '12px', marginBottom: '3px' } });
    }

    private initUI() {
        Logger.log("SceneStatisticsManager.initUI() called.");

        // General Statistics
        this.totalObjectsSpan = this.createStatLine();
        this.totalMeshesSpan = this.createStatLine();
        this.totalPolygonsSpan = this.createStatLine();

        // Performance
        this.fpsSpan = this.createStatLine();
        this.drawCallsSpan = this.createStatLine();
        this.geometriesSpan = this.createStatLine();
        this.texturesSpan = this.createStatLine();

        // Renderer Info
        this.rendererTypeSpan = this.createStatLine();
        this.webGLVersionSpan = this.createStatLine();

        // Memory & Execution
        this.jsHeapTotalSpan = this.createStatLine();
        this.jsHeapUsedSpan = this.createStatLine();
        this.executionTime30sSpan = this.createStatLine();
        this.executionTime10sSpan = this.createStatLine();
        this.executionTime1sSpan = this.createStatLine();

        this.statusSpan = new Container({ style: { color: '#ff0', fontSize: '12px', fontStyle: 'italic', marginTop: '10px' } });

        const refreshButton = new Button({
            text: 'Refresh Now',
            onClick: () => this.updateStatistics(),
            style: { padding: '5px 10px', backgroundColor: '#4a4a4a', border: 'none', borderRadius: '3px', cursor: 'pointer', marginTop: '10px' }
        });

        const mainContainer = new Container({
            style: {
                display: 'flex',
                flexDirection: 'column',
                padding: '10px',
                width: '100%',
                height: '100%',
                boxSizing: 'border-box',
                fontFamily: 'monospace'
            },
            children: [
                this.createSectionTitle("General Statistics"),
                this.totalObjectsSpan,
                this.totalMeshesSpan,
                this.totalPolygonsSpan,

                this.createSectionTitle("Performance"),
                this.fpsSpan,
                this.drawCallsSpan,
                this.geometriesSpan,
                this.texturesSpan,

                this.createSectionTitle("Renderer Info"),
                this.rendererTypeSpan,
                this.webGLVersionSpan,

                this.createSectionTitle("Memory & Execution"),
                this.jsHeapTotalSpan,
                this.jsHeapUsedSpan,
                this.executionTime30sSpan,
                this.executionTime10sSpan,
                this.executionTime1sSpan,

                this.statusSpan,
                refreshButton
            ]
        });

        Logger.log("Attempting to create SceneStatisticsWindow...");
        this.window = new SceneStatisticsWindow({
            windowId: 'matelib-scene-statistics-window',
            title: 'Scene Statistics',
            initialSize: { width: '280px', height: '530px' }, // Adjusted size for more info and button
            initialPosition: { top: '0.2%', left: '80%' },
            children: [mainContainer.element],
            resizable: true,
            hoverable: true,
            hoverIcon: "📈",
            onClose: () => {
                window.__MATE_SCENESTATS_INITIALIZED__ = false;
            }
        });

        Logger.log("SceneStatisticsWindow created.");
        this.updateStatistics(); // Initial update on window creation
    }

    public updateStatistics() {
        try {
            this.statusSpan.element.textContent = ''; // Clear status message

            // FPS Calculation
            const currentTime = performance.now();
            this.frameCount++;
            if (currentTime - this.lastFrameTime >= 1000) {
                this.fps = this.frameCount;
                this.frameCount = 0;
                this.lastFrameTime = currentTime;
            }
            this.fpsSpan.element.textContent = `FPS: ${this.fps}`;

            // JS Heap Memory
            if (performance && performance.memory) {
                const totalHeap = (performance.memory.jsHeapSizeLimit / (1024 * 1024)).toFixed(2);
                const usedHeap = (performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(2);
                this.jsHeapTotalSpan.element.textContent = `JS Heap Total: ${totalHeap} MB`;
                this.jsHeapUsedSpan.element.textContent = `JS Heap Used: ${usedHeap} MB`;
            } else {
                this.jsHeapTotalSpan.element.textContent = `JS Heap Total: N/A`;
                this.jsHeapUsedSpan.element.textContent = `JS Heap Used: N/A`;
            }

            // Execution Times
            this.frameTimes.push(currentTime);
            const oneSecondAgo = currentTime - 1000;
            const tenSecondsAgo = currentTime - 10000;
            const thirtySecondsAgo = currentTime - 30000;

            this.frameTimes = this.frameTimes.filter(time => time >= thirtySecondsAgo);

            const calculateAverageExecutionTime = (startTime: number) => {
                const relevantFrames = this.frameTimes.filter(time => time >= startTime);
                if (relevantFrames.length < 2) return 0; // Need at least two frames to calculate a duration
                const totalDuration = relevantFrames[relevantFrames.length - 1] - relevantFrames[0];
                return totalDuration / (relevantFrames.length - 1);
            };

            const avgExecTime1s = calculateAverageExecutionTime(oneSecondAgo);
            const avgExecTime10s = calculateAverageExecutionTime(tenSecondsAgo);
            const avgExecTime30s = calculateAverageExecutionTime(thirtySecondsAgo);

            this.executionTime1sSpan.element.textContent = `Exec Time (1s): ${avgExecTime1s.toFixed(2)} ms`;
            this.executionTime10sSpan.element.textContent = `Exec Time (10s): ${avgExecTime10s.toFixed(2)} ms`;
            this.executionTime30sSpan.element.textContent = `Exec Time (30s): ${avgExecTime30s.toFixed(2)} ms`;

            let totalObjects = 0;
            let totalMeshes = 0;
            let totalPolygons = 0;

            RE.Runtime.scene.traverse((object) => {
                totalObjects++;
                if (object instanceof THREE.Mesh) {
                    totalMeshes++;
                    const geometry = object.geometry;
                    if (geometry.isBufferGeometry) {
                        if (geometry.index) {
                            totalPolygons += geometry.index.count / 3; // Indexed geometry
                        } else if (geometry.attributes.position) {
                            totalPolygons += geometry.attributes.position.count / 3; // Non-indexed geometry
                        }
                    }
                }
            });

            this.totalObjectsSpan.element.textContent = `Total Objects: ${totalObjects}`;
            this.totalMeshesSpan.element.textContent = `Total Meshes: ${totalMeshes}`;
            this.totalPolygonsSpan.element.textContent = `Total Polygons: ${totalPolygons.toLocaleString()}`;

            // Renderer Info
            if (RE.Runtime.renderer instanceof THREE.WebGLRenderer) {
                const rendererInfo = RE.Runtime.renderer.info;
                this.drawCallsSpan.element.textContent = `Draw Calls: ${rendererInfo.render.calls}`;
                this.geometriesSpan.element.textContent = `Geometries: ${rendererInfo.memory.geometries}`;
                this.texturesSpan.element.textContent = `Textures: ${rendererInfo.memory.textures}`;
                this.rendererTypeSpan.element.textContent = `Renderer: WebGL`;
            } else {
                this.drawCallsSpan.element.textContent = `Draw Calls: N/A`;
                this.geometriesSpan.element.textContent = `Geometries: N/A`;
                this.texturesSpan.element.textContent = `Textures: N/A`;
                this.rendererTypeSpan.element.textContent = `Renderer: N/A`;
                this.webGLVersionSpan.element.textContent = `WebGL Version: N/A`;
            }

        } catch (e) {
            this.totalObjectsSpan.element.textContent = `Total Objects: N/A`;
            this.totalMeshesSpan.element.textContent = `Total Meshes: N/A`;
            this.totalPolygonsSpan.element.textContent = `Total Polygons: N/A`;
            this.fpsSpan.element.textContent = `FPS: N/A`;
            this.drawCallsSpan.element.textContent = `Draw Calls: N/A`;
            this.geometriesSpan.element.textContent = `Geometries: N/A`;
            this.texturesSpan.element.textContent = `Textures: N/A`;
            this.rendererTypeSpan.element.textContent = `Renderer: N/A`;
            this.webGLVersionSpan.element.textContent = `WebGL Version: N/A`;
            this.jsHeapTotalSpan.element.textContent = `JS Heap Total: N/A`;
            this.jsHeapUsedSpan.element.textContent = `JS Heap Used: N/A`;
            this.executionTime30sSpan.element.textContent = `Exec Time (30s): N/A`;
            this.executionTime10sSpan.element.textContent = `Exec Time (10s): N/A`;
            this.executionTime1sSpan.element.textContent = `Exec Time (1s): N/A`;
            this.statusSpan.element.textContent = 'No active scene or renderer for statistics.';
            Logger.log("Error calculating scene statistics: " + e);
        }
    }
}

class SceneStatisticsWindow extends Window<WindowProps> {
    constructor(props: WindowProps) {
        super(props);
    }

    // No custom header elements needed for now, but can be added later if required.
    protected addCustomHeaderElements(controlsContainer: HTMLElement) {
        // Example:
        // const customElement = new Container({ text: "Custom Header" });
        // controlsContainer.prepend(customElement.element);
    }
}

@RE.registerComponent
export default class SceneStatisticsComponent extends RE.Component {
    static isEditorComponent = true;

    private manager: SceneStatisticsManager;

    start() {


        Logger.log("SceneStatisticsComponent.start() called.");
        // Only initialize if not already initialized to prevent multiple instances
        if (window.__MATE_SCENESTATS_INITIALIZED__) {
            Logger.log("SceneStatisticsComponent already initialized.");
            return;
        }
        window.__MATE_SCENESTATS_INITIALIZED__ = true;
        this.manager = new SceneStatisticsManager();
        Logger.log("Scene Statistics Component Initialized.");



    }

    update() {
            if (this.manager) {
        // Continuous updates are needed for performance metrics
            this.manager.updateStatistics();
            }
    }

    // Optional: Clean up on stop if needed, though for editor components,
    // the window typically persists until closed by the user.
    // RE.Runtime.onStop(() => {
    //     if (this.manager) {
    //         // Dispose of window or other resources if necessary
    //     }
    // });
}
