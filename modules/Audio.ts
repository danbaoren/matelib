import * as RE from 'rogue-engine';
import * as THREE from 'three'; // Added for 3D audio
import { AssetManager } from './AssetManager';

export class Audio {
    private static masterGain: GainNode | null = null;
    private static soundBuffers: { [name: string]: { buffer: AudioBuffer, group: string } } = {};
    private static musicSource: AudioBufferSourceNode | null = null;
    private static musicGain: GainNode | null = null;
    private static activeSounds: { [name: string]: { gainNode: GainNode, originalVolume: number }[] } = {};
    private static groupGains: { [group: string]: GainNode } = {};
    private static soundVolumes: { [name: string]: number } = {};
    private static positionalAudioNodes: { [name: string]: THREE.PositionalAudio } = {};
    private static audioListener: THREE.AudioListener | null = null;
    private static spatialAudioCounter: number = 0;
    private static spatialAudioObjects: { [id: string]: { object: THREE.Object3D, positionalAudio: THREE.PositionalAudio, soundName: string, originalVolume: number } } = {};

    /**
     * Initializes the Audio module. This must be called once after a user interaction (e.g., a click).
     * mate handles this automatically on the first user interaction with the window.
     */
    public static initialize(): void {
        if (this.masterGain) return;
        try {
            const audioContext = AssetManager.getAudioContext();
            this.masterGain = audioContext.createGain();
            this.masterGain.connect(audioContext.destination);

            // Check if an AudioListener already exists on the camera
            this.audioListener = RE.Runtime.camera.children.find(child => child instanceof THREE.AudioListener) as THREE.AudioListener;

            // If not, create and add a new AudioListener to the camera
            if (!this.audioListener) {
                this.audioListener = new THREE.AudioListener();
                RE.Runtime.camera.add(this.audioListener);
            }

            // Ensure the default group exists
            this.setGroupVolume("none", 1.0);
            console.log("mate.Audio: Initialized successfully.");
        } catch (e) {
            console.error("mate.Audio: Web Audio API is not supported in this browser.", e);
        }
    }

    private static isReady(): boolean {
        if (!AssetManager.getAudioContext() || !this.masterGain) {
            console.warn("mate.Audio: Audio system not initialized. Please ensure user has interacted with the page.");
            return false;
        }

        // Ensure AudioListener exists and is attached to the camera
        if (!this.audioListener || !RE.Runtime.camera || !RE.Runtime.camera.children.includes(this.audioListener)) {
            if (RE.Runtime.camera) {
                // Try to find an existing AudioListener on the camera first
                this.audioListener = RE.Runtime.camera.children.find(child => child instanceof THREE.AudioListener) as THREE.AudioListener;

                if (!this.audioListener) {
                    // If no AudioListener found, create and add a new one
                    this.audioListener = new THREE.AudioListener();
                    RE.Runtime.camera.add(this.audioListener);
                }
            } else {
                console.warn("mate.Audio: RE.Runtime.camera is not available. Positional audio may not work correctly.");
                return false;
            }
        }
        return true;
    }

    public static async loadSound(name: string, staticPath: string, group: string = "none"): Promise<void> {
        if (!this.isReady()) return;
        if (this.soundBuffers[name]) return;

        try {
            const response = await fetch(RE.getStaticPath(staticPath));
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await AssetManager.getAudioContext().decodeAudioData(arrayBuffer);
            this.soundBuffers[name] = { buffer: audioBuffer, group };

            // Ensure group gain exists
            if (!this.groupGains[group]) {
                this.setGroupVolume(group, 1.0);
            }
        } catch (error) {
            console.error(`mate.Audio: Failed to load sound "${name}" from "${staticPath}".`, error);
        }
    }

    public static async playSound(name: string, options: { volume?: number } = {}): Promise<void> {
        if (!this.isReady() || !this.soundBuffers[name]) {
            if (!this.soundBuffers[name]) console.warn(`mate.Audio: Sound "${name}" not loaded.`);
            return;
        }

        const audioContext = AssetManager.getAudioContext();
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        const source = audioContext.createBufferSource();
        source.buffer = this.soundBuffers[name].buffer;

        const gainNode = audioContext.createGain();
        const storedVolume = this.soundVolumes[name];
        gainNode.gain.value = options.volume ?? storedVolume ?? 1.0;

        const groupGain = this.groupGains[this.soundBuffers[name].group];

        source.connect(gainNode);
        gainNode.connect(groupGain);

        source.start(0);

        if (!this.activeSounds[name]) {
            this.activeSounds[name] = [];
        }
        this.activeSounds[name].push({ gainNode, originalVolume: gainNode.gain.value });

        source.onended = () => {
            const index = this.activeSounds[name].findIndex(entry => entry.gainNode === gainNode);
            if (index > -1) {
                this.activeSounds[name].splice(index, 1);
            }
        };
    }

    public static setSoundVolume(name: string, volume: number): void {
        this.soundVolumes[name] = volume;

        if (this.activeSounds[name]) {
            this.activeSounds[name].forEach(entry => {
                entry.gainNode.gain.value = volume;
                entry.originalVolume = volume; // Update original volume when setting
            });
        }

        if (this.musicSource && this.soundBuffers[name] && this.musicSource.buffer === this.soundBuffers[name].buffer) {
            if (this.musicGain) {
                this.musicGain.gain.value = volume;
            }
        }
    }

    /**
     * Pauses all active instances of a specific sound.
     * @param name The name of the sound to pause.
     */
    public static pauseSound(name: string): void {
        if (!this.isReady()) return;
        if (this.activeSounds[name]) {
            this.activeSounds[name].forEach(entry => {
                entry.gainNode.gain.value = 0;
            });
        }
        // For positional audio, set volume to 0
        if (this.positionalAudioNodes[name]) {
            this.positionalAudioNodes[name].setVolume(0);
        }
        for (const id in this.spatialAudioObjects) {
            if (this.spatialAudioObjects[id].soundName === name) {
                this.spatialAudioObjects[id].positionalAudio.setVolume(0);
            }
        }
    }

    /**
     * Resumes all active instances of a specific sound.
     * @param name The name of the sound to resume.
     */
    public static resumeSound(name: string): void {
        if (!this.isReady()) return;
        if (this.activeSounds[name]) {
            this.activeSounds[name].forEach(entry => {
                entry.gainNode.gain.value = entry.originalVolume;
            });
        }
        // For positional audio, restore original volume
        if (this.positionalAudioNodes[name]) {
            const originalVolume = this.soundVolumes[name] ?? 1.0;
            this.positionalAudioNodes[name].setVolume(originalVolume);
        }
        for (const id in this.spatialAudioObjects) {
            if (this.spatialAudioObjects[id].soundName === name) {
                const originalVolume = this.soundVolumes[name] ?? 1.0;
                this.spatialAudioObjects[id].positionalAudio.setVolume(originalVolume);
            }
        }
    }

    /**
     * Pauses all sounds belonging to a specific group.
     * @param group The name of the group to pause.
     */
    public static pauseGroup(group: string): void {
        if (!this.isReady()) return;
        for (const soundName in this.soundBuffers) {
            if (this.soundBuffers[soundName].group === group) {
                this.pauseSound(soundName);
            }
        }
    }

    /**
     * Resumes all sounds belonging to a specific group.
     * @param group The name of the group to resume.
     */
    public static resumeGroup(group: string): void {
        if (!this.isReady()) return;
        for (const soundName in this.soundBuffers) {
            if (this.soundBuffers[soundName].group === group) {
                this.resumeSound(soundName);
            }
        }
    }

    public static setGroupVolume(group: string, volume: number): void {
        if (!this.isReady()) return;

        if (!this.groupGains[group]) {
            const audioContext = AssetManager.getAudioContext();
            this.groupGains[group] = audioContext.createGain();
            this.groupGains[group].connect(this.masterGain!);
        }
        this.groupGains[group].gain.value = volume;
    }

    public static async loadAndPlaySound(name: string, staticPath: string, options: { volume?: number, group?: string } = {}): Promise<void> {
        if (!this.isReady()) return;

        if (!this.soundBuffers[name]) {
            await this.loadSound(name, staticPath, options.group || 'none');
        }

        await this.playSound(name, options);
    }

    public static getLoadedSounds(): string[] {
        return Object.keys(this.soundBuffers);
    }

    /**
     * Plays a sound, either non-positionally or positionally, based on the provided arguments.
     * This method acts as a unified entry point for playing various types of audio.
     * @param sound The name of the sound (string) or an AudioBuffer to play.
     * @param position Optional: The THREE.Vector3 position for positional audio. If provided, the sound will be spatialized.
     * @param options Optional: Playback options (volume, loop, group, distanceModel, maxDistance, rolloffFactor).
     */
    public static async play(
        sound: string | AudioBuffer,
        position?: THREE.Vector3,
        options: {
            volume?: number;
            loop?: boolean;
            group?: string;
            distanceModel?: "linear" | "inverse" | "exponential";
            maxDistance?: number;
            rolloffFactor?: number;
            id?: string;
        } = {}
    ): Promise<THREE.Object3D | undefined | void> {
        if (!this.isReady()) {
            console.warn("mate.Audio: Audio system not initialized. Cannot play sound.");
            return;
        }

        if (sound instanceof AudioBuffer) {
            // If an AudioBuffer is provided, play it directly (non-positional)
            if (position) {
                console.warn("mate.Audio: Positional audio not supported when playing AudioBuffer directly. Playing non-positionally.");
            }
            return this.playAudioBuffer(sound, options);
        } else if (typeof sound === 'string') {
            // If a sound name (string) is provided
            if (position) {
                // Play positionally if a position is given
                return this.playPositionalSound(sound, position, options);
            } else {
                // Play non-positionally if no position is given
                return this.playSound(sound, options);
            }
        } else {
            console.error("mate.Audio: Invalid sound type provided. Must be a string (sound name) or an AudioBuffer.");
            return;
        }
    }

    public static unloadSound(name: string): void {
        if (this.soundBuffers[name]) {
            delete this.soundBuffers[name];
            delete this.soundVolumes[name];
        }
    }

    public static unloadAllSounds(): void {
        this.soundBuffers = {};
        this.soundVolumes = {};
    }

    public static async playMusic(name: string, options: { loop?: boolean; volume?: number } = {}): Promise<void> {
        if (!this.isReady() || !this.soundBuffers[name]) {
            if (!this.soundBuffers[name]) console.warn(`mate.Audio: Music track "${name}" not loaded.`);
            return;
        }

        this.stopMusic();

        const audioContext = AssetManager.getAudioContext();
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        this.musicSource = audioContext.createBufferSource();
        this.musicSource.buffer = this.soundBuffers[name].buffer;
        this.musicSource.loop = options.loop ?? true;

        this.musicGain = audioContext.createGain();
        const storedVolume = this.soundVolumes[name];
        this.musicGain.gain.value = options.volume ?? storedVolume ?? 1.0;

        const groupGain = this.groupGains[this.soundBuffers[name].group];

        this.musicSource.connect(this.musicGain);
        this.musicGain.connect(groupGain);

        this.musicSource.start(0);
    }

    public static stopMusic(): void {
        if (this.musicSource) {
            this.musicSource.stop(0);
            this.musicSource.disconnect();
            this.musicSource = null;
            this.musicGain = null;
        }
    }

    public static setMasterVolume(level: number): void {
        if (!this.isReady()) return;
        this.masterGain!.gain.value = Math.max(0, Math.min(1, level));
    }

    /**
     * Links an audio buffer to a specific 3D object in the scene, creating a positional sound source.
     * The sound will get louder as the listener approaches the object and quieter as they move away.
     * @param name The name of the sound (must be pre-loaded).
     * @param object The THREE.Object3D to link the sound to.
     * @param options Optional parameters for the positional audio (e.g., volume, loop, distanceModel, maxDistance, rolloffFactor).
     */
    public static async linkSoundToObject(
        name: string,
        object: THREE.Object3D,
        options: {
            volume?: number;
            loop?: boolean;
            distanceModel?: "linear" | "inverse" | "exponential";
            maxDistance?: number;
            rolloffFactor?: number;
        } = {}
    ): Promise<void> {
        if (!this.isReady() || !this.soundBuffers[name]) {
            if (!this.soundBuffers[name]) console.warn(`mate.Audio: Sound "${name}" not loaded.`);
            return;
        }

        const audioContext = AssetManager.getAudioContext();
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        // Create a PositionalAudio object
        const positionalAudio = new THREE.PositionalAudio(this.audioListener!);
        positionalAudio.setBuffer(this.soundBuffers[name].buffer);
        positionalAudio.setLoop(options.loop ?? true);
        positionalAudio.setVolume(options.volume ?? 1.0);

        if (options.distanceModel) {
            positionalAudio.setDistanceModel(options.distanceModel);
        }
        if (options.maxDistance) {
            positionalAudio.setMaxDistance(options.maxDistance);
        }
        if (options.rolloffFactor) {
            positionalAudio.setRolloffFactor(options.rolloffFactor);
        }

        // Add the positional audio to the object
        object.add(positionalAudio);

        // Store the positional audio node for later management (e.g., stopping)
        this.positionalAudioNodes[name] = positionalAudio;

        // Start playing the sound
        positionalAudio.play();
    }

    /**
     * Creates an invisible Object3D at a specific position and links a pre-loaded sound to it.
     * The sound will play positionally from that location.
     * @param name The name of the sound (must be pre-loaded).
     * @param position The THREE.Vector3 position where the sound source will be created.
     * @param options Optional parameters for the positional audio.
     * @returns The created THREE.Object3D that holds the positional audio.
     */
    public static async playPositionalSound(
        name: string,
        position: THREE.Vector3,
        options: {
            volume?: number;
            loop?: boolean;
            distanceModel?: "linear" | "inverse" | "exponential";
            maxDistance?: number;
            rolloffFactor?: number;
            id?: string; // Allow passing a custom ID
        } = {}
    ): Promise<THREE.Object3D | undefined> {
        if (!this.isReady() || !this.soundBuffers[name]) {
            if (!this.soundBuffers[name]) console.warn(`mate.Audio: Sound "${name}" not loaded.`);
            return;
        }

        const id = options.id || `ID${this.spatialAudioCounter++}`;
        const soundObject = new THREE.Object3D();
        soundObject.position.copy(position);
        soundObject.name = `PosAudio ${id}: Name "${name}", Pos (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`;
        RE.Runtime.scene.add(soundObject);

        await this.linkSoundToObject(name, soundObject, options);

        const positionalAudio = soundObject.children.find(child => child instanceof THREE.PositionalAudio) as THREE.PositionalAudio;

        if (positionalAudio) {
            this.spatialAudioObjects[id] = { object: soundObject, positionalAudio, soundName: name, originalVolume: positionalAudio.getVolume() };
        }

        return soundObject;
    }

    /**
     * Loads a sound from a static path, creates an invisible Object3D at a specific position,
     * and links the loaded sound to it. The sound will play positionally from that location.
     * @param name The name to assign to the sound.
     * @param staticPath The static path to the audio file.
     * @param position The THREE.Vector3 position where the sound source will be created.
     * @param options Optional parameters for loading and positional audio.
     * @returns The created THREE.Object3D that holds the positional audio.
     */
    public static async loadAndPlayPositionalSound(
        name: string,
        staticPath: string,
        position: THREE.Vector3,
        options: {
            volume?: number;
            loop?: boolean;
            distanceModel?: "linear" | "inverse" | "exponential";
            maxDistance?: number;
            rolloffFactor?: number;
            group?: string;
        } = {}
    ): Promise<THREE.Object3D | undefined> {
        if (!this.isReady()) return;

        if (!this.soundBuffers[name]) {
            await this.loadSound(name, staticPath, options.group || 'none');
        }

        return this.playPositionalSound(name, position, options);
    }

    /**
     * Plays an AudioBuffer directly. Useful when the AudioBuffer is already available (e.g., from RE.AudioAsset).
     * @param audioBuffer The AudioBuffer to play.
     * @param options Optional parameters for playback (e.g., volume, group).
     */
    public static async playAudioBuffer(audioBuffer: AudioBuffer, options: { volume?: number, group?: string } = {}): Promise<void> {
        if (!this.isReady()) {
            console.warn("mate.Audio: Audio system not initialized. Cannot play AudioBuffer.");
            return;
        }

        const audioContext = AssetManager.getAudioContext();
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;

        const gainNode = audioContext.createGain();
        gainNode.gain.value = options.volume ?? 1.0;

        // If a group is specified, ensure it exists and connect to it.
        // Otherwise, connect to the master gain.
        let targetNode: AudioNode;
        if (options.group && this.groupGains[options.group]) {
            targetNode = this.groupGains[options.group];
        } else {
            targetNode = this.masterGain!;
        }

        source.connect(gainNode);
        gainNode.connect(targetNode);

        source.start(0);
    }

    /**
     * Updates the position and orientation of the audio listener. This should be called
     * in the game loop, typically with the camera's position and quaternion.
     * @param camera The active THREE.Camera in the scene.
     */
    public static updatePositionalAudio(camera: THREE.Camera): void {
        if (!this.isReady()) return;

        // The AudioListener is attached to the camera, so its position and orientation
        // are automatically updated by Three.js when the camera moves.
        // No explicit update logic is needed here.
    }

    /**
     * Stops and removes a specific spatial audio object from the scene by its ID.
     * @param id The unique ID of the spatial audio object to remove.
     */
    /**
     * Pauses a specific spatial audio object by its ID.
     * @param id The unique ID of the spatial audio object to pause.
     */
    public static pauseSpatialAudio(id: string): void {
        const spatialAudioEntry = this.spatialAudioObjects[id];
        if (spatialAudioEntry) {
            spatialAudioEntry.positionalAudio.setVolume(0);
            console.log(`mate.Audio: Paused spatial audio with ID: ${id}`);
        } else {
            console.warn(`mate.Audio: Spatial audio with ID "${id}" not found.`);
        }
    }

    /**
     * Resumes a specific spatial audio object by its ID.
     * @param id The unique ID of the spatial audio object to resume.
     */
    public static resumeSpatialAudio(id: string): void {
        const spatialAudioEntry = this.spatialAudioObjects[id];
        if (spatialAudioEntry) {
            spatialAudioEntry.positionalAudio.setVolume(spatialAudioEntry.originalVolume);
            console.log(`mate.Audio: Resumed spatial audio with ID: ${id}`);
        } else {
            console.warn(`mate.Audio: Spatial audio with ID "${id}" not found.`);
        }
    }

    /**
     * Stops and removes a specific spatial audio object from the scene by its ID.
     * @param id The unique ID of the spatial audio object to remove.
     */
    public static removeSpatialAudio(id: string): void {
        const spatialAudioEntry = this.spatialAudioObjects[id];
        if (spatialAudioEntry) {
            spatialAudioEntry.positionalAudio.stop();
            spatialAudioEntry.object.remove(spatialAudioEntry.positionalAudio);
            RE.Runtime.scene.remove(spatialAudioEntry.object);
            delete this.spatialAudioObjects[id];
            console.log(`mate.Audio: Removed spatial audio with ID: ${id}`);
        } else {
            console.warn(`mate.Audio: Spatial audio with ID "${id}" not found.`);
        }
    }

    /**
     * Returns a list of all active spatial audio objects.
     * @returns An array of objects, each containing the ID, sound name, and the THREE.Object3D of the spatial audio.
     */
    public static getSpatialAudioList(): Array<{ id: string, soundName: string, object: THREE.Object3D }> {
        return Object.keys(this.spatialAudioObjects).map(id => ({
            id: id,
            soundName: this.spatialAudioObjects[id].soundName,
            object: this.spatialAudioObjects[id].object,
        }));
    }
}
