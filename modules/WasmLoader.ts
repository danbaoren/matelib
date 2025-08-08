/**
 * Represents a TypedArray instance.
 */
type TypedArray = Int8Array | Uint8Array | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array;

/**
 * Represents a constructor for a TypedArray.
 */
type TypedArrayConstructor = new (buffer: ArrayBuffer, byteOffset?: number, length?: number) => TypedArray;

/**
 * Defines the memory layout of a 'struct' in WebAssembly linear memory.
 * Each property maps a field name to its corresponding TypedArray type and byte offset.
 * An optional byteLength property can be used for runtime validation.
 */
type StructMapping<S> = {
    [P in keyof S]: { type: TypedArrayConstructor; offset: number };
} & {
    // Optional property for total struct size validation
    byteLength?: number;
};

/**
 * A feature-rich, class-based utility for loading, caching, and interacting with WebAssembly modules.
 * This version is enhanced with a generic type parameter `T` for type-safe function exports,
 * and includes full implementations for memory management, data transfer, and WebAssembly Table support.
 *
 * --- FEATURES ---
 * - **Module Caching:** Automatically caches compiled WASM modules to prevent redundant compilation.
 * - **Instance Management:** Each loaded module is wrapped in a `WasmModule` instance for easy management.
 * - **Memory Helpers:** Provides easy-to-use functions (`readString`, `writeString`, `readBytes`, `writeBytes`) to interact with WASM linear memory.
 * - **Type-Safe Exports:** A `Proxy` wraps the WASM exports, enabling type-safe calls with autocompletion (requires defining an interface `T`).
 * - **Explicit Memory Allocation/Deallocation:** Integrates with WASM's `malloc` and `free` (assumed to be exported) for proper memory management.
 * - **Shared Memory Support:** Can load modules with `SharedArrayBuffer` for multi-threaded scenarios.
 * - **WASM Table Integration:** Supports `WebAssembly.Table` for dynamic function calls and callbacks between JS and WASM.
 * - **Advanced Data Marshaling:** Helpers for reading/writing TypedArrays and conceptual 'structs'.
 * - **Resource Cleanup:** A `dispose` method for proper resource management.
 */
export class WasmModule<T extends WebAssembly.Exports = WebAssembly.Exports> {
    private static compiledModules: Map<string, WebAssembly.Module> = new Map();

    public instance: WebAssembly.Instance | null = null;
    public memory: WebAssembly.Memory | null = null;
    public table: WebAssembly.Table | null = null; // Stores WebAssembly function references
    public exports: T; // Type-safe proxy for exported WASM functions

    /**
     * Private constructor to ensure instantiation via the static `load` method.
     * @param instance The WebAssembly.Instance after instantiation.
     */
    private constructor(instance: WebAssembly.Instance) {
        this.instance = instance;
        const memoryExport = instance.exports.memory;

        // Validate and assign the WebAssembly.Memory object
        if (!(memoryExport instanceof WebAssembly.Memory)) {
            throw new Error("WASM module must export a 'memory' object.");
        }
        this.memory = memoryExport;

        // Validate and assign the WebAssembly.Table object if exported
        const tableExport = instance.exports.table;
        if (tableExport && !(tableExport instanceof WebAssembly.Table)) {
            throw new Error("WASM module exports a 'table' but it is not a WebAssembly.Table object.");
        }
        this.table = tableExport as WebAssembly.Table | null;

        // Create a Proxy to wrap the raw exports.
        // This provides type-safety for function calls and adds error handling for better DX.
        this.exports = new Proxy(instance.exports as T, {
            get: (target, prop) => {
                const func = target[prop as keyof T];
                if (typeof func === 'function') {
                    // Wrap exported functions to catch and log errors during invocation
                    return (...args: any[]) => {
                        try {
                            return func(...args);
                        } catch (error) {
                            console.error(`Error calling WASM function "${String(prop)}":`, error);
                            // In a production-grade library, you might integrate with source maps
                            // to provide more detailed stack traces pointing to original C++/Rust code.
                            throw error; // Re-throw the error after logging
                        }
                    };
                }
                return func;
            },
        });
    }

    /**
     * Loads, compiles, and instantiates a WebAssembly module using streaming compilation for optimal performance.
     * Utilizes a static cache to prevent redundant compilation of the same module URL.
     * @param url The URL of the .wasm file.
     * @param imports An object containing functions and values to be imported into the WASM instance.
     * This is where you pass JavaScript functions or global values WASM expects.
     * @param sharedMemory Optional. If true, the WASM linear memory will be a `SharedArrayBuffer`.
     * This is essential for multi-threaded WASM applications using Web Workers.
     * Requires appropriate `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy`
     * HTTP headers to be set on your server for security. Default is `false`.
     * @returns A Promise that resolves with a `WasmModule<T>` instance, where `T`
     * is an interface representing the WASM module's exports for type-safe interaction.
     * @throws Error if fetching, compiling, or instantiating the module fails.
     */
    public static async load<T extends WebAssembly.Exports>(
        url: string,
        imports: WebAssembly.Imports = {},
        sharedMemory: boolean = false
    ): Promise<WasmModule<T>> {
        try {
            let compiledModule = this.compiledModules.get(url);

            if (!compiledModule) {
                // Fetch the WASM file using streaming compilation, which compiles and
                // instantiates the module as it downloads, leading to faster startup times.
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Failed to fetch WASM module from ${url}: ${response.statusText}`);
                }
                compiledModule = await WebAssembly.compileStreaming(response);
                this.compiledModules.set(url, compiledModule); // Cache the compiled module for future loads
            }

            // Define the WebAssembly.Memory object.
            // `initial` and `maximum` sizes are specified in WebAssembly pages (1 page = 64KB).
            // `initial: 256` means 16MB. `maximum: 65536` means 4GB (the max for 32-bit WASM addressing).
            // Adjust these values based on your application's memory requirements.
            const memory = new WebAssembly.Memory({
                initial: 256,
                maximum: 65536,
                shared: sharedMemory, // Enable SharedArrayBuffer if `sharedMemory` is true
            });

            // Define the WebAssembly.Table object for storing function references.
            // `initial: 10` sets an initial size for the table. `element: 'anyfunc'` indicates it stores functions.
            const table = new WebAssembly.Table({
                initial: 10, // Initial size for the table of function references
                element: 'anyfunc'
            });

            // Ensure the 'env' object exists within imports, and attach the memory and table.
            // WASM modules typically import memory and a table from an 'env' object.
            imports.env = imports.env || {};
            imports.env.memory = memory;
            imports.env.table = table;

            // Instantiate the compiled module with the defined imports.
            const instance = await WebAssembly.instantiate(compiledModule, imports);

            // Return a new WasmModule instance, correctly typed with `T`.
            return new WasmModule<T>(instance);
        } catch (error) {
            console.error(`Error loading or instantiating WASM module from ${url}:`, error);
            throw error; // Re-throw the error to allow external error handling
        }
    }

    /**
     * Allocates a block of memory within the WASM module's linear memory.
     * This method assumes the WASM module exports a `malloc` function (e.g., from C/C++ runtime).
     * It uses the type-safe `exports` proxy.
     * @param size The number of bytes to allocate.
     * @returns The memory address (pointer) of the allocated block in WASM linear memory.
     * @throws Error if `malloc` is not exported by the WASM module or if allocation fails (returns 0).
     */
    public allocate(size: number): number {
        // Access malloc via the type-safe exports, assuming T includes 'malloc'
        const mallocFunc = (this.exports as any).malloc; // Cast to `any` for flexible access if T isn't fully defined

        if (typeof mallocFunc !== 'function') {
            throw new Error("WASM module must export a 'malloc' function for memory allocation. Please ensure your WASM module exports `malloc`.");
        }

        const ptr = mallocFunc(size);
        if (ptr === 0) { // Standard behavior for `malloc` returning 0 on failure
            throw new Error(`Failed to allocate ${size} bytes in WASM memory. malloc returned 0 (out of memory or invalid size).`);
        }
        return ptr;
    }

    /**
     * Deallocates a block of memory from the WASM module's linear memory.
     * This method assumes the WASM module exports a `free` function (e.g., from C/C++ runtime).
     * It uses the type-safe `exports` proxy.
     * @param ptr The memory address (pointer) of the block to free.
     * @throws Error if `free` is not exported by the WASM module.
     */
    public free(ptr: number): void {
        const freeFunc = (this.exports as any).free; // Cast to `any` for flexible access

        if (typeof freeFunc !== 'function') {
            throw new Error("WASM module must export a 'free' function for memory deallocation. Please ensure your WASM module exports `free`.");
        }
        freeFunc(ptr);
    }

    /**
     * Writes a JavaScript string into the WASM module's linear memory.
     * The string is encoded as UTF-8 and null-terminated, which is common for C/C++ interop.
     * Memory for the string is automatically allocated using the WASM module's `malloc`.
     * @param str The string to write into WASM memory.
     * @returns The memory address (pointer) where the string was written.
     * @throws Error if WASM memory is not available or if memory allocation fails.
     */
    public writeString(str: string): number {
        if (!this.memory) {
            throw new Error("WASM module memory is not available. Ensure it's exported and loaded correctly.");
        }
        const encoder = new TextEncoder();
        const encodedString = encoder.encode(str + '\0'); // Encode as UTF-8 and null-terminate

        // Allocate memory in WASM for the string using the `allocate` helper
        const ptr = this.allocate(encodedString.length);

        // Get a Uint8Array view of the entire WASM memory buffer
        const bufferView = new Uint8Array(this.memory.buffer);
        // Set the encoded string bytes into the WASM memory at the allocated pointer
        bufferView.set(encodedString, ptr);

        return ptr;
    }

    /**
     * Reads a null-terminated string from the WASM module's linear memory.
     * @param ptr The memory address (pointer) to start reading from.
     * @returns The decoded string read from WASM memory.
     * @throws Error if WASM memory is not available.
     */
    public readString(ptr: number): string {
        if (!this.memory) {
            throw new Error("WASM module memory is not available. Ensure it's exported and loaded correctly.");
        }
        // Create a Uint8Array view starting from the given pointer.
        // This view is "live" and reflects changes in the underlying WASM memory.
        const bufferView = new Uint8Array(this.memory.buffer, ptr);

        // Find the index of the null terminator (0 byte) to determine string length
        let end = 0;
        // Limit search to prevent reading past allocated boundaries if null terminator is missing
        const maxSearchLength = bufferView.length; // Or a more specific max if known from WASM
        while (end < maxSearchLength && bufferView[end] !== 0) {
            end++;
        }

        // Decode the subarray up to the null terminator (or the end of the view if no terminator)
        const decoder = new TextDecoder();
        return decoder.decode(bufferView.subarray(0, end));
    }

    /**
     * Writes a byte array (e.g., `Uint8Array`, `Float32Array` etc.) into the WASM module's linear memory.
     * Memory for the data is automatically allocated using the WASM module's `malloc`.
     * @param data The `TypedArray` (e.g., `Uint8Array`, `Float32Array`) containing the bytes to write.
     * @returns The memory address (pointer) where the data was written.
     * @throws Error if WASM memory is not available or if memory allocation fails.
     */
    public writeBytes(data: TypedArray): number {
        if (!this.memory) {
            throw new Error("WASM module memory is not available. Ensure it's exported and loaded correctly.");
        }
        // Allocate memory in WASM for the byte array based on its byteLength
        const ptr = this.allocate(data.byteLength);

        // Get a Uint8Array view of the entire WASM memory buffer
        const bufferView = new Uint8Array(this.memory.buffer);
        // Set the data's underlying bytes into WASM memory
        bufferView.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), ptr);

        return ptr;
    }

    /**
     * Reads a byte array from the WASM module's linear memory.
     * This method returns a new Uint8Array containing a *copy* of the data.
     * @param ptr The memory address (pointer) to start reading from.
     * @param len The number of bytes to read.
     * @returns A new `Uint8Array` containing the copied data read from WASM memory.
     * @throws Error if WASM memory is not available.
     */
    public readBytes(ptr: number, len: number): Uint8Array {
        // Reuses the `readBytesView` method to get a view and then copies it.
        // This is the safer default behavior.
        return new Uint8Array(this.readBytesView(ptr, len));
    }

    /**
     * Reads a byte array from the WASM module's linear memory and returns a direct *view*
     * of that memory. This is faster than `readBytes` as it avoids copying, but it is
     * potentially unsafe if the WASM memory grows and the underlying ArrayBuffer is detached.
     * Use with caution.
     * @param ptr The memory address (pointer) to start reading from.
     * @param len The number of bytes to read.
     * @returns A `Uint8Array` that is a direct view of the WASM memory buffer.
     * @throws Error if WASM memory is not available.
     */
    public readBytesView(ptr: number, len: number): Uint8Array {
        if (!this.memory) {
            throw new Error("WASM module memory is not available. Ensure it's exported and loaded correctly.");
        }
        // Return a direct view of the memory without copying.
        return new Uint8Array(this.memory.buffer, ptr, len);
    }

    /**
     * Retrieves the pointer (index) to a JavaScript function and stores it in the WASM Table.
     * This allows the function pointer to be passed to WASM functions, enabling WASM to call back into JavaScript.
     * @param func The JavaScript function to register and get a pointer for.
     * @returns The index in the WebAssembly.Table (which acts as the function pointer).
     * @throws Error if the WASM module does not export a 'table'.
     */
    public getFunctionPointer(func: (...args: any[]) => any): number {
        if (!this.table) {
            throw new Error("WASM module does not export a 'table' for function pointers. Ensure your WASM module exports a table.");
        }
        // Find the next available slot in the table
        const index = this.table.length;
        // Grow the table by 1 page (or as needed) if it's full
        if (index >= this.table.length) {
            this.table.grow(1); // Grow by one element, or multiple for efficiency if many callbacks are expected
        }
        // Set the JavaScript function into the table at the calculated index
        this.table.set(index, func);
        return index;
    }

    /**
     * Calls a JavaScript function that is stored in the WASM Table at a given pointer (index).
     * This is the mechanism for dynamic dispatch from JavaScript, allowing JS to call functions
     * that might have been dynamically added to the table by WASM or another JS part.
     * @param funcPtr The index (function pointer) of the function in the WebAssembly.Table.
     * @param args Arguments to pass to the function.
     * @returns The result of the function call.
     * @throws Error if the WASM module does not export a 'table' or if the pointer is invalid.
     */
    public callFunctionByPointer(funcPtr: number, ...args: any[]): any {
        if (!this.table) {
            throw new Error("WASM module does not export a 'table' for function pointers. Cannot call function by pointer.");
        }
        const func = this.table.get(funcPtr);
        if (typeof func !== 'function') {
            throw new Error(`Invalid function pointer: no JavaScript function found at table index ${funcPtr}.`);
        }
        return func(...args);
    }

    /**
     * Writes a `TypedArray` (e.g., `Float32Array`, `Int32Array`) into the WASM module's linear memory.
     * This is a specialized version of `writeBytes` that takes a `TypedArray` directly.
     * Memory for the array is automatically allocated using the WASM module's `malloc`.
     * @param data The `TypedArray` instance to write.
     * @returns The memory address (pointer) of the allocated block where the array data resides.
     * @throws Error if WASM memory is not available or if memory allocation fails.
     */
    public writeArray(data: TypedArray): number {
        return this.writeBytes(data); // Reuses the efficient writeBytes method
    }

    /**
     * Reads a `TypedArray` from the WASM module's linear memory.
     * @param ptr The memory address (pointer) to start reading from.
     * @param len The number of *elements* (not bytes) to read.
     * @param type The `TypedArrayConstructor` (e.g., `Float32Array`) specifying the data type.
     * @returns A new `TypedArray` instance containing the copied data read from WASM memory.
     * @throws Error if WASM memory is not available.
     */
    public readArray(ptr: number, len: number, type: TypedArrayConstructor): TypedArray {
        if (!this.memory) {
            throw new Error("WASM module memory is not available. Ensure it's exported and loaded correctly.");
        }
        const byteOffset = ptr;
        const elementSize = type.prototype.BYTES_PER_ELEMENT;
        const byteLength = len * elementSize;

        // Create a view on the raw memory buffer
        const view = new type(this.memory.buffer, byteOffset, len);
        // Return a copy to prevent issues if the underlying memory buffer detaches (e.g., after memory.grow())
        return new type(view.slice().buffer, 0, view.length);
    }

    /**
     * Reads data from WASM memory according to a defined 'struct' layout.
     * This method helps in deserializing C/C++ like structs into JavaScript objects.
     * @param ptr The memory address (pointer) to the start of the struct in WASM memory.
     * @param structMapping An object defining the field names, their `TypedArray` types, and their byte offsets within the struct.
     * @returns A JavaScript object (`S`) populated with the struct's data.
     * @throws Error if WASM memory is not available, or if the struct mapping is invalid.
     */
    public readStruct<S extends object>(ptr: number, structMapping: StructMapping<S>): S {
        if (!this.memory) {
            throw new Error("WASM module memory is not available. Ensure it's exported and loaded correctly.");
        }

        // Optional validation: check if the struct's byteLength is provided and if it fits in memory
        const { byteLength } = structMapping;
        if (byteLength !== undefined && ptr + byteLength > this.memory.buffer.byteLength) {
            throw new Error(`Struct read operation out of bounds. Attempting to read a struct of size ${byteLength} at address ${ptr}, but memory buffer size is only ${this.memory.buffer.byteLength}.`);
        }

        const result: Partial<S> = {};
        for (const key in structMapping) {
            // Skip the optional byteLength property
            if (key === 'byteLength') continue;

            if (Object.prototype.hasOwnProperty.call(structMapping, key)) {
                const { type, offset } = structMapping[key];
                const elementSize = type.prototype.BYTES_PER_ELEMENT;

                // Individual field validation: check if the field read goes out of bounds
                if (ptr + offset + elementSize > this.memory.buffer.byteLength) {
                    throw new Error(`Field '${key}' read operation out of bounds. Attempting to read at address ${ptr + offset}, which is past the end of the memory buffer.`);
                }

                // Create a TypedArray view for a single element at the specific offset
                const view = new type(this.memory.buffer, ptr + offset, 1);
                (result as any)[key] = view[0]; // Assign the first (and only) element
            }
        }
        return result as S;
    }

    /**
     * Writes data from a JavaScript object into WASM memory according to a defined 'struct' layout.
     * This method helps in serializing JavaScript objects into C/C++ like structs in WASM memory.
     * Memory for the struct must be allocated beforehand (e.g., using `allocate`).
     * @param ptr The memory address (pointer) where to write the struct data.
     * @param data The JavaScript object (`S`) containing the data to write.
     * @param structMapping An object defining the field names, their `TypedArray` types, and their byte offsets.
     * @throws Error if WASM memory is not available, or if the write operation goes out of bounds.
     */
    public writeStruct<S extends object>(ptr: number, data: S, structMapping: StructMapping<S>): void {
        if (!this.memory) {
            throw new Error("WASM module memory is not available. Ensure it's exported and loaded correctly.");
        }

        // Optional validation: check if the struct's byteLength is provided and if the write fits
        const { byteLength } = structMapping;
        if (byteLength !== undefined && ptr + byteLength > this.memory.buffer.byteLength) {
            throw new Error(`Struct write operation out of bounds. Attempting to write a struct of size ${byteLength} at address ${ptr}, but memory buffer size is only ${this.memory.buffer.byteLength}.`);
        }

        for (const key in structMapping) {
            // Skip the optional byteLength property
            if (key === 'byteLength') continue;

            if (Object.prototype.hasOwnProperty.call(structMapping, key)) {
                const { type, offset } = structMapping[key];
                const elementSize = type.prototype.BYTES_PER_ELEMENT;

                // Individual field validation: check if the field write goes out of bounds
                if (ptr + offset + elementSize > this.memory.buffer.byteLength) {
                    throw new Error(`Field '${key}' write operation out of bounds. Attempting to write at address ${ptr + offset}, which is past the end of the memory buffer.`);
                }

                // Create a TypedArray view for a single element at the specific offset
                const view = new type(this.memory.buffer, ptr + offset, 1);
                view[0] = (data as any)[key]; // Assign the value from the JS object to the WASM memory view
            }
        }
    }

    /**
     * Cleans up resources associated with this `WasmModule` instance.
     * This explicitly nullifies references to allow JavaScript's garbage collector to reclaim memory.
     * IMPORTANT: This method does NOT automatically free memory allocated *within* the WASM module's
     * linear memory (e.g., via `malloc`). You must manually call the `free` method for any pointers
     * you obtained using `allocate`, `writeString`, or `writeBytes` to prevent WASM memory leaks.
     */
    public dispose(): void {
        if (this.instance) {
            console.log("WasmModule instance disposed.");
        }
        // Nullify all internal references to aid garbage collection
        this.instance = null;
        this.memory = null;
        this.table = null;
        // The exports proxy itself can be GC'd when this object is GC'd,
        // but explicitly setting to null can sometimes help immediately.
        // @ts-ignore - Setting to null for cleanup
        this.exports = null;
    }

    /**
     * Clears the static cache of compiled WebAssembly modules.
     * Use this method if you need to force a re-download and re-compilation of a WASM module,
     * for example, after deploying a new version of the `.wasm` file to ensure the latest code is used.
     */
    public static clearCache(): void {
        this.compiledModules.clear();
        console.log("WasmModule cache cleared.");
    }
}