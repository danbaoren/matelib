import * as RE from 'rogue-engine';
import * as THREE from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';

/**
 * Defines the types of assets that can be managed.
 * - `texture`: Image files (png, jpg, etc.) loaded as a THREE.Texture.
 * - `audio`: Sound files (mp3, wav, etc.) loaded as an AudioBuffer.
 * - `json`: JSON data files, parsed into a JavaScript object.
 * - `binary`: Any file loaded as an ArrayBuffer (e.g., for custom parsing).
 * - `text`: Plain text files.
 * - `video`: Video files (mp4, webm, etc.) loaded as an object URL for use in <video> tags.
 * - `gif`: GIF files, loaded as an object URL for use in <img> tags.
 * - `font`: Font files (ttf, woff, etc.) loaded via @font-face.
 * - `css`: CSS files, loaded and applied to the document.
 * - `gltf`: 3D models in GLTF or GLB format, with support for Draco compression.
 */
type AssetType = 'texture' | 'audio' | 'json' | 'binary' | 'text' | 'video' | 'gif' | 'font' | 'css' | 'gltf';

interface AssetInfo {
    name: string;
    path: string;
    type: AssetType;
}

interface AssetBundle {
    name: string;
    assets: AssetInfo[];
}

interface Asset {
    name: string;
    path: string;
    type: AssetType;
    data: any;
    group: string;
}

/**
 * # AssetManager - A comprehensive tool for loading, caching, and managing project assets.
 * Provides a unified interface for handling various asset types, from textures and audio
 * to videos and stylesheets. Also includes a utility for downloading content as a file.
 */
export class AssetManager {
    private static cache: { [path: string]: Asset } = {};
    private static gltfLoader = new GLTFLoader();
    private static dracoLoader = new DRACOLoader();
    private static audioContext: AudioContext;

    /**
     * Returns the shared AudioContext instance, creating it if it doesn't exist.
     * @returns The shared AudioContext.
     */
    public static getAudioContext(): AudioContext {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        return this.audioContext;
    }

    /**
     * Sets the path to the Draco decoder files. This is required for loading Draco-compressed models.
     * @param path The path to the folder containing the Draco decoder files (e.g., 'libs/draco/').
     * @example
     * MATE.assets.setDracoDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
     */
    public static setDracoDecoderPath(path: string): void {
        this.dracoLoader.setDecoderPath(path);
        this.gltfLoader.setDRACOLoader(this.dracoLoader);
    }

    /**
     * Loads a list of assets and stores them in the cache.
     * @param assetsToLoad An array of objects, each specifying the name, path, and type of the asset to load.
     * @param group The group to assign the assets to. Defaults to "none".
     * @param onProgress A callback function that receives the loading progress as a percentage.
     * @example
     * MATE.assets.load([
     *   { name: 'playerTexture', path: 'Textures/player.png', type: 'texture' },
     *   { name: 'levelData', path: 'Data/level1.json', type: 'json' },
     *   { name: 'playerModel', path: 'Models/player.glb', type: 'gltf' }
     * ], "level1", (progress) => {
     *   console.log(`Loading: ${progress}%`);
     *   const loadingBar = document.getElementById('loading-bar');
     *   if (loadingBar) loadingBar.style.width = `${progress}%`;
     * });
     */
    public static async load(
        assetsToLoad: AssetInfo[],
        group: string = "none",
        onProgress?: (progress: number) => void
    ): Promise<void> {
        let loadedCount = 0;
        const totalCount = assetsToLoad.length;

        // Initialize progress to 0%
        if (onProgress) {
            onProgress(0);
        }

        const promises = assetsToLoad.map(async (assetInfo) => {
            try {
                await this.loadAsset(assetInfo.name, assetInfo.path, assetInfo.type, group);
            } finally {
                loadedCount++;
                if (onProgress) {
                    const progress = (loadedCount / totalCount) * 100;
                    onProgress(progress);
                }
            }
        });

        await Promise.all(promises);
    }

    /**
     * Loads an asset bundle from a JSON file and caches its assets.
     * The JSON file should contain an array of asset definitions.
     * @param bundlePath The path to the JSON bundle file.
     * @param group The group to assign the assets to. Defaults to the bundle's name.
     * @param onProgress A callback function that receives the loading progress as a percentage.
     * @returns A Promise that resolves when all assets in the bundle are loaded.
     * @example
     * MATE.assets.loadBundle('Bundles/myBundle.json', 'myGameBundle', (progress) => {
     *   console.log(`Bundle Loading: ${progress}%`);
     * });
     */
    public static async loadBundle(
        bundlePath: string,
        group?: string,
        onProgress?: (progress: number) => void
    ): Promise<void> {
        try {
            const fullBundlePath = RE.getStaticPath(bundlePath);
            const bundle: AssetBundle = await (await fetch(fullBundlePath)).json();

            if (!group) {
                group = bundle.name || bundlePath; // Use bundle name or path as group if not provided
            }

            await this.load(bundle.assets, group, onProgress);
            console.log(`mate.AssetManager: Bundle "${bundle.name || bundlePath}" loaded successfully.`);
        } catch (error) {
            console.error(`mate.AssetManager: Failed to load bundle from "${bundlePath}".`, error);
            throw error; // Re-throw the error for better debugging
        }
    }

    /**
     * Creates and loads an asset bundle directly from a provided AssetBundle object.
     * This allows for programmatic bundle definition without needing a separate JSON file.
     * @param bundle The AssetBundle object containing the assets to load.
     * @param group The group to assign the assets to. Defaults to the bundle's name.
     * @param onProgress A callback function that receives the loading progress as a percentage.
     * @returns A Promise that resolves when all assets in the bundle are loaded.
     * @example
     * const myBundle = {
     *   name: "ProgrammaticAssets",
     *   assets: [
     *     { name: 'textureA', path: 'Textures/textureA.png', type: 'texture' },
     *     { name: 'dataB', path: 'Data/dataB.json', type: 'json' }
     *   ]
     * };
     * MATE.assets.createBundle(myBundle, 'myProgrammaticGroup', (progress) => {
     *   console.log(`Programmatic Bundle Loading: ${progress}%`);
     * });
     */
    public static async createBundle(
        bundle: AssetBundle,
        group?: string,
        onProgress?: (progress: number) => void
    ): Promise<void> {
        if (!group) {
            group = bundle.name; // Use bundle name as group if not provided
        }
        await this.load(bundle.assets, group, onProgress);
        console.log(`mate.AssetManager: Programmatic bundle "${bundle.name}" loaded successfully.`);
    }

    /**
     * Retrieves a loaded asset from the cache by its unique name.
     * @param name The unique name given to the asset during loading.
     * @returns The asset's data, or null if not found.
     * @example
     * const playerModel = MATE.assets.get<GLTF>('playerModel');
     * if (playerModel) {
     *   RE.Runtime.scene.add(playerModel.scene);
     * }
     */
    public static get<T>(name: string): T | null {
        const asset = Object.values(this.cache).find(a => a.name === name);
        return asset ? asset.data as T : null;
    }

    /**
     * Unloads a single asset from the cache and disposes of it.
     * @param name The unique name of the asset to unload.
     * @example
     * MATE.assets.unload('playerTexture');
     */
    public static unload(name: string): void {
        const assetEntry = Object.entries(this.cache).find(([, asset]) => asset.name === name);
        if (assetEntry) {
            const [path, asset] = assetEntry;
            this.disposeAsset(asset);
            delete this.cache[path];
        }
    }

    /**
     * Unloads all assets belonging to a specific group.
     * @param groupName The name of the group to unload.
     * @example
     * MATE.assets.unloadGroup('level1');
     */
    public static unloadGroup(groupName: string): void {
        for (const path in this.cache) {
            if (this.cache[path].group === groupName) {
                this.disposeAsset(this.cache[path]);
                delete this.cache[path];
            }
        }
    }

    /**
     * Clears the entire asset cache and disposes of all loaded assets.
     * @example
     * MATE.assets.dispose();
     */
    public static dispose(): void {
        for (const path in this.cache) {
            this.disposeAsset(this.cache[path]);
        }
        this.cache = {};
    }

    private static disposeAsset(asset: Asset): void {
        switch (asset.type) {
            case 'texture':
                (asset.data as THREE.Texture).dispose();
                break;
            case 'video':
            case 'gif':
                URL.revokeObjectURL(asset.data);
                break;
            case 'css':
                (asset.data as HTMLStyleElement).remove();
                break;
            case 'gltf':
                const gltf = asset.data as GLTF;
                gltf.scene.traverse(object => {
                    if (object instanceof THREE.Mesh) {
                        object.geometry.dispose();
                        if (Array.isArray(object.material)) {
                            object.material.forEach(material => material.dispose());
                        } else {
                            object.material.dispose();
                        }
                    }
                });
                break;
            // Audio, JSON, binary, text, and font assets don't require special disposal
        }
    }

    private static async loadAsset(name: string, path: string, type: AssetType, group: string): Promise<void> {
        if (this.cache[path]) {
            return;
        }

        const fullPath = RE.getStaticPath(path);
        let data: any;

        try {
            switch (type) {
                case 'texture':
                    data = await new THREE.TextureLoader().loadAsync(fullPath);
                    break;
                case 'audio':
                    const response = await fetch(fullPath);
                    const arrayBuffer = await response.arrayBuffer();
                    const audioContext = this.getAudioContext();
                    data = await audioContext.decodeAudioData(arrayBuffer);
                    break;
                case 'json':
                    data = await (await fetch(fullPath)).json();
                    break;
                case 'binary':
                    data = await (await fetch(fullPath)).arrayBuffer();
                    break;
                case 'text':
                    data = await (await fetch(fullPath)).text();
                    break;
                case 'video':
                case 'gif':
                    const videoBlob = await (await fetch(fullPath)).blob();
                    data = URL.createObjectURL(videoBlob);
                    break;
                case 'font':
                    const fontFace = new FontFace(name, `url(${fullPath})`);
                    await fontFace.load();
                    (document.fonts as any).add(fontFace);
                    data = fontFace;
                    break;
                case 'css':
                    const cssText = await (await fetch(fullPath)).text();
                    const styleElement = document.createElement('style');
                    styleElement.textContent = cssText;
                    document.head.appendChild(styleElement);
                    data = styleElement;
                    break;
                case 'gltf':
                    data = await this.gltfLoader.loadAsync(fullPath);
                    break;
            }
            this.cache[path] = { name, path, type, data, group };
        } catch (error) {
            console.error(`mate.AssetManager: Failed to load asset "${name}" from "${path}".`, error);
            throw error; // Re-throw the error for better debugging
        }
    }

    /**
     * Triggers a browser download for any given content.
     * @param content The data to be downloaded (e.g., string, Blob, ArrayBuffer, JSON object).
     * @param filename The name of the file to be saved.
     * @param mimeType Optional. The MIME type of the content. If not provided, it will be inferred.
     * @example
     * // Download a JSON object
     * MATE.assets.download({ a: 1, b: 2 }, 'my-data.json');
     *
     * // Download plain text
     * MATE.assets.download('Hello, world!', 'greeting.txt');
     */
    public static download(content: any, filename: string, mimeType?: string): void {
        const blob = this.toBlob(content, mimeType);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Downloads content as a plain text file.
     * @param content The string content to download.
     * @param filename The name of the file (e.g., 'document.txt').
     */
    public static downloadText(content: string, filename: string): void {
        this.download(content, filename, 'text/plain');
    }

    /**
     * Downloads a JavaScript object as a JSON file.
     * @param content The object to serialize and download.
     * @param filename The name of the file (e.g., 'data.json').
     */
    public static downloadJson(content: object, filename: string): void {
        this.download(content, filename, 'application/json');
    }

    /**
     * Downloads binary data as a file.
     * @param content The ArrayBuffer or ArrayBufferView data to download.
     * @param filename The name of the file.
     */
    public static downloadBinary(content: ArrayBuffer | ArrayBufferView, filename: string): void {
        this.download(content, filename, 'application/octet-stream');
    }

    /**
     * Downloads the content of a canvas as an image file.
     * @param canvas The HTMLCanvasElement to download.
     * @param filename The name of the image file (e.g., 'capture.png').
     * @param type The image format (e.g., 'image/png', 'image/jpeg').
     * @param quality For 'image/jpeg', a number between 0 and 1 indicating image quality.
     */
    public static async downloadCanvas(canvas: HTMLCanvasElement, filename: string, type: string = 'image/png', quality?: number): Promise<void> {
        const blob = await this.createCanvasBlob(canvas, type, quality);
        if (blob) {
            this.download(blob, filename);
        } else {
            console.error("mate.AssetManager: Failed to create blob from canvas.");
        }
    }

    /**
     * Finds a canvas and downloads its content as an image. This is a convenient wrapper around `downloadCanvas`.
     * @param target The canvas to download. Can be an HTMLCanvasElement, an HTMLElement that contains a canvas, or a CSS selector string for either.
     * @param filename The name for the downloaded file.
     * @param type The image format (e.g., 'image/png').
     * @param quality For 'image/jpeg', a number between 0 and 1.
     * @example
     * // Download by passing the canvas element directly
     * const myCanvas = document.getElementById('game-canvas');
     * MATE.assets.downloadScreenshot(myCanvas, 'screenshot.png');
     *
     * // Download by passing a container element
     * const gameContainer = document.getElementById('game-container');
     * MATE.assets.downloadScreenshot(gameContainer, 'screenshot.png');
     *
     * // Download using a CSS selector
     * MATE.assets.downloadScreenshot('#game-canvas', 'screenshot.png');
     */
    public static async screenshotCanvas(target: HTMLCanvasElement | HTMLElement | string, filename: string, type: string = 'image/png', quality?: number): Promise<void> {
        let canvas: HTMLCanvasElement | null = null;

        if (target instanceof HTMLCanvasElement) {
            canvas = target;
        } else if (target instanceof HTMLElement) {
            canvas = target.tagName === 'CANVAS' ? (target as HTMLCanvasElement) : target.querySelector('canvas');
        } else if (typeof target === 'string') {
            const element = document.querySelector(target);
            if (element) {
                if (element instanceof HTMLCanvasElement) {
                    canvas = element;
                } else if (element instanceof HTMLElement) {
                    canvas = element.querySelector('canvas');
                }
            }
        }

        if (canvas) {
            await this.downloadCanvas(canvas, filename, type, quality);
        } else {
            console.error(`mate.AssetManager.downloadScreenshot: Could not find a canvas element for the given target:`, target);
        }
    }

    /**
     * Captures and downloads a scene by forcing a re-render. This is a robust method for taking
     * screenshots of WebGL scenes, especially when `preserveDrawingBuffer` is `false`, as it
     * captures the frame immediately after rendering.
     * @param renderer The THREE.WebGLRenderer instance.
     * @param scene The THREE.Scene to render.
     * @param camera The THREE.Camera to use for rendering.
     * @param filename The name for the downloaded file.
     * @param type The image format (e.g., 'image/png').
     * @param quality For 'image/jpeg', a number between 0 and 1.
     */
    public static async screenshot(
        renderer: THREE.WebGLRenderer = RE.Runtime.renderer,
        scene: THREE.Scene = RE.Runtime.scene,
        camera: THREE.Camera = RE.Runtime.camera,
        filename: string = "screenshot",
        type: string = 'image/png',
        quality?: number
    ): Promise<void> {
        // Force a render of the scene to populate the drawing buffer right before capture.
        renderer.render(scene, camera);

        const dataUrl = renderer.domElement.toDataURL(type, quality);
        this.showScreenshotPreview(dataUrl);

        // Immediately capture the canvas content.
        await this.downloadCanvas(renderer.domElement, filename, type, quality);
    }

private static showScreenshotPreview(dataUrl: string) {
    const existingPreview = document.getElementById('screenshot-preview-container');
    if (existingPreview) {
        document.body.removeChild(existingPreview);
    }

    const previewContainer = document.createElement('div');
    previewContainer.id = 'screenshot-preview-container';
    previewContainer.style.position = 'fixed';
    previewContainer.style.top = '20px';
    previewContainer.style.left = '20px';
    previewContainer.style.zIndex = '10000';
    previewContainer.style.borderRadius = '4px'; // Increased border-radius for a softer, more modern look
    previewContainer.style.backgroundColor = 'rgba(28, 28, 30, 0.9)'; // Darker background for more contrast and depth
    previewContainer.style.padding = '12px'; // Slightly increased padding
    previewContainer.style.boxShadow = '0 8px 25px rgba(0,0,0,0.7)'; // Deeper, more pronounced shadow
    previewContainer.style.backdropFilter = 'blur(10px)'; // Stronger blur effect
    previewContainer.style.border = '1px solid rgba(255, 255, 255, 0.15)'; // Sharper, more visible border

    const img = document.createElement('img');
    img.src = dataUrl;
    img.style.maxWidth = '300px';
    img.style.maxHeight = '230px';
    img.style.display = 'block';
    img.style.borderRadius = '1px'; // Consistent, slightly rounded corners
    img.style.border = '1px solid rgba(255, 255, 255, 0.1)'; // Subtle border for the image

    // The close button has been removed as per your request. The preview now auto-hides after 5 seconds.

    previewContainer.appendChild(img);
    document.body.appendChild(previewContainer);

    // Auto-hides the preview after 5 seconds, as the close button is removed.
    setTimeout(() => {
        if (document.body.contains(previewContainer)) {
            document.body.removeChild(previewContainer);
        }
    }, 5000);
}


    /**
     * Finds and logs all canvas elements on the page, returning them as a list.
     * This is a useful debugging tool to identify canvases for screenshotting.
     * @returns A NodeListOf<HTMLCanvasElement> containing all found canvases.
     * @example
     * // Log all canvases to the console and get the list
     * const allCanvases = MATE.assets.getCanvases();
     */
    public static getCanvases(): NodeListOf<HTMLCanvasElement> {
        const canvases = document.querySelectorAll('canvas');

        if (canvases.length === 0) {
            console.log("mate.AssetManager.getCanvases: No canvas elements found on the page.");
            return canvases;
        }

        console.log(`%c[mate.AssetManager.getCanvases] Found ${canvases.length} canvas element(s) on the page.`, "color: #2196F3; font-weight: bold;");

        const logData = Array.from(canvases).map((canvas, index) => {
            return {
                'Index': index,
                'Element': canvas,
                'ID': canvas.id ? `#${canvas.id}` : '(none)',
                'Classes': canvas.className ? `.${canvas.className.split(' ').join('.')}` : '(none)',
                'Dimensions': `${canvas.width} x ${canvas.height}`,
                'Parent': canvas.parentElement || '(no parent)',
            };
        });

        console.table(logData);

        return canvases;
    }

    /**
     * Creates a File object from various content types. This is useful for working
     * with APIs that require a File object, like FormData for uploads.
     * @param content The data for the file.
     * @param filename The name of the file.
     * @param mimeType Optional. The MIME type of the content.
     * @returns A File object.
     */
    public static createFile(content: any, filename: string, mimeType?: string): File {
        const blob = this.toBlob(content, mimeType);
        return new File([blob], filename, { type: blob.type });
    }

    /**
     * Creates a Blob from a canvas element.
     * @param canvas The HTMLCanvasElement to convert.
     * @param type The image format (e.g., 'image/png').
     * @param quality For 'image/jpeg', a number between 0 and 1.
     * @returns A Promise that resolves with the Blob or null if conversion fails.
     */
    public static async createCanvasBlob(canvas: HTMLCanvasElement, type: string = 'image/png', quality?: number): Promise<Blob | null> {
        // For WebGL canvases, toBlob can be unreliable if the buffer is cleared before the async callback runs.
        // Using toDataURL is synchronous and captures the buffer's state immediately.
        // While slightly less memory-efficient, it's more robust for capturing frames.
        if (canvas.getContext('webgl') || canvas.getContext('webgl2')) {
            try {
                const dataUrl = canvas.toDataURL(type, quality);
                if (!dataUrl || dataUrl === 'data:,') { // Check for empty data URL
                    console.error("mate.AssetManager: canvas.toDataURL() returned an empty string. Is the canvas blank, not rendered yet, or tainted?");
                    return null;
                }
                // Convert data URL to Blob
                const response = await fetch(dataUrl);
                return await response.blob();
            } catch (e) {
                console.error("mate.AssetManager: Failed to create blob from WebGL canvas. The canvas might be tainted by cross-origin data.", e);
                return null;
            }
        } else {
            // For 2D canvases, toBlob is generally fine and more performant.
            return new Promise(resolve => {
                canvas.toBlob(blob => resolve(blob), type, quality);
            });
        }
    }

    private static toBlob(content: any, mimeType?: string): Blob {
        if (content instanceof Blob) {
            return mimeType ? new Blob([content], { type: mimeType }) : content;
        }

        if (typeof content === 'string') {
            return new Blob([content], { type: mimeType || 'text/plain' });
        }

        if (content instanceof ArrayBuffer || ArrayBuffer.isView(content)) {
            return new Blob([content], { type: mimeType || 'application/octet-stream' });
        }

        if (typeof content === 'object' && content !== null) {
            try {
                const json = JSON.stringify(content, null, 2);
                return new Blob([json], { type: mimeType || 'application/json' });
            } catch (e) {
                console.error("mate.AssetManager: Could not serialize object to JSON. Converting to string.", e);
            }
        }

        return new Blob([String(content)], { type: mimeType || 'text/plain' });
    }
}
