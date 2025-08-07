import { Utils } from "./Utils";
import { Logger } from "./Logger";

/**
 * A comprehensive module for handling browser storage, including localStorage, sessionStorage, and a powerful IndexedDB manager.
 * It provides a safe, typed, and convenient API for storing and retrieving data, from simple key-value pairs to large files.
 */

interface FileMetadata {
    name: string;
    size: number;
    type: string;
    lastModified: number;
}

interface StoredValue<T> {
    value: T;
    expiry?: number; // Unix timestamp in milliseconds
}

class IndexedDBManager {
    protected db: IDBDatabase | null = null;
    protected dbName: string;
    protected storeNames: string[];

    constructor(dbName: string = 'MateDB', storeNames: string[] = ['KeyValueStore']) {
        this.dbName = dbName;
        this.storeNames = storeNames;
    }

    protected openDB(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) {
                Logger.error("mate.Storage: IndexedDB is not supported in this browser.");
                return reject('IndexedDB not supported');
            }
            if (this.db) {
                return resolve(this.db);
            }

            const request = indexedDB.open(this.dbName, 2); // Version up for schema change

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                this.storeNames.forEach(storeName => {
                    if (!db.objectStoreNames.contains(storeName)) {
                        db.createObjectStore(storeName);
                    }
                });
            };

            request.onsuccess = (event) => {
                this.db = (event.target as IDBOpenDBRequest).result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                Logger.error("mate.Storage: IndexedDB error -", (event.target as IDBOpenDBRequest).error?.message);
                reject('IndexedDB error: ' + (event.target as IDBOpenDBRequest).error);
            };
        });
    }

    public async set(storeName: string, key: string, value: any, secret?: string): Promise<void> {
        const db = await this.openDB();
        return new Promise(async (resolve, reject) => {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            let dataToStore = value;
            if (secret) {
                try {
                    dataToStore = await Utils.encrypt(JSON.stringify(value), secret);
                } catch (e) {
                    Logger.error("mate.Storage: IndexedDB encryption failed.", e);
                    return reject(e);
                }
            }
            const request = store.put(dataToStore, key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    public async get<T>(storeName: string, key: string, secret?: string): Promise<T | null> {
        const db = await this.openDB();
        return new Promise(async (resolve, reject) => {
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            request.onsuccess = async () => {
                let result = request.result as T | string | null;
                if (result === null) {
                    return resolve(null);
                }
                if (secret && typeof result === 'string') {
                    try {
                        result = JSON.parse(await Utils.decrypt(result, secret));
                    } catch (e) {
                        Logger.error("mate.Storage: IndexedDB decryption failed.", e);
                        return resolve(null); // Or reject, depending on desired error handling
                    }
                }
                resolve(result as T);
            };
            request.onerror = () => reject(request.error);
        });
    }

    public async remove(storeName: string, key: string): Promise<void> {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    public async clear(storeName: string): Promise<void> {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

class FileStore extends IndexedDBManager {
    private fileStoreName = 'FileStore';
    private metadataStoreName = 'FileMetadataStore';

    constructor(dbName: string = 'MateDB') {
        super(dbName, ['FileStore', 'FileMetadataStore']);
    }

    public async storeFile(key: string, file: File | Blob, secret?: string): Promise<void> {
        const metadata: FileMetadata = {
            name: file instanceof File ? file.name : key,
            size: file.size,
            type: file.type,
            lastModified: file instanceof File ? file.lastModified : Date.now()
        };

        let fileContent: any = file;
        if (secret) {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const base64Content = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
                fileContent = await Utils.encrypt(base64Content, secret);
            } catch (e) {
                Logger.error("mate.Storage: File encryption failed.", e);
                throw e;
            }
        }

        await this.set(this.fileStoreName, key, fileContent); // Pass encrypted content
        await this.set(this.metadataStoreName, key, metadata);
    }

    public async retrieveFile(key: string, secret?: string): Promise<Blob | null> {
        let fileContent = await this.get<string | Blob>(this.fileStoreName, key, secret); // Pass secret to get
        if (fileContent === null) {
            return null;
        }

        if (secret && typeof fileContent === 'string') {
            try {
                const decryptedBase64 = await Utils.decrypt(fileContent, secret);
                const binaryString = atob(decryptedBase64);
                const len = binaryString.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                return new Blob([bytes], { type: (await this.get<FileMetadata>(this.metadataStoreName, key))?.type || 'application/octet-stream' });
            } catch (e) {
                Logger.error("mate.Storage: File decryption failed.", e);
                return null;
            }
        }
        return fileContent instanceof Blob ? fileContent : null; // Should be Blob if not encrypted
    }
}

export class Storage {

    private static getStorage(type: 'local' | 'session'): globalThis.Storage | null {
        try {
            return type === 'local' ? window.localStorage : window.sessionStorage;
        } catch (e) {
            Logger.error("mate.Storage: Browser storage is not available in this environment.", e);
            return null;
        }
    }

    private static async set<T>(type: 'local' | 'session', key: string, value: T, ttl?: number, secret?: string): Promise<boolean> {
        const storage = this.getStorage(type);
        if (!storage) return false;
        try {
            let dataToStore: string;

            if (ttl !== undefined) {
                // If TTL is specified, always wrap in StoredValue
                const storedItem: StoredValue<T> = { value: value, expiry: Date.now() + ttl };
                dataToStore = JSON.stringify(storedItem);
            } else if (typeof value === 'object' && value !== null) {
                // If no TTL and it's an object/array, stringify directly
                dataToStore = JSON.stringify(value);
            } else {
                // If no TTL and it's a primitive, store directly as string
                dataToStore = String(value);
            }

            if (secret) {
                dataToStore = await Utils.encrypt(dataToStore, secret);
            }
            storage.setItem(key, dataToStore);
            return true;
        } catch (e) {
            Logger.error(`mate.Storage: Failed to set item '${key}' in ${type}Storage.`, e);
            return false;
        }
    }

    private static async get<T>(type: 'local' | 'session', key: string, secret?: string): Promise<T | null> {
        const storage = this.getStorage(type);
        if (!storage) return null;
        try {
            let storedString = storage.getItem(key);
            if (storedString === null) return null;

            if (secret) {
                storedString = await Utils.decrypt(storedString, secret);
            }

            let result: T | null = null;
            try {
                const parsedValue = JSON.parse(storedString);
                // Check if it's a StoredValue object (has 'value' property and optionally 'expiry')
                // This check is crucial to differentiate between a StoredValue wrapper and a directly stored JSON object.
                if (typeof parsedValue === 'object' && parsedValue !== null && 'value' in parsedValue && (parsedValue as StoredValue<T>).value !== undefined && (Object.keys(parsedValue).length === 1 || (Object.keys(parsedValue).length === 2 && 'expiry' in parsedValue))) {
                    const storedItem = parsedValue as StoredValue<T>;
                    if (storedItem.expiry && Date.now() > storedItem.expiry) {
                        // Item has expired, remove it and return null
                        storage.removeItem(key);
                        return null;
                    }
                    result = storedItem.value;
                } else {
                    // It's a directly stored JSON object/array
                    result = parsedValue;
                }
            } catch (e) {
                // Not a valid JSON string, so it must be a directly stored primitive string
                result = storedString as unknown as T; // Cast directly
            }

            return result;
        } catch (e) {
            Logger.error(`mate.Storage: Failed to get or parse item '${key}' from ${type}Storage.`, e);
            return null;
        }
    }

    private static remove(type: 'local' | 'session', key: string): void {
        const storage = this.getStorage(type);
        if (storage) storage.removeItem(key);
    }

    private static clear(type: 'local' | 'session'): void {
        const storage = this.getStorage(type);
        if (storage) storage.clear();
    }

    private static getKeys(type: 'local' | 'session'): string[] {
        const storage = this.getStorage(type);
        if (!storage) return [];
        const keys: string[] = [];
        for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (key) {
                keys.push(key);
            }
        }
        Logger.log(`Storage keys: ${keys}`);
        return keys;
    }

    private static getUsage(type: 'local' | 'session'): number {
        const storage = this.getStorage(type);
        if (!storage) return 0;
        let total = 0;
        for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (key) {
                const value = storage.getItem(key);
                if (value) {
                    total += value.length; // Character count, roughly bytes for ASCII
                }
            }
        }
        Logger.log(`Storage usage: ${total} bytes`);
        return total;
    }

    private static async setMany(type: 'local' | 'session', items: { key: string, value: any, ttl?: number, secret?: string }[]): Promise<boolean> {
        let success = true;
        for (const item of items) {
            if (!(await Storage.set(type, item.key, item.value, item.ttl, item.secret))) {
                success = false;
            }
        }
        return success;
    }

    private static async getMany<T>(type: 'local' | 'session', keys: string[], secret?: string): Promise<(T | null)[]> {
        const results: (T | null)[] = [];
        for (const key of keys) {
            results.push(await Storage.get<T>(type, key, secret));
        }
        return results;
    }

    private static async setJson(type: 'local' | 'session', key: string, jsonKey: string, value: any, secret?: string): Promise<boolean> {
        try {
            let jsonObject = await Storage.get<any>(type, key, secret) || {};
            if (typeof jsonObject !== 'object' || jsonObject === null) {
                jsonObject = {}; // Ensure it's an object if it was null or not an object
            }
            jsonObject[jsonKey] = value;
            return await Storage.set(type, key, jsonObject, undefined, secret); // Pass secret to set
        } catch (e) {
            Logger.error(`mate.Storage: Failed to set JSON value for key '${key}' in ${type}Storage.`, e);
            return false;
        }
    }

    private static async getJson<T>(type: 'local' | 'session', key: string, jsonKey: string, secret?: string): Promise<T | null> {
        try {
            const jsonObject = await Storage.get<any>(type, key, secret); // Pass secret to get
            if (jsonObject && typeof jsonObject === 'object' && jsonKey in jsonObject) {
                return jsonObject[jsonKey] as T;
            }
            return null;
        } catch (e) {
            Logger.error(`mate.Storage: Failed to get JSON value for key '${key}' from ${type}Storage.`, e);
            return null;
        }
    }

    public static async requestPersistentStorage(): Promise<boolean> {
        if (navigator.storage && navigator.storage.persist) {
            return await navigator.storage.persist();
        }
        return Promise.reject('Persistent storage not supported');
    }

    public static local = {
        set: async <T>(key: string, value: T, ttl?: number, secret?: string) => Storage.set<T>('local', key, value, ttl, secret),
        get: async <T>(key: string, secret?: string) => Storage.get<T>('local', key, secret),
        remove: (key: string) => Storage.remove('local', key),
        clear: () => Storage.clear('local'),
        keys: () => Storage.getKeys('local'),
        usage: () => Storage.getUsage('local'),
        setMany: (items: { key: string, value: any, ttl?: number, secret?: string }[]) => Storage.setMany('local', items),
        getMany: <T>(keys: string[], secret?: string) => Storage.getMany<T>('local', keys, secret),
        setJson: (key: string, jsonKey: string, value: any, secret?: string) => Storage.setJson('local', key, jsonKey, value, secret),
        getJson: <T>(key: string, jsonKey: string, secret?: string) => Storage.getJson<T>('local', key, jsonKey, secret),
    };

    public static session = {
        set: async <T>(key: string, value: T, ttl?: number, secret?: string) => Storage.set<T>('session', key, value, ttl, secret),
        get: async <T>(key: string, secret?: string) => Storage.get<T>('session', key, secret),
        remove: (key: string) => Storage.remove('session', key),
        clear: () => Storage.clear('session'),
        keys: () => Storage.getKeys('session'),
        usage: () => Storage.getUsage('session'),
        setMany: (items: { key: string, value: any, ttl?: number, secret?: string }[]) => Storage.setMany('session', items),
        getMany: <T>(keys: string[], secret?: string) => Storage.getMany<T>('session', keys, secret),
        setJson: (key: string, jsonKey: string, value: any, secret?: string) => Storage.setJson('session', key, jsonKey, value, secret),
        getJson: <T>(key: string, jsonKey: string, secret?: string) => Storage.getJson<T>('session', key, jsonKey, secret),
    };

    public static idb = new IndexedDBManager();
    public static files = new FileStore();
}
