
/**
 * # mate - Your Rogue Engine & Three.js Utility Belt
 *
 * A framework/utility library to simplify common development tasks in Rogue Engine.
 * Provides easy-to-use wrappers for file system operations, DOM manipulation,
 * scene/object searching, and general-purpose helpers.
 *
 * --- SETUP ---
 * 1. Place this file in your project's `Assets` folder.
 * 2. In any component script, import it with:
 *    `import mate from '../matelib/mate';
 *
 * --- EXPANDING ---
 * To add a new module:
 * 1. Create a new .ts file in the `modules` directory (e.g., `MyModule.ts`).
 * 2. Define a class in that file with static methods (e.g., `export class MyModule { ... }`).
 * 3. In this file (mate.ts, import your new class.
 * 4. Add a static property for your module in the `mate` class (e.g., `public static myModule = MyModule;`).
 */

import * as RE from 'rogue-engine'

import { rogueEditorAPI } from "./modules/RogueEditorAPI";
import { Logger } from './modules/Logger';
import { DOM } from './modules/DOM';
import { Utils } from './modules/Utils';
import { Scene} from './modules/Scene';
import { Storage } from './modules/Storage';
import { Audio } from './modules/Audio';
import { Networking } from './modules/Networking';
import { Prefab } from './modules/Prefab';
import { AssetManager } from './modules/AssetManager';
import * as UI from './modules/UI/index';
import { WasmModule } from './modules/WasmLoader';
import { WorkerManager } from './modules/WorkerManager';
import { ColyseusClient } from './modules/Colyseus';
import Docmaker from './modules/Docmaker';
import { Raycast } from './modules/Raycast';
import { Debug } from './modules/Debug';
import { Animation } from './modules/Animation';
import { InputManager } from './modules/InputManager';

export default class mate {
    public static log = Logger.log.bind(Logger);
    public static warn = Logger.warn.bind(Logger);
    public static error = Logger.error.bind(Logger);
    public static logcolor = Logger.logcolor.bind(Logger);

    public static screenshoot = AssetManager.screenshot.bind(AssetManager);

    public static dom = DOM;
    public static utils = Utils;
    public static scene = Scene;
    public static audio = Audio;
    public static storage = Storage;
    public static networking = Networking;
    public static prefab = Prefab;
    public static assets = AssetManager;
    public static ui = UI;
    public static wasm = WasmModule;
    public static workers = WorkerManager.getInstance();
    public static editor = rogueEditorAPI;
    public static colyseus = ColyseusClient;
    public static docmaker = Docmaker;
    public static raycast = Raycast;
    public static debug = Debug;
    public static animation = Animation;
    public static input = InputManager.getInstance();

    public static nuke = Utils.nuke;

    public static initialize() {

        if (!RE.Runtime.isRunning) {
            return;
        }


        // Auto-initialize audio on first user interaction.
        const initAudioOnce = () => {
            this.audio.initialize();
        };

        window.addEventListener('click', initAudioOnce, { once: true });
        window.addEventListener('keydown', initAudioOnce, { once: true });
        window.addEventListener('touchstart', initAudioOnce, { once: true });

    }
}

// Initialize the API when the script is loaded
mate.initialize();

    

    
