/*

You also have window["rogue-editor"] where you can access window["rogue-editor"].editorRuntime, same as RE.Runtime but in editing.

If you wanna go extra crazy here's the interface of window["rogue-editor"].Project  use at your own peril:

export declare class Project {
    static tags: {
        [tag: string]: string;
    };
    static setTags(...tags: string[]): void;
    static createTag(tag: string): void;
    static deleteTag(tag: string): void;
    static id: string;
    static path: string;
    static selectedObjects: Object3D[];
    static currentScene: Scene;
    static openedScenePath: string;
    static copySelectedObjects(): void;
    static pasteClipboardObjects(parent: Object3D, position?: Vector3, rotation?: Euler, scale?: Vector3): Object3D<import("three").Object3DEventMap>[];
    private static setCloneREFs;
    static createPrefab(object: Object3D): Object3D;
    static selectObject(...objects: Object3D[]): void;
    static loadPreviosSceneState(sceneJson: {
        assetConfigs: any;
        scene: any;
        skybox: any;
        components: any;
        initialCameraId: any;
    }): void;
    static loadScene(scene: Scene | any): void;
    static saveScene(path: string): void;
    static clearSelection(): void;
    static reselectObjects(): void;
}


createFolder: (path: string) => void;
createFile: (path: string, content: string) => Promise<void>;
deleteFile: (path: string) => Promise<void>;
renameFile: (oldPath:string, newPath: string) => void;
copyFile: (oldPath:string, newPath: string) => Promise<void>;
joinPath: (...args: string[]) => string;
pathExists: (path: string) => boolean;



const rogueEditorAPI = window["rogue-editor-api"];

let content = "";
// You can have it on /Static to get it with getStaticPath() or somewhere else where you can import it in your file.
let filePath = rogueEditorAPI.getProjectPath() + "/Static/MyFile.json";

rogueEditorAPI.createFile(filePath, content);



There's also window["rogue-editor"].loadFile() this is the function used to load stuff in the scene. May be useful but, thread carefully. You can send in any asset file within your project folder (models, prefabs, images, etc).

loadFile(path: string, onLoad: (object: Object3D | Texture | Material | AudioAsset | Prefab | AnimationClip) => void



*/

import * as THREE from 'three';
import * as RE from 'rogue-engine';

// Access browser-only APIs safely. These will be undefined outside the Rogue Editor.
const editorAPI = (window as any)["rogue-editor-api"];
const projectAPI = (window as any)["rogue-editor"]?.Project;
const editorUtils = (window as any)["rogue-editor"];

export class rogueEditorAPI {
    // --- File System (from rogue-editor-api) ---

    /**
     * Gets the absolute path to the current Rogue Engine project.
     * @returns The project path string, or undefined if not in the editor.
     */
    public static getProjectPath(): string | undefined {
        if (!editorAPI) return undefined;
        return editorAPI.getProjectPath();
    }

    public static getStatic(path: string): string | undefined {
        return RE.getStaticPath(path);
    }

    /**
     * Reads a file from the Static directory at runtime by fetching its URL.
     * @param path The path to the file relative to the Static directory (e.g., "MyData/config.json").
     * @returns A promise that resolves to the file content as a string, or null if the file cannot be read.
     */
    public static async readStaticFile(path: string): Promise<string | null> {
        const url = RE.getStaticPath(path);
        if (!url) {
            console.error(`[MATE] Could not get static path for: ${path}`);
            return null;
        }

        try {
            const response = await fetch(url);
            if (response.ok) {
                return await response.text();
            }
            console.error(`[MATE] Failed to fetch static file. Status: ${response.status}`, url);
            return null;
        } catch (e) {
            console.error(`[MATE] Error fetching static file at ${path}:`, e);
            return null;
        }
    }

    /**
     * Joins multiple path segments into a single, platform-correct path.
     * @param args Path segments to join.
     * @returns The combined path string, or undefined if not in the editor.
     */
    public static joinPath(...args: string[]): string | undefined {
        if (!editorAPI) return undefined;
        return editorAPI.joinPath(...args);
    }

    /**
     * Creates a folder at the given path relative to the project root.
     * @param projectRelativePath The path relative to the project root (e.g., "/Assets/NewFolder").
     */
    public static createFolder(projectRelativePath: string): void {
        if (!editorAPI) return;
        const projectPath = this.getProjectPath();
        if (!projectPath) return;
        const fullPath = editorAPI.joinPath(projectPath, projectRelativePath);
        editorAPI.createFolder(fullPath);
    }

    /**
     * Creates a file with the given content at the path relative to the project root.
     * @param projectRelativePath The path for the new file (e.g., "/Static/MyFile.json").
     * @param content The content to write to the file.
     */
    public static async createFile(projectRelativePath: string, content: string): Promise<void> {
        if (!editorAPI) return;
        const projectPath = this.getProjectPath();
        if (!projectPath) return;
        const fullPath = editorAPI.joinPath(projectPath, projectRelativePath);
        await editorAPI.createFile(fullPath, content);
    }

    /**
     * Deletes a file at the given path relative to the project root.
     * @param projectRelativePath The path of the file to delete.
     */
    public static async deleteFile(projectRelativePath: string): Promise<void> {
        if (!editorAPI) return;
        const projectPath = this.getProjectPath();
        if (!projectPath) return;
        const fullPath = editorAPI.joinPath(projectPath, projectRelativePath);
        await editorAPI.deleteFile(fullPath);
    }

    /**
     * Renames or moves a file. Paths are relative to the project root.
     * @param oldProjectRelativePath The current path of the file.
     * @param newProjectRelativePath The new path for the file.
     */
    public static renameFile(oldProjectRelativePath: string, newProjectRelativePath: string): void {
        if (!editorAPI) return;
        const projectPath = this.getProjectPath();
        if (!projectPath) return;
        const oldFullPath = editorAPI.joinPath(projectPath, oldProjectRelativePath);
        const newFullPath = editorAPI.joinPath(projectPath, newProjectRelativePath);
        editorAPI.renameFile(oldFullPath, newFullPath);
    }

    /**
     * Copies a file. Paths are relative to the project root.
     * @param oldProjectRelativePath The path of the file to copy.
     * @param newProjectRelativePath The path for the new copied file.
     */
    public static async copyFile(oldProjectRelativePath: string, newProjectRelativePath: string): Promise<void> {
        if (!editorAPI) return;
        const projectPath = this.getProjectPath();
        if (!projectPath) return;
        const oldFullPath = editorAPI.joinPath(projectPath, oldProjectRelativePath);
        const newFullPath = editorAPI.joinPath(projectPath, newProjectRelativePath);
        await editorAPI.copyFile(oldFullPath, newFullPath);
    }

    /**
     * Checks if a path exists. Path is relative to the project root.
     * @param projectRelativePath The path to check.
     * @returns True if the path exists, otherwise false.
     */
    public static pathExists(projectRelativePath: string): boolean {
        if (!editorAPI) return false;
        const projectPath = this.getProjectPath();
        if (!projectPath) return false;
        const fullPath = editorAPI.joinPath(projectPath, projectRelativePath);
        return editorAPI.pathExists(fullPath);
    }

    /**
     * Writes a binary file to the project.
     * @param projectRelativePath The path for the new file (e.g., "/Assets/MyFile.bin").
     * @param data The data to write to the file.
     */
    public static async writeBinaryFile(projectRelativePath: string, data: string | ArrayBuffer | Blob): Promise<void> {
        if (!editorAPI) return;

        const projectPath = this.getProjectPath();
        if (!projectPath) return;

        const fullPath = editorAPI.joinPath(projectPath, projectRelativePath);

        let buffer: Uint8Array;

        if (typeof data === 'string') {
            if (data.startsWith('data:')) {
                const blob = await (await fetch(data)).blob();
                const arrayBuffer = await blob.arrayBuffer();
                buffer = new Uint8Array(arrayBuffer);
            } else {
                buffer = new TextEncoder().encode(data);
            }
        } else if (data instanceof Blob) {
            const arrayBuffer = await data.arrayBuffer();
            buffer = new Uint8Array(arrayBuffer);
        } else if (data instanceof ArrayBuffer) {
            buffer = new Uint8Array(data);
        } else {
            throw new Error("Invalid data type for writeBinaryFile. Must be a string, ArrayBuffer, or Blob.");
        }

        await editorAPI.outputFile(fullPath, buffer);
    }

    // --- Project Management (from rogue-editor.Project) ---

    /**
     * Gets all registered tags in the project.
     * @returns A dictionary of tags, or undefined if not in the editor.
     */
    public static getTags(): { [tag: string]: string } | undefined {
        if (!projectAPI) return undefined;
        return projectAPI.tags;
    }

    /**
     * Overwrites the project's tags with the given set.
     * @param tags The tags to set.
     */
    public static setTags(...tags: string[]): void {
        if (!projectAPI) return;
        projectAPI.setTags(...tags);
    }

    /**
     * Creates a new tag in the project.
     * @param tag The tag name to create.
     */
    public static createTag(tag: string): void {
        if (!projectAPI) return;
        projectAPI.createTag(tag);
    }

    /**
     * Deletes a tag from the project.
     * @param tag The tag name to delete.
     */
    public static deleteTag(tag: string): void {
        if (!projectAPI) return;
        projectAPI.deleteTag(tag);
    }

    /**
     * Gets the currently selected objects in the editor's hierarchy.
     */
    public static getSelectedObjects(): THREE.Object3D[] {
        if (!projectAPI) return [];
        return projectAPI.selectedObjects;
    }

    /**
     * Gets the path of the currently opened scene file.
     */
    public static getOpenedScenePath(): string | undefined {
        if (!projectAPI) return undefined;
        return projectAPI.openedScenePath;
    }

    /**
     * Copies the currently selected objects to the clipboard.
     */
    public static copySelectedObjects(): void {
        if (!projectAPI) return;
        projectAPI.copySelectedObjects();
    }

    /**
     * Pastes objects from the clipboard into the scene.
     * @param parent The parent object to paste into.
     * @param position Optional position for the pasted objects.
     * @param rotation Optional rotation for the pasted objects.
     * @param scale Optional scale for the pasted objects.
     * @returns An array of the newly pasted objects.
     */
    public static pasteClipboardObjects(parent: THREE.Object3D, position?: THREE.Vector3, rotation?: THREE.Euler, scale?: THREE.Vector3): THREE.Object3D[] {
        if (!projectAPI) return [];
        return projectAPI.pasteClipboardObjects(parent, position, rotation, scale);
    }

    /**
     * Creates a prefab from a given Object3D within the editor.
     * Note: This function's exact behavior (e.g., where the prefab is saved) is determined by the editor's implementation.
     * @param object The Object3D to use as the source for the prefab.
     * @returns The root Object3D of the newly created prefab, or undefined if not in the editor.
     */
    public static createPrefab(object: THREE.Object3D): THREE.Object3D | undefined {
        if (!projectAPI) return undefined;
        return projectAPI.createPrefab(object);
    }

    /**
     * Selects one or more objects in the editor's hierarchy.
     * @param objects The objects to select.
     */
    public static selectObject(...objects: THREE.Object3D[]): void {
        if (!projectAPI) return;
        projectAPI.selectObject(...objects);
    }

    /**
     * Saves the current scene to a file.
     * @param projectRelativePath The path relative to the project root to save the scene to.
     */
    public static saveScene(projectRelativePath: string): void {
        if (!projectAPI || !editorAPI) return;
        const projectPath = this.getProjectPath();
        if (!projectPath) return;
        const fullPath = editorAPI.joinPath(projectPath, projectRelativePath);
        projectAPI.saveScene(fullPath);
    }

    /**
     * Clears the current selection in the editor.
     */
    public static clearSelection(): void {
        if (!projectAPI) return;
        projectAPI.clearSelection();
    }

    // --- Asset Loading (from rogue-editor) ---

    /**
     * Loads an asset file from within the project.
     * @param projectRelativePath The path to the asset file.
     * @param onLoad A callback function that receives the loaded asset.
     */
    public static loadFile(projectRelativePath: string, onLoad: (object: THREE.Object3D | THREE.Texture | THREE.Material | RE.AudioAsset | RE.Prefab | THREE.AnimationClip) => void): void {
        if (!editorUtils || !editorAPI) return;
        const projectPath = this.getProjectPath();
        if (!projectPath) return;
        const fullPath = editorAPI.joinPath(projectPath, projectRelativePath);
        editorUtils.loadFile(fullPath, onLoad);
    }

    public static copyFileSync(source: string, destination: string): void {
        if (!editorAPI) return;
        editorAPI.copyFileSync(source, destination);
    }

    public static openFile(path: string): void {
        if (!editorAPI) return;
        editorAPI.openFile(path);
    }

    public static showFileInFolder(path: string): void {
        if (!editorAPI) return;
        editorAPI.showFileInFolder(path);
    }

    public static readFileBuffer(path: string): Promise<Buffer> {
        if (!editorAPI) return Promise.resolve(Buffer.from(""));
        return editorAPI.readFileBuffer(path);
    }

    public static readBuildFile(path: string): Promise<string> {
        if (!editorAPI) return Promise.resolve("");
        return editorAPI.readBuildFile(path);
    }

    public static readDir(path: string): Promise<string[]> {
        if (!editorAPI) return Promise.resolve([]);
        return editorAPI.readDir(path);
    }

    public static readDirAsync(path: string): Promise<string[]> {
        if (!editorAPI) return Promise.resolve([]);
        return editorAPI.readDirAsync(path);
    }

    public static getFiles(path: string): Promise<string[]> {
        if (!editorAPI) return Promise.resolve([]);
        return editorAPI.getFiles(path);
    }

    public static fsStat(path: string): Promise<any> {
        if (!editorAPI) return Promise.resolve(null);
        return editorAPI.fsStat(path);
    }

    public static showOpenDialog(options: any): Promise<any> {
        if (!editorAPI) return Promise.resolve(null);
        return editorAPI.showOpenDialog(options);
    }

    public static watchPath(path: string, callback: (event: string, path: string) => void): void {
        if (!editorAPI) return;
        editorAPI.watchPath(path, callback);
    }

    public static clearPathWatchers(): void {
        if (!editorAPI) return;
        editorAPI.clearPathWatchers();
    }

    //public static writeFile(path: string, content: string): Promise<void> {
    //    if (!editorAPI) return Promise.resolve();
    //    return editorAPI.writeFile(path, content);
    //}

    public static async writeFile(projectRelativePath: string, content: string): Promise<void> {
        if (!editorAPI) return;
        const projectPath = this.getProjectPath();
        if (!projectPath) return;
        const fullPath = editorAPI.joinPath(projectPath, projectRelativePath);
        await editorAPI.writeFile(fullPath, content);
    }
    

    public static outputFile(path: string, content: string): Promise<void> {
        if (!editorAPI) return Promise.resolve();
        return editorAPI.outputFile(path, content);
    }

    public static readJSON(path: string): Promise<any> {
        if (!editorAPI) return Promise.resolve(null);
        return editorAPI.readJSON(path);
    }

    public static readJSONAsync(path: string): Promise<any> {
        if (!editorAPI) return Promise.resolve(null);
        return editorAPI.readJSONAsync(path);
    }

    public static writeJSON(path: string, content: any): Promise<void> {
        if (!editorAPI) return Promise.resolve();
        return editorAPI.writeJSON(path, content);
    }

    public static appQuit(): void {
        if (!editorAPI) return;
        editorAPI.appQuit();
    }

    public static installPackage(path: string): Promise<void> {
        if (!editorAPI) return Promise.resolve();
        return editorAPI.installPackage(path);
    }

    public static installRemotePackage(url: string): Promise<void> {
        if (!editorAPI) return Promise.resolve();
        return editorAPI.installRemotePackage(url);
    }

    public static getDownloadProgress(): any {
        if (!editorAPI) return null;
        return editorAPI.getDownloadProgress();
    }

    public static isInstalling(): boolean {
        if (!editorAPI) return false;
        return editorAPI.isInstalling();
    }

    public static createPackageFile(path: string): Promise<void> {
        if (!editorAPI) return Promise.resolve();
        return editorAPI.createPackageFile(path);
    }

    public static runBundleProcess(path: string): void {
        if (!editorAPI) return;
        editorAPI.runBundleProcess(path);
    }

    public static openProject(path: string): void {
        if (!editorAPI) return;
        editorAPI.openProject(path);
    }

    public static createProject(path: string): void {
        if (!editorAPI) return;
        editorAPI.createProject(path);
    }

    public static startFileServer(path: string): void {
        if (!editorAPI) return;
        editorAPI.startFileServer(path);
    }

    public static getDefaultPath(): string {
        if (!editorAPI) return "";
        return editorAPI.getDefaultPath();
    }

    public static isValidNewProjectPath(path: string): boolean {
        if (!editorAPI) return false;
        return editorAPI.isValidNewProjectPath(path);
    }

    public static unmaximize(): void {
        if (!editorAPI) return;
        editorAPI.unmaximize();
    }

    public static setApplicationMenu(menu: any): void {
        if (!editorAPI) return;
        editorAPI.setApplicationMenu(menu);
    }

    public static getPlatform(): string {
        if (!editorAPI) return "";
        return editorAPI.getPlatform();
    }

    public static popContextMenu(menu: any): void {
        if (!editorAPI) return;
        editorAPI.popContextMenu(menu);
    }

    public static maximize(): void {
        if (!editorAPI) return;
        editorAPI.maximize();
    }

    public static isMaximized(): boolean {
        if (!editorAPI) return false;
        return editorAPI.isMaximized();
    }

    public static setBackgroundColor(color: string): void {
        if (!editorAPI) return;
        editorAPI.setBackgroundColor(color);
    }

    public static center(): void {
        if (!editorAPI) return;
        editorAPI.center();
    }

    public static setSize(width: number, height: number): void {
        if (!editorAPI) return;
        editorAPI.setSize(width, height);
    }

    public static setResizable(resizable: boolean): void {
        if (!editorAPI) return;
        editorAPI.setResizable(resizable);
    }

    public static openExternalURL(url: string): void {
        if (!editorAPI) return;
        editorAPI.openExternalURL(url);
    }

    public static urlExists(url: string): Promise<boolean> {
        if (!editorAPI) return Promise.resolve(false);
        return editorAPI.urlExists(url);
    }

    public static getAppPath(): string {
        if (!editorAPI) return "";
        return editorAPI.getAppPath();
    }

    public static getPathSep(): string {
        if (!editorAPI) return "";
        return editorAPI.getPathSep();
    }

    public static getBaseName(path: string): string {
        if (!editorAPI) return "";
        return editorAPI.getBaseName(path);
    }

    public static getLanIP(): string {
        if (!editorAPI) return "";
        return editorAPI.getLanIP();
    }

    public static getProtocol(): string {
        if (!editorAPI) return "";
        return editorAPI.getProtocol();
    }

    public static useHttps(): boolean {
        if (!editorAPI) return false;
        return editorAPI.useHttps();
    }

    public static getAppVersion(): string {
        if (!editorAPI) return "";
        return editorAPI.getAppVersion();
    }

    public static gzipFiles(files: string[]): Promise<void> {
        if (!editorAPI) return Promise.resolve();
        return editorAPI.gzipFiles(files);
    }

    public static copyToClipboard(text: string): void {
        if (!editorAPI) return;
        editorAPI.copyToClipboard(text);
    }

    public static electronIsDev(): boolean {
        if (!editorAPI) return false;
        return editorAPI.electronIsDev();
    }

    public static checkForUpdates(): void {
        if (!editorAPI) return;
        editorAPI.checkForUpdates();
    }

    public static setRecentProjects(projects: string[]): void {
        if (!editorAPI) return;
        editorAPI.setRecentProjects(projects);
    }

    public static bundleProcessEnded(): void {
        if (!editorAPI) return;
        editorAPI.bundleProcessEnded();
    }

    public static getPreview(): any {
        if (!editorAPI) return null;
        return editorAPI.getPreview();
    }

    public static sendPreview(data: any): void {
        if (!editorAPI) return;
        editorAPI.sendPreview(data);
    }

    public static refreshWorker(): void {
        if (!editorAPI) return;
        editorAPI.refreshWorker();
    }

    public static setAssetPath(path: string): void {
        if (!editorAPI) return;
        editorAPI.setAssetPath(path);
    }

    public static setProjectPath(path: string): void {
        if (!editorAPI) return;
        editorAPI.setProjectPath(path);
    }

    public static getProjectPaths(): string[] {
        if (!editorAPI) return [];
        return editorAPI.getProjectPaths();
    }

    public static license(): any {
        if (!editorAPI) return null;
        return editorAPI.license();
    }

    public static send(channel: string, ...args: any[]): void {
        if (!editorAPI) return;
        editorAPI.send(channel, ...args);
    }

    public static sendSync(channel: string, ...args: any[]): any {
        if (!editorAPI) return null;
        return editorAPI.sendSync(channel, ...args);
    }

    public static on(channel: string, listener: (...args: any[]) => void): void {
        if (!editorAPI) return;
        editorAPI.on(channel, listener);
    }

    public static removeAllListeners(channel: string): void {
        if (!editorAPI) return;
        editorAPI.removeAllListeners(channel);
    }
}