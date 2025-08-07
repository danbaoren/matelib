/**
 *
 *
 * A feature-rich, class-based utility for loading, caching, and interacting with WebAssembly modules.
 * It simplifies memory management, function calls, and resource handling, providing a robust
 * foundation for performance-critical web applications.
 *
 * --- FEATURES ---
 * - **Module Caching:** Automatically caches compiled WASM modules to prevent redundant compilation.
 * - **Instance Management:** Each loaded module is wrapped in a `WasmModule` instance for easy management.
 * - **Memory Helpers:** Provides easy-to-use functions (`readString`, `writeString`) to interact with WASM linear memory.
 * - **Type-Safe Calls:** A generic `call` method for safer invocation of exported WASM functions.
 * - **Loading Progress:** Supports an `onProgress` callback to monitor download progress.
 * - **Resource Cleanup:** A `dispose` method for proper resource management.
 *
 * --- USAGE ---
 * ```typescript
 * async function main() {
 *   try {
 *     // 1. Load the module (with optional imports and progress tracking)
 *     const wasmModule = await WasmModule.load('path/to/your_module.wasm', {
 *       env: {
 *         js_log: (ptr, len) => console.log(wasmModule.readString(ptr, len))
 *       }
 *     }, (progress) => console.log(`Loading: ${progress.toFixed(2)}%`));
 *
 *     // 2. Call an exported function
 *     const result = wasmModule.call<number>('add', [2, 3]); // result is 5
 *
 *     // 3. Write data to memory and call a function that uses it
 *     const messagePtr = wasmModule.writeString('Hello from JavaScript!');
 *     wasmModule.call('process_message', [messagePtr]);
 *
 *     // 4. Clean up when done
 *     wasmModule.dispose();
 *
 *   } catch (error) {
 *     console.error("Failed to use WASM module:", error);
 *   }
 * }
 * ```
 */
export class WasmModule {
    private static compiledModules: Map<string, WebAssembly.Module> = new Map();

    public instance: WebAssembly.Instance;
    public memory: WebAssembly.Memory;

    private constructor(instance: WebAssembly.Instance) {
        this.instance = instance;
        const memoryExport = instance.exports.memory;
        if (!(memoryExport instanceof WebAssembly.Memory)) {
            throw new Error("WASM module must export a 'memory' object.");
        }
        this.memory = memoryExport;
    }

    /**
     * Loads, compiles, and instantiates a WebAssembly module.
     * Utilizes caching to avoid recompiling modules that have already been loaded.
     * @param url The URL of the .wasm file.
     * @param imports An object containing functions and values to be imported into the WASM instance.
     * @param onProgress A callback function that receives the download progress (0 to 100).
     * @returns A Promise that resolves with a `WasmModule` instance.
     */
    public static async load(
        url: string,
        imports: WebAssembly.Imports = {},
        onProgress?: (progress: number) => void
    ): Promise<WasmModule> {
        try {
            let compiledModule = this.compiledModules.get(url);

            if (!compiledModule) {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Failed to fetch WASM module from ${url}: ${response.statusText}`);
                }
                const contentLength = response.headers.get('content-length');
                if (!onProgress || !contentLength) {
                    console.warn("WasmLoader: onProgress callback requires 'content-length' header to be set on the server response.");
                    const arrayBuffer = await response.arrayBuffer();
                    compiledModule = await WebAssembly.compile(arrayBuffer);
                } else {
                    const total = parseInt(contentLength, 10);
                    let loaded = 0;
                    const reader = response.body!.getReader();
                    const stream = new ReadableStream({
                        start(controller) {
                            function push() {
                                reader.read().then(({ done, value }) => {
                                    if (done) {
                                        controller.close();
                                        return;
                                    }
                                    loaded += value.length;
                                    if (onProgress) {
                                        onProgress((loaded / total) * 100);
                                    }
                                    controller.enqueue(value);
                                    push();
                                });
                            }
                            push();
                        }
                    });
                    const streamedResponse = new Response(stream);
                    compiledModule = await WebAssembly.compileStreaming(streamedResponse);
                }
                this.compiledModules.set(url, compiledModule);
            }

            const instance = await WebAssembly.instantiate(compiledModule, imports);
            return new WasmModule(instance);
        } catch (error) {
            console.error(`Error loading or instantiating WASM module from ${url}:`, error);
            throw error;
        }
    }

    /**
     * Calls an exported function from the WebAssembly instance.
     * @param funcName The name of the exported function to call.
     * @param args An array of arguments to pass to the function.
     * @returns The result of the function call.
     */
    public call<T = any>(funcName: string, args: any[] = []): T {
        const func = this.instance.exports[funcName];
        if (typeof func !== 'function') {
            throw new Error(`WASM module does not export a function named "${funcName}".`);
        }
        return func(...args) as T;
    }

    /**
     * Writes a string into the WASM module's linear memory.
     * The string is null-terminated.
     * @param str The string to write.
     * @param ptr Optional. The memory address to write to. If not provided, memory is allocated.
     * @returns The memory address (pointer) where the string was written.
     */
    public writeString(str: string, ptr?: number): number {
        const encoder = new TextEncoder();
        const encodedString = encoder.encode(str + '\0'); // Null-terminate the string
        const buffer = new Uint8Array(this.memory.buffer);

        let pointer = ptr;
        if (pointer === undefined) {
            // If no pointer is provided, we need to "allocate" memory.
            // We call an exported 'malloc' function if it exists.
            pointer = this.call<number>('malloc', [encodedString.length]);
            if (pointer === 0) {
                throw new Error("Failed to allocate memory in WASM module (malloc returned 0).");
            }
        }

        buffer.set(encodedString, pointer);
        return pointer;
    }

    /**
     * Reads a null-terminated string from the WASM module's linear memory.
     * @param ptr The memory address (pointer) to start reading from.
     * @param len Optional. The maximum length to read. If not provided, reads until a null terminator is found.
     * @returns The string read from memory.
     */
    public readString(ptr: number, len?: number): string {
        const buffer = new Uint8Array(this.memory.buffer, ptr);
        let end = 0;
        if (len !== undefined) {
            end = len;
        } else {
            while (buffer[end] !== 0) {
                end++;
            }
        }
        const decoder = new TextDecoder();
        return decoder.decode(buffer.subarray(0, end));
    }

    /**
     * Writes a byte array into the WASM module's linear memory.
     * @param data The byte array (Uint8Array) to write.
     * @param ptr The memory address to write to. Must be allocated beforehand.
     */
    public writeBytes(data: Uint8Array, ptr: number): void {
        const buffer = new Uint8Array(this.memory.buffer);
        buffer.set(data, ptr);
    }

    /**
     * Reads a byte array from the WASM module's linear memory.
     * @param ptr The memory address to start reading from.
     * @param len The number of bytes to read.
     * @returns A new Uint8Array containing the data read from memory.
     */
    public readBytes(ptr: number, len: number): Uint8Array {
        return new Uint8Array(this.memory.buffer, ptr, len);
    }

    /**
     * Cleans up resources by nullifying references to the instance and memory,
     * allowing them to be garbage collected.
     */
    public dispose(): void {
        // @ts-ignore
        this.instance = null;
        // @ts-ignore
        this.memory = null;
        console.log("WasmModule instance disposed.");
    }

    /**
     * Clears the static cache of compiled WebAssembly modules.
     */
    public static clearCache(): void {
        this.compiledModules.clear();
        console.log("WasmModule cache cleared.");
    }
}