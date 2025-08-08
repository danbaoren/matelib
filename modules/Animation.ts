
import * as THREE from 'three';
import * as RE from 'rogue-engine';
import { AnimationActionLoopStyles } from 'three';
import { Logger } from './Logger';

/**
 * Configuration options for playing an animation.
 */
export interface PlayOptions {
    transitionDuration?: number;
    loop?: AnimationActionLoopStyles;
    timeScale?: number; // Speed for this specific animation, overrides global speed.
    startAt?: number; // Time in seconds to start the animation from.
    onComplete?: () => void; // Callback for when a non-looping animation finishes.
    onLoop?: (event: THREE.Event) => void; // Callback for when a looping animation completes a cycle.
}

/**
 * # Animation - A flexible and powerful animation manager for Three.js objects.
 * Provides a state machine-like interface for controlling animations, with support
 * for smooth transitions (cross-fading), speed control, and lifecycle callbacks.
 */
export class Animation {
    private mixer: THREE.AnimationMixer;
    private actions: Map<string, THREE.AnimationAction> = new Map();
    private currentAction: THREE.AnimationAction | null = null;
    private additiveActions: Map<string, THREE.AnimationAction> = new Map();
    private animationQueue: { name: string, options: PlayOptions }[] = [];
    private isQueuePlaying: boolean = false;
    private skeletonHelper: THREE.SkeletonHelper | null = null;
    private rootObject: THREE.Object3D;
    private _timeScale: number = 1.0;

    // Manages listeners for the currently active action to prevent memory leaks.
    private currentActionListeners: { finished?: (e: any) => void, loop?: (e: any) => void } = {};

    /**
     * Creates a new Animation instance for a given 3D object.
     * @param object The THREE.Object3D to animate. This should be the root of the model containing the skeleton.
     * @param clips An array of THREE.AnimationClip objects to associate with the object.
     */
    constructor(object: THREE.Object3D, clips: THREE.AnimationClip[]) {
        this.rootObject = object;
        this.mixer = new THREE.AnimationMixer(object);
        clips.forEach(clip => {
            const action = this.mixer.clipAction(clip);
            this.actions.set(clip.name, action);
        });
    }

    /**
     * Plays an animation by name, with a smooth cross-fade transition from the current animation.
     * @param name The name of the animation clip to play.
     * @param options Configuration for playing the animation.
     * @param options.transitionDuration The duration of the cross-fade transition in seconds. Default is 0.3.
     * @param options.timeScale The playback speed for this specific animation. Overrides the global speed.
     * @param options.startAt The time in seconds to start the animation from.
     * @param options.loop The loop mode for the animation. Defaults to `THREE.LoopRepeat`.
     * @param options.onComplete A callback function to execute when a non-looping animation finishes.
     * @param options.onLoop A callback function to execute each time a looping animation completes a cycle.
     * @returns The Animation instance for method chaining.
     */
    public play(name: string, options: PlayOptions = {}): this {
        const {
            transitionDuration = 0.3,
            loop = THREE.LoopRepeat,
            timeScale = this._timeScale,
            startAt,
            onComplete,
            onLoop
        } = options;

        const action = this.actions.get(name);
        if (!action) {
            Logger.warn(`Animation clip "${name}" not found.`, "Animation");
            return this;
        }

        // If the same action is already playing and set to loop, do nothing.
        if (this.currentAction === action && action.isRunning()) {
            return this; // Already playing this action
        }

        // Stop any layered animations before playing a new base animation.
        this.stopAllAdditive(transitionDuration);

        // Clean up listeners for the previous action to prevent memory leaks.
        if (this.currentAction) {
            const oldListeners = this.currentActionListeners;
            if (oldListeners.finished) this.mixer.removeEventListener('finished', oldListeners.finished);
            if (oldListeners.loop) this.mixer.removeEventListener('loop', oldListeners.loop);
        }
        this.currentActionListeners = {};

        action.reset();
        action.setLoop(loop, Infinity);
        action.enabled = true;
        action.timeScale = timeScale;

        if (startAt !== undefined) {
            action.time = startAt;
        }

        if (this.currentAction) {
            this.currentAction.crossFadeTo(action, transitionDuration, true);
        }
        
        action.play();
        this.currentAction = action;

        // Set up new listeners for this action.
        if (onComplete && loop === THREE.LoopOnce) {
            const onFinishedCallback = (event: any) => {
                if (event.action === action) {
                    onComplete();
                    this.mixer.removeEventListener('finished', onFinishedCallback);
                    delete this.currentActionListeners.finished;
                }
            };
            this.mixer.addEventListener('finished', onFinishedCallback);
            this.currentActionListeners.finished = onFinishedCallback;
        }

        if (onLoop) {
            const onLoopCallback = (event: any) => {
                if (event.action === action) {
                    onLoop(event);
                }
            };
            this.mixer.addEventListener('loop', onLoopCallback);
            this.currentActionListeners.loop = onLoopCallback;
        }

        return this;
    }

    /**
     * Plays an animation additively on top of the current base animation.
     * Useful for layering actions like waving while running.
     * @param name The name of the animation clip to play additively.
     * @param weight The influence of the additive animation (0.0 to 1.0).
     * @param transitionDuration The duration of the fade-in transition in seconds.
     * @returns The Animation instance for method chaining.
     */
    public playAdditive(name: string, weight: number, transitionDuration: number = 0.3): this {
        const action = this.actions.get(name);
        if (!action) {
            Logger.warn(`Additive animation clip "${name}" not found.`, "Animation");
            return this;
        }

        action.reset().setLoop(THREE.LoopRepeat, Infinity).setEffectiveWeight(weight).fadeIn(transitionDuration).play();
        this.additiveActions.set(name, action);
        return this;
    }

    /**
     * Plays an animation once and then stops.
     * @param name The name of the animation clip to play.
     * @param transitionDuration The duration of the cross-fade transition in seconds.
     * @param onComplete A callback function to execute when the animation finishes.
     * @returns The Animation instance for method chaining.
     */
    public playOnce(name: string, transitionDuration: number = 0.3, onComplete?: () => void): this {
        return this.play(name, {
            transitionDuration,
            loop: THREE.LoopOnce,
            onComplete: () => {
                // After finishing, the action is paused. We can stop it to clean up.
                if (onComplete) {
                    onComplete();
                }
            }
        });
    }

    /**
     * Stops the currently playing animation with a fade-out effect.
     * @param duration The duration of the fade-out transition in seconds.
     * @returns The Animation instance for method chaining.
     */
    public stop(duration: number = 0.3): this {
        if (this.currentAction) {
            this.currentAction.fadeOut(duration);
            this.currentAction = null;
        }
        return this;
    }

    /**
     * Stops a specific additive animation layer with a fade-out effect.
     * @param name The name of the additive animation to stop.
     * @param transitionDuration The duration of the fade-out transition in seconds.
     * @returns The Animation instance for method chaining.
     */
    public stopAdditive(name: string, transitionDuration: number = 0.3): this {
        const action = this.additiveActions.get(name);
        if (action) {
            action.fadeOut(transitionDuration);
            this.additiveActions.delete(name);

            // After the fade-out duration, the action is paused by the mixer.
            // We can schedule a stop call to fully clean it up.
            setTimeout(() => action.stop(), transitionDuration * 1000);
        }
        return this;
    }

    /**
     * Stops all currently playing additive animations.
     * @param transitionDuration The duration of the fade-out transition in seconds.
     * @returns The Animation instance for method chaining.
     */
    public stopAllAdditive(transitionDuration: number = 0.3): this {
        this.additiveActions.forEach((_, name) => this.stopAdditive(name, transitionDuration));
        return this;
    }

    /**
     * Stops all animations immediately or with a fade-out.
     * @param duration The duration of the fade-out transition. If 0, stops immediately.
     * @returns The Animation instance for method chaining.
     */
    public stopAll(duration: number = 0.3): this {
        this.actions.forEach(action => {
            if (action.isRunning()) {
                if (duration > 0) {
                    action.fadeOut(duration);
                } else {
                    action.stop();
                }
            }
        });
        this.additiveActions.clear();
        this.currentAction = null;
        return this;
    }

    /**
     * Pauses all animations.
     * @returns The Animation instance for method chaining.
     */
    public pause(): this {
        this.mixer.timeScale = 0;
        return this;
    }

    /**
     * Resumes all animations.
     * @returns The Animation instance for method chaining.
     */
    public resume(): this {
        this.mixer.timeScale = this._timeScale;
        return this;
    }

    /**
     * Sets the speed for all animations.
     * @param speed The playback speed (1.0 is normal speed).
     * @returns The Animation instance for method chaining.
     */
    public setSpeed(speed: number): this {
        this._timeScale = speed;
        this.mixer.timeScale = speed;
        return this;
    }

    /**
     * Sets the speed for a specific animation action.
     * @param name The name of the animation clip.
     * @param speed The playback speed for this action.
     * @returns The Animation instance for method chaining.
     */
    public setActionSpeed(name: string, speed: number): this {
        const action = this.actions.get(name);
        if (action) {
            action.timeScale = speed;
        } else {
            Logger.warn(`Cannot set speed for non-existent animation clip "${name}".`, "Animation");
        }
        return this;
    }

    /**
     * Adds an animation to a queue to be played sequentially.
     * @param name The name of the animation clip to queue.
     * @param options Playback options for this specific animation in the queue.
     * @returns The Animation instance for method chaining.
     */
    public queue(name: string, options: PlayOptions = {}): this {
        this.animationQueue.push({ name, options });
        return this;
    }

    /**
     * Starts playing the animation queue.
     * @returns The Animation instance for method chaining.
     */
    public playQueue(): this {
        if (this.isQueuePlaying) {
            Logger.warn("Animation queue is already playing.", "Animation");
            return this;
        }
        if (this.animationQueue.length === 0) {
            Logger.warn("Animation queue is empty.", "Animation");
            return this;
        }

        this.isQueuePlaying = true;
        this.playNextInQueue();
        return this;
    }

    private playNextInQueue(): void {
        if (!this.isQueuePlaying || this.animationQueue.length === 0) {
            this.isQueuePlaying = false;
            Logger.log("Animation queue finished.", "Animation");
            return;
        }

        const { name, options } = this.animationQueue.shift()!;
        
        // Create a new options object to avoid mutating the original in the queue.
        const playOptions: PlayOptions = {
            ...options,
            loop: options.loop ?? THREE.LoopOnce, // Default to LoopOnce for queued items.
            onComplete: () => {
                // Call the user's original callback if it exists.
                options.onComplete?.();
                // Then proceed with the queue.
                this.playNextInQueue();
            }
        };

        this.play(name, playOptions);
    }

    /**
     * Updates the animation mixer. This should be called in your main game loop.
     * @param delta The time since the last frame in seconds. Defaults to `RE.Runtime.deltaTime`.
     */
    public update(delta: number = RE.Runtime.deltaTime): void {
        this.mixer.update(delta);
    }

    /**
     * Clears the animation queue.
     * @returns The Animation instance for method chaining.
     */
    public clearQueue(): this {
        this.animationQueue = [];
        this.isQueuePlaying = false;
        return this;
    }

    /**
     * Gets a read-only copy of the current animation queue.
     * @returns A read-only array of queued animations.
     */
    public getQueue(): ReadonlyArray<{ name: string, options: PlayOptions }> {
        return this.animationQueue;
    }

    /**
     * Gets an animation action by name, allowing for more advanced manipulation.
     * @param name The name of the animation clip.
     * @returns The THREE.AnimationAction, or null if not found.
     */
    public getAction(name: string): THREE.AnimationAction | null {
        return this.actions.get(name) || null;
    }

    /**
     * Gets the currently playing animation action.
     * @returns The current THREE.AnimationAction, or null if none is playing.
     */
    public getCurrentAction(): THREE.AnimationAction | null {
        return this.currentAction;
    }

    /**
     * Gets the name of the currently playing animation clip.
     * @returns The name of the current clip, or null if none is playing.
     */
    public getCurrentActionName(): string | null {
        return this.currentAction ? this.currentAction.getClip().name : null;
    }

    /**
     * Checks if an animation is currently playing.
     * @param name Optional. The name of the animation to check. If omitted, checks if any animation is playing.
     * @returns True if the animation (or any animation) is playing.
     */
    public isPlaying(name?: string): boolean {
        if (name) {
            const action = this.actions.get(name);
            return action ? action.isRunning() : false;
        }
        return this.currentAction ? this.currentAction.isRunning() : false;
    }

    /**
     * Gets the names of all available animation clips.
     * @returns An array of animation clip names.
     */
    public getClipNames(): string[] {
        return Array.from(this.actions.keys());
    }

    /**
     * Gets the animation mixer.
     * @returns The THREE.AnimationMixer.
     */
    public getMixer(): THREE.AnimationMixer {
        return this.mixer;
    }

    /**
     * Adds a new animation clip to the manager after initialization.
     * @param clip The THREE.AnimationClip to add.
     * @returns The Animation instance for method chaining.
     */
    public addClip(clip: THREE.AnimationClip): this {
        if (this.actions.has(clip.name)) {
            Logger.warn(`Animation clip "${clip.name}" already exists. Overwriting.`, "Animation");
        }
        const action = this.mixer.clipAction(clip);
        this.actions.set(clip.name, action);
        return this;
    }

    /**
     * Toggles the visibility of a skeleton helper for debugging.
     * @param visible Whether the skeleton helper should be visible.
     * @param color The color of the skeleton helper.
     * @returns The Animation instance for method chaining.
     */
    public showSkeleton(visible: boolean, color: THREE.ColorRepresentation = 0xff00ff): this {
        if (visible) {
            if (!this.skeletonHelper) {
                this.skeletonHelper = new THREE.SkeletonHelper(this.rootObject);
                (this.skeletonHelper.material as THREE.LineBasicMaterial).linewidth = 3;
                this.rootObject.add(this.skeletonHelper);
            }
            this.skeletonHelper.visible = true;
            (this.skeletonHelper.material as THREE.LineBasicMaterial).color.set(color);
        } else {
            if (this.skeletonHelper) {
                this.skeletonHelper.visible = false;
            }
        }
        return this;
    }

    /**
     * Disposes of the animation mixer and cleans up resources.
     * Call this when the animated object is being destroyed to prevent memory leaks.
     */
    public dispose(): void {
        this.mixer.stopAllAction();
        if (this.skeletonHelper) {
            this.rootObject.remove(this.skeletonHelper);
            this.skeletonHelper.dispose();
            this.skeletonHelper = null;
        }
        // @ts-ignore - uncacheRoot is not in the type definitions but is a valid method
        this.mixer.uncacheRoot(this.mixer.getRoot());
        this.actions.clear();
        this.currentAction = null;
    }
}
