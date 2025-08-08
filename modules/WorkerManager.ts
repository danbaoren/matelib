/**
 *
 * A robust, flexible, and easy-to-use module for managing on-demand web workers.
 * This manager creates a fresh, clean-room worker for every task and terminates it upon completion,
 * ensuring perfect task isolation and preventing any state leakage.
 *
 * --- FEATURES ---
 * - **Stateless Workers:** Creates a new worker per task for maximum stability.
 * - **Promise-Based API:** A modern `async/await` friendly interface.
 * - **Cancellable Tasks:** Every task can be cancelled, immediately terminating the worker.
 * - **Timeouts:** Protects against runaway scripts by enforcing a task timeout.
 * - **Progress Reporting:** Workers can report progress back to the main thread during long tasks.
 * - **Dynamic Code Execution:** Run workers from a string of code, created on-the-fly.
 * - **Transferable Objects & Dependencies:** Full support for high-performance data transfer and external scripts.
 * - **Run from Function:** Execute a function directly in a worker without a separate file.
 * - **Worker-Side API:** Provides a simplified, declarative API for writing worker logic.
 *
 * --- USAGE ---
 *
 * **1. Worker Script (e.g., `heavy-task.js` - using the new Worker-Side API):**
 * ```javascript
 * // Note: 'workerAPI' is globally available in the worker's scope due to the manager.
 * workerAPI.onTask((data) => {
 * // Report progress using the workerAPI
 * workerAPI.reportProgress(0.5);
 *
 * const result = data * 2;
 *
 * // Return the result; workerAPI automatically sends the 'done' message
 * return result;
 * });
 * ```
 *
 * **2. Main Thread:**
 * ```typescript
 * // Assuming MATE is an instance of WorkerManager
 * import { WorkerManager, WorkerTask, WorkerOptions } from './WorkerManager'; // Adjust path as needed
 *
 * const MATE = WorkerManager.getInstance();
 *
 * // Example 1: Running from a script file
 * const { promise: scriptPromise, cancel: scriptCancel } = MATE.run('path/to/heavy-task.js', 42, {
 * timeout: 5000, // Kill the worker if it takes longer than 5s
 * onProgress: (progress) => console.log(`Script Progress: ${progress * 100}%`)
 * });
 *
 * scriptPromise.then(result => {
 * console.log('Script Worker result:', result);
 * }).catch(error => {
 * if (error.name === 'CancellationError') {
 * console.log('Script task was cancelled or timed out.');
 * } else {
 * console.error('Script Worker task failed:', error);
 * }
 * });
 *
 * // Example 2: Using the new runFromFunction method with workerAPI
 * const heavyCalculation = (data: number) => {
 * let result = 0;
 * for (let i = 0; i < 1_000_000_000; i++) {
 * result += Math.sin(data + i);
 * if (i % 100_000_000 === 0) {
 * // Report progress using the workerAPI
 * workerAPI.reportProgress(i / 1_000_000_000);
 * }
 * }
 * return result;
 * };
 *
 * const { promise: funcPromise, cancel: funcCancel } = MATE.runFromFunction(heavyCalculation, 5, {
 * onProgress: (progress) => console.log(`Function Progress: ${Math.round(progress * 100)}%`)
 * });
 *
 * funcPromise.then(result => {
 * console.log('Function Worker result:', result);
 * }).catch(error => {
 * if (error.name === 'CancellationError') {
 * console.log('Function task was cancelled or timed out.');
 * } else {
 * console.error('Function Worker task failed:', error);
 * }
 * });
 *
 * // To cancel a task before it completes:
 * // scriptCancel();
 * // funcCancel();
 * ```
 */

class CancellationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CancellationError';
    }
}

export interface WorkerTask<R> {
    promise: Promise<R>;
    cancel: () => void;
}

export interface WorkerOptions {
    timeout?: number;
    dependencies?: string[];
    transfer?: Transferable[];
    onProgress?: (data: any) => void;
}

export class WorkerManager {
    private static instance: WorkerManager;

    private constructor() {}

    public static getInstance(): WorkerManager {
        if (!WorkerManager.instance) {
            WorkerManager.instance = new WorkerManager();
        }
        return WorkerManager.instance;
    }

    /**
     * Runs a task in a new worker from a script file.
     * The worker script should use the `workerAPI.onTask` method to define its main logic.
     * @param scriptUrl The URL of the worker script.
     * @param data The data to send to the worker.
     * @param options Configuration for the task (timeout, progress callback, etc.).
     * @returns A `WorkerTask` object containing the result promise and a cancel function.
     */
    public run<T, R>(scriptUrl: string, data: T, options: WorkerOptions = {}): WorkerTask<R> {
        const bootstrapperCode = this.createBootstrapperCodeWithApi(scriptUrl, false, options.dependencies);
        const blob = new Blob([bootstrapperCode], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        const worker = new Worker(blobUrl);

        return this.manageTask<T, R>(worker, data, blobUrl, options);
    }

    /**
     * Runs a task in a new worker from a string of code.
     * The provided code string should use the `workerAPI.onTask` method to define its main logic.
     * @param code The JavaScript code for the worker.
     * @param data The data to send to the worker.
     * @param options Configuration for the task (timeout, progress callback, etc.).
     * @returns A `WorkerTask` object containing the result promise and a cancel function.
     */
    public runFromCode<T, R>(code: string, data: T, options: WorkerOptions = {}): WorkerTask<R> {
        const bootstrapperCode = this.createBootstrapperCodeWithApi(code, true, options.dependencies);
        const blob = new Blob([bootstrapperCode], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        const worker = new Worker(blobUrl);

        return this.manageTask<T, R>(worker, data, blobUrl, options);
    }

    /**
     * Runs a task in a new worker by serializing a function.
     *
     * **IMPORTANT:** The provided function is serialized to a string and executed in a completely
     * isolated worker environment. This has several critical implications:
     * - **No Closures:** The function cannot access any variables from its parent scope (closure).
     *   It must be entirely self-contained or rely only on the `data` passed to it.
     * - **No Imports:** Standard `import` or `require` statements inside the function will not work.
     *   Use the `dependencies` option to load external scripts.
     * - **Native Code:** Functions that rely on native code (e.g., bound functions, some browser APIs)
     *   cannot be serialized and will throw an error.
     *
     * @param func The self-contained function to execute in the worker.
     * @param data The data to send to the worker, which will be the first argument to `func`.
     * @param options Configuration for the task (timeout, dependencies, progress callback, etc.).
     * @returns A `WorkerTask` object containing the result promise and a cancel function.
     * @throws {Error} If the function appears to be native code that cannot be serialized.
     */
    public runFromFunction<T, R>(func: (data: T) => R, data: T, options: WorkerOptions = {}): WorkerTask<R> {
        const funcString = func.toString();

        if (funcString.includes('[native code]')) {
            throw new Error('Cannot serialize native or bound functions to a worker. Please provide a self-contained, standard JavaScript function.');
        }

        // Wrap the user's function in a structure that uses the workerAPI.onTask.
        // The `((${funcString}))` syntax ensures that both regular functions and arrow functions
        // are correctly interpreted as a function expression.
        const workerCode = `
            workerAPI.onTask((${funcString}));
        `;

        // Use runFromCode to execute this generated code, passing along dependencies.
        return this.runFromCode<T, R>(workerCode, data, options);
    }

    /**
     * Manages the lifecycle of a worker task, handling messages, errors, and timeouts.
     * @param worker The Web Worker instance.
     * @param data The initial data to send to the worker.
     * @param blobUrl The Blob URL created for the worker script.
     * @param options The worker options.
     * @returns A `WorkerTask` object.
     */
    private manageTask<T, R>(worker: Worker, data: T, blobUrl: string, options: WorkerOptions): WorkerTask<R> {
        let timeoutId: number | null = null;
        let rejectPromise: ((reason?: any) => void) | null = null; // Store reject function to call on cancel

        const promise = new Promise<R>((resolve, reject) => {
            rejectPromise = reject; // Capture reject for external cancellation

            const cleanup = () => {
                if (timeoutId) clearTimeout(timeoutId);
                worker.terminate();
                URL.revokeObjectURL(blobUrl);
            };

            worker.onmessage = (e: MessageEvent) => {
                const msg = e.data;
                if (msg && msg.type === 'progress' && options.onProgress) {
                    options.onProgress(msg.data);
                } else if (msg && msg.type === 'done') {
                    cleanup();
                    resolve(msg.data);
                } else if (msg && msg.type === 'error') {
                    cleanup();
                    reject(new Error(msg.data));
                } else {
                    // Fallback for workers that don't use the progress/done/error protocol
                    // This might happen if an older worker script is used without the API.
                    cleanup();
                    resolve(msg as R); // Assume it's the final result
                }
            };

            worker.onerror = (e: ErrorEvent) => {
                cleanup();
                reject(new Error(e.message || 'Worker encountered an unknown error.'));
            };

            if (options.timeout) {
                timeoutId = window.setTimeout(() => {
                    cleanup();
                    reject(new CancellationError(`Task timed out after ${options.timeout}ms`));
                }, options.timeout);
            }

            worker.postMessage(data, options.transfer || []);
        });

        const cancel = () => {
            if (timeoutId) clearTimeout(timeoutId);
            worker.terminate();
            URL.revokeObjectURL(blobUrl);
            // Manually reject the promise if it's still pending due to cancellation
            if (rejectPromise) {
                rejectPromise(new CancellationError('Task was explicitly cancelled.'));
            }
        };

        return { promise, cancel };
    }

    /**
     * Generates the JavaScript code for the worker-side API.
     * This code will be injected into every worker's scope.
     * @returns {string} The JavaScript code for the WorkerAPI.
     */
    private createWorkerApiCode(): string {
        return `
            class WorkerAPI {
                constructor() {
                    this._taskHandler = null;
                }
            
                /**
                 * Registers the main function to be executed when a task message is received.
                 * The function's return value will be sent back as the final result.
                 * @param {(data: any) => any} handler The function to execute.
                 */
                onTask(handler) {
                    this._taskHandler = handler;
                    // Use self.addEventListener for consistency and clarity in worker context
                    self.addEventListener('message', this._handleMessage.bind(this));
                }
            
                /**
                 * Sends a progress update to the main thread.
                 * @param {any} data The progress data.
                 */
                reportProgress(data) {
                    self.postMessage({ type: 'progress', data });
                }
            
                /**
                 * Private method to handle incoming messages from the main thread.
                 * @param {MessageEvent} e
                 */
                async _handleMessage(e) {
                    if (this._taskHandler) {
                        try {
                            // The main thread sends the task data directly.
                            const result = await Promise.resolve(this._taskHandler(e.data));
                            // If a result is returned, send a 'done' message.
                            self.postMessage({ type: 'done', data: result });
                        } catch (error) {
                            // If an error occurs, send an 'error' message with the details.
                            self.postMessage({ type: 'error', data: error.message || String(error) });
                        }
                    }
                }
            }
            // Expose the API to the worker's global scope.
            const workerAPI = new WorkerAPI();
        `;
    }

    /**
     * Creates the full bootstrapper code for the worker, including dependencies,
     * the worker-side API, and the user's script/code.
     * @param scriptOrCode The URL of the script or the raw code string.
     * @param isCode True if `scriptOrCode` is raw code, false if it's a URL.
     * @param dependencies An array of URLs for external scripts to import.
     * @returns {string} The complete bootstrapper code.
     */
    private createBootstrapperCodeWithApi(scriptOrCode: string, isCode: boolean, dependencies: string[] = []): string {
        const dependencyLoader = dependencies.length > 0
            ? `importScripts(${dependencies.map(d => `'${d}'`).join(', ')});`
            : '';

        const apiCode = this.createWorkerApiCode();

        const scriptLoader = isCode
            ? scriptOrCode // The script itself is the code
            : `importScripts('${scriptOrCode}');`; // Import the external script

        // Concatenate all parts: dependencies, worker API, and the user's worker code/script.
        return `${dependencyLoader}\n${apiCode}\n${scriptLoader}`;
    }
}