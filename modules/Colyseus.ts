import { Logger } from "./Logger";
import * as RE from 'rogue-engine';
import * as THREE from 'three';
import { Prefab } from './Prefab';
import ColyseusStateSync from '../components/Colyseus/ColyseusStateSync.re';
import SmoothedTransform from '../components/Colyseus/SmoothedTransform.re';

// Define interfaces for Colyseus types to provide type safety
interface Room<T = any> {
    id: string;
    name: string;
    sessionId: string;
    state: T;
    onStateChange(callback: (state: T) => void): void;
    onMessage(messageType: "*", callback: (type: string | number, message: any) => void): any;
    onMessage<M>(messageType: string | number, callback: (message: M) => void): any;
    onError(callback: (code: number, message?: string) => void): void;
    onLeave(callback: (code: number) => void): void;
    send(type: string | number, message?: any): void;
    leave(consented?: boolean): Promise<number>;
    roomId: string;
}

interface Client {
    join<T>(roomName: string, options?: any): Promise<Room<T>>;
    joinOrCreate<T>(roomName: string, options?: any): Promise<Room<T>>;
    reconnect<T>(roomId: string, sessionId: string): Promise<Room<T>>;
}

// --- RPC Interfaces ---
interface RpcPromise {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    timeout: NodeJS.Timeout;
}

let ColyseusClient: any;

try {
    const Colyseus = require("colyseus.js");
    const ClientClass: new (serverAddress: string) => Client = Colyseus.Client;

    // Basic EventEmitter implementation
    interface EventEmitter {
        on(event: string, listener: (...args: any[]) => void): () => void;
        emit(event: string, ...args: any[]): void;
        off(event: string, listener: (...args: any[]) => void): void;
    }

    class BasicEventEmitter implements EventEmitter {
        private listeners: { [event: string]: Function[] } = {};

        on(event: string, listener: (...args: any[]) => void): () => void {
            if (!this.listeners[event]) {
                this.listeners[event] = [];
            }
            this.listeners[event].push(listener);
            return () => this.off(event, listener);
        }

        emit(event: string, ...args: any[]): void {
            if (this.listeners[event]) {
                this.listeners[event].forEach(listener => listener(...args));
            }
        }

        off(event: string, listener: (...args: any[]) => void): void {
            if (this.listeners[event]) {
                this.listeners[event] = this.listeners[event].filter(l => l !== listener);
            }
        }
    }

    class RealColyseusClient {
        private client: Client;
        private currentRoom: Room | null = null;
        private serverAddress: string;
        private eventEmitter: BasicEventEmitter = new BasicEventEmitter();
        private _isConnected: boolean = false;

        // --- V3 State Sync Properties ---
        private syncedCollections: Map<string, Map<string, any>> = new Map();
        private collectionPaths: string[] = [];
        private collectionListenersAttached: Map<string, boolean> = new Map();

        // --- Prefab Management Properties ---
        private collectionPrefabs: Map<string, string> = new Map();
        private syncedObjects: Map<string, THREE.Object3D> = new Map();
        private syncedObjectsReverse: Map<THREE.Object3D, string> = new Map();

        // --- RPC Properties ---
        private rpcRequestId: number = 0;
        private rpcPromises = new Map<number, RpcPromise>();
        public rpcTimeout: number = 10000; // 10 seconds


        constructor(serverAddress: string) {
            this.serverAddress = serverAddress;
            this.client = new ClientClass(serverAddress);
            Logger.log(`ColyseusClient initialized for server: ${serverAddress}`);
        }

        public getClient(): Client {
            return this.client;
        }

        public getCurrentRoom(): Room | null {
            return this.currentRoom;
        }

        public isConnected(): boolean {
            return this._isConnected;
        }

        // --- Prefab Management ---
        public setCollectionPrefab(collection: string, prefabName: string): void {
            Logger.log(`Registering prefab '${prefabName}' for collection '${collection}'`);
            this.collectionPrefabs.set(collection, prefabName);
        }

        public getSyncedObject(sessionId: string): THREE.Object3D | undefined {
            return this.syncedObjects.get(sessionId);
        }

        public getSessionId(object: THREE.Object3D): string | undefined {
            return this.syncedObjectsReverse.get(object);
        }

        public async overrideEntityPrefab(sessionId: string, newPrefabName: string): Promise<THREE.Object3D | null> {
            const oldObject = this.syncedObjects.get(sessionId);
            if (!oldObject) {
                Logger.warn(`Cannot override prefab for session ID '${sessionId}'. No existing object found.`);
                return null;
            }

            Logger.log(`Overriding prefab for ${sessionId}. New prefab: '${newPrefabName}'`);

            const transform = {
                position: oldObject.position.clone(),
                rotation: oldObject.rotation.clone(),
                scale: oldObject.scale.clone(),
            };

            const oldSyncComponent = RE.getComponent(ColyseusStateSync, oldObject);

            this.syncedObjects.delete(sessionId);
            this.syncedObjectsReverse.delete(oldObject);
            Prefab.destroy(oldObject);

            const newInstance = await Prefab.instantiate(newPrefabName, transform);

            if (newInstance) {
                this.syncedObjects.set(sessionId, newInstance);
                this.syncedObjectsReverse.set(newInstance, sessionId);
                Logger.log(`Successfully swapped prefab for ${sessionId}`);

                const newSyncComponent = RE.getComponent(ColyseusStateSync, newInstance);
                if (newSyncComponent && oldSyncComponent) {
                    newSyncComponent.sessionId = oldSyncComponent.sessionId;
                    newSyncComponent.state = oldSyncComponent.state;
                    Logger.log(`Transferred state to new prefab for ${sessionId}`);
                }

                return newInstance;
            } else {
                Logger.error(`Failed to instantiate new prefab '${newPrefabName}' for override.`);
                return null;
            }
        }

        // --- Dynamic Component Helpers ---

        public applyStateSyncer(sessionId: string): ColyseusStateSync | null {
            const obj = this.getSyncedObject(sessionId);
            if (!obj) {
                Logger.warn(`Cannot apply StateSyncer: No object found for session ID ${sessionId}`);
                return null;
            }

            let syncComponent = RE.getComponent(ColyseusStateSync, obj);
            if (syncComponent) {
                return syncComponent;
            }

            Logger.log(`Applying ColyseusStateSync to object for session ID ${sessionId}`);
            const newSyncComponent = new ColyseusStateSync('ColyseusStateSync', obj);
            RE.addComponent(newSyncComponent);
            
            const entityData = this.getEntity('players', sessionId) || this.getEntity('entities', sessionId);
            if (newSyncComponent && entityData) {
                newSyncComponent.sessionId = sessionId;
                newSyncComponent.state = entityData;
            }

            return newSyncComponent;
        }

        public applyTransformSyncer(sessionId: string): SmoothedTransform | null {
            const obj = this.getSyncedObject(sessionId);
            if (!obj) {
                Logger.warn(`Cannot apply TransformSyncer: No object found for session ID ${sessionId}`);
                return null;
            }

            this.applyStateSyncer(sessionId);

            let transformComponent = RE.getComponent(SmoothedTransform, obj);
            if (transformComponent) {
                return transformComponent;
            }

            Logger.log(`Applying SmoothedTransform to object for session ID ${sessionId}`);
            const newTransformComponent = new SmoothedTransform('SmoothedTransform', obj);
            RE.addComponent(newTransformComponent);
            return newTransformComponent;
        }

        // --- RPC Methods ---
        public rpc<T = any>(type: string, payload?: any): Promise<T> {
            if (!this.currentRoom) {
                return Promise.reject(new Error("Cannot send RPC: Not connected to a room."));
            }

            const requestId = ++this.rpcRequestId;
            const promise = new Promise<T>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    this.rpcPromises.delete(requestId);
                    reject(new Error(`RPC call '${type}' timed out after ${this.rpcTimeout}ms`));
                }, this.rpcTimeout);

                this.rpcPromises.set(requestId, { resolve, reject, timeout });
            });

            this.currentRoom.send("rpc", { type, requestId, payload });

            return promise;
        }

        private handleRpcResponse(message: any) {
            const { requestId, error, data } = message;

            const promise = this.rpcPromises.get(requestId);
            if (!promise) {
                Logger.warn(`Received RPC response for unknown request ID: ${requestId}`);
                return;
            }

            clearTimeout(promise.timeout);

            if (error) {
                promise.reject(new Error(error));
            } else {
                promise.resolve(data);
            }

            this.rpcPromises.delete(requestId);
        }

        // --- Connection Methods (Updated) ---

        public async join<T = any>(roomName: string, options: any = {}, syncOptions: { collections?: string[] } = {}): Promise<Room<T>> {
            this.collectionPaths = syncOptions.collections || [];
            try {
                Logger.log(`Attempting to join room: ${roomName}`);
                const room = await this.client.join<T>(roomName, options);
                this.setupRoomListeners(room);
                this.currentRoom = room;
                Logger.log(`Joined room: ${room.name} (ID: ${room.roomId})`);
                this.eventEmitter.emit('onRoomJoined', room);
                this._isConnected = true;
                this.eventEmitter.emit('onConnected');
                return room;
            } catch (e) {
                Logger.error(`Failed to join room "${roomName}"`, e);
                this.eventEmitter.emit('onRoomJoinError', roomName, e);
                throw e;
            }
        }

        public async joinOrCreate<T = any>(roomName: string, options: any = {}, syncOptions: { collections?: string[] } = {}): Promise<Room<T>> {
            this.collectionPaths = syncOptions.collections || [];
            try {
                Logger.log(`Attempting to join or create room: ${roomName}`);
                const room = await this.client.joinOrCreate<T>(roomName, options);
                this.setupRoomListeners(room);
                this.currentRoom = room;
                Logger.log(`Joined or created room: ${room.name} (ID: ${room.roomId})`);
                this.eventEmitter.emit('onRoomJoined', room);
                this._isConnected = true;
                this.eventEmitter.emit('onConnected');
                return room;
            } catch (e) {
                Logger.error(`Failed to join or create room "${roomName}"`, e);
                this.eventEmitter.emit('onRoomJoinError', roomName, e);
                throw e;
            }
        }

        public async leaveCurrentRoom(consented: boolean = true): Promise<void> {
            if (this.currentRoom) {
                const roomName = this.currentRoom.name;
                const roomId = this.currentRoom.roomId;
                Logger.log(`Leaving room: ${roomName} (ID: ${roomId})`);
                await this.currentRoom.leave(consented);
            } else {
                Logger.warn("No room currently joined to leave.");
            }
        }

        public disconnect(): void {
            if (this.client) {
                this.currentRoom?.leave();
                this.currentRoom = null;
                this._isConnected = false;
                Logger.log("Colyseus client disconnected.");
                this.eventEmitter.emit('onDisconnected');
            } else {
                Logger.warn("Colyseus client is not initialized or already disconnected.");
            }
        }

        // --- State Management and Cleanup ---

        private cleanupState(): void {
            this.syncedCollections.clear();
            this.collectionListenersAttached.clear();

            for (const [sessionId, object] of this.syncedObjects) {
                Logger.log(`Cleaning up synced object for session ID: ${sessionId}`);
                Prefab.destroy(object);
            }
            this.syncedObjects.clear();
            this.syncedObjectsReverse.clear();

            // Reject any pending RPC promises
            for (const [requestId, promise] of this.rpcPromises) {
                clearTimeout(promise.timeout);
                promise.reject(new Error("Client disconnected, RPC call cancelled."));
            }
            this.rpcPromises.clear();

            Logger.log("Cleared all synced collections and objects.");
        }

        // --- Messaging ---

        public sendMessage<M = any>(type: string, message: M): void {
            if (this.currentRoom) {
                this.currentRoom.send(type, message);
            } else {
                Logger.warn("Cannot send message: No room currently joined.");
            }
        }

        // --- Data Accessors (Updated) ---

        public getLocalSessionId(): string | null {
            return this.currentRoom ? this.currentRoom.sessionId : null;
        }

        public getEntity<T = any>(collection: string, sessionId: string): T | null {
            const collectionMap = this.syncedCollections.get(collection);
            return collectionMap ? (collectionMap.get(sessionId) || null) : null;
        }

        public getCollection<T = any>(collection: string): Map<string, T> | null {
            return this.syncedCollections.get(collection) || null;
        }

        public getCollectionAsArray<T = any>(collection: string): T[] {
            const collectionMap = this.syncedCollections.get(collection);
            return collectionMap ? Array.from(collectionMap.values()) : [];
        }

        // --- Core Synchronization Logic ---

        private setupRoomListeners<T = any>(room: Room<T>): void {
            this.cleanupState();

            room.onStateChange((state: any) => {
                for (const collectionPath of this.collectionPaths) {
                    if (state[collectionPath] && !this.collectionListenersAttached.has(collectionPath)) {
                        Logger.log(`Attaching state sync listeners to \"state.${collectionPath}\"`);
                        this.syncedCollections.set(collectionPath, new Map<string, any>());

                        const entityMap = state[collectionPath];

                        entityMap.forEach((entity: any, sessionId: string) => {
                            const collection = this.syncedCollections.get(collectionPath)!;
                            if (!collection.has(sessionId)) {
                                collection.set(sessionId, entity);
                                this.handleEntityAdd(collectionPath, sessionId, entity);
                                this.attachPatchListener(collectionPath, sessionId, entity);
                            }
                        });

                        entityMap.onAdd = (entity: any, sessionId: string) => {
                            const collection = this.syncedCollections.get(collectionPath)!;
                            collection.set(sessionId, entity);
                            this.handleEntityAdd(collectionPath, sessionId, entity);
                            this.attachPatchListener(collectionPath, sessionId, entity);
                        };

                        entityMap.onChange = (entity: any, sessionId: string) => {
                            const collection = this.syncedCollections.get(collectionPath)!;
                            collection.set(sessionId, entity);

                            const syncObject = this.syncedObjects.get(sessionId);
                            if (syncObject) {
                                const syncComponent = RE.getComponent(ColyseusStateSync, syncObject);
                                if (syncComponent) {
                                    syncComponent.state = entity;
                                }
                            }

                            this.eventEmitter.emit('onEntityUpdated', collectionPath, sessionId, entity);
                        };

                        entityMap.onRemove = (_entity: any, sessionId: string) => {
                            const collection = this.syncedCollections.get(collectionPath)!;
                            if (collection.has(sessionId)) {
                                collection.delete(sessionId);
                                this.handleEntityRemove(collectionPath, sessionId);
                            }
                        };

                        this.collectionListenersAttached.set(collectionPath, true);
                    }
                }
            });

            room.onMessage("*", (type: string | number, message: any) => {
                if (type === "rpc_response") {
                    this.handleRpcResponse(message);
                } else {
                    this.eventEmitter.emit('onAnyMessage', type, message, room.roomId);
                }
            });

            room.onError((code: number, message: string) => {
                Logger.error(`Room error (Code: ${code}): ${message}`);
                this.eventEmitter.emit('onError', code, message, room.roomId);
                this.cleanupState();
            });

            room.onLeave((code: number) => {
                Logger.log(`Left room (Code: ${code})`);
                const roomName = this.currentRoom?.name || 'unknown';
                const roomId = this.currentRoom?.roomId || 'unknown';
                if (this.currentRoom === room) {
                    this.currentRoom = null;
                }
                this.cleanupState();
                this.eventEmitter.emit('onRoomLeft', roomName, roomId, code);
            });
        }

        private async handleEntityAdd(collection: string, sessionId: string, entity: any) {
            Logger.log(`Entity added to '${collection}': ${sessionId}`);

            const prefabName = this.collectionPrefabs.get(collection);
            if (prefabName) {
                const options: any = {};
                if (entity.x !== undefined && entity.y !== undefined && entity.z !== undefined) {
                    options.position = new THREE.Vector3(entity.x, entity.y, entity.z);
                }

                const instance = await Prefab.instantiate(prefabName, options);
                if (instance) {
                    this.syncedObjects.set(sessionId, instance);
                    this.syncedObjectsReverse.set(instance, sessionId);
                    Logger.log(`Successfully instantiated prefab for ${sessionId}`);

                    const syncComponent = RE.getComponent(ColyseusStateSync, instance);
                    if (syncComponent) {
                        syncComponent.sessionId = sessionId;
                        syncComponent.state = entity;
                        Logger.log(`Initialized ColyseusStateSync component for ${sessionId}`);
                    }
                } else {
                    Logger.error(`Failed to instantiate prefab '${prefabName}' for ${sessionId}`);
                }
            }

            this.eventEmitter.emit('onEntityAdded', collection, sessionId, entity);
        }

        private handleEntityRemove(collection: string, sessionId: string) {
            Logger.log(`Entity removed from '${collection}': ${sessionId}`);

            const object = this.syncedObjects.get(sessionId);
            if (object) {
                Logger.log(`Destroying synced prefab for session ID ${sessionId}`);
                this.syncedObjects.delete(sessionId);
                this.syncedObjectsReverse.delete(object);
                Prefab.destroy(object);
            }

            this.eventEmitter.emit('onEntityRemoved', collection, sessionId);
        }

        private attachPatchListener(collection: string, sessionId: string, entity: any): void {
            if (entity.onChange) {
                entity.onChange = (changes: any[]) => {
                    const syncObject = this.syncedObjects.get(sessionId);
                    if (syncObject) {
                        const syncComponent = RE.getComponent(ColyseusStateSync, syncObject);
                        if (syncComponent) {
                            changes.forEach(change => {
                                syncComponent.state[change.field] = change.value;
                            });
                        }
                    }
                    this.eventEmitter.emit('onEntityPatched', collection, sessionId, changes);
                };
            }
        }

        // --- Public Event Subscription Methods (Updated) ---

        public onEntityAdded(listener: (collection: string, sessionId: string, entity: any) => void): () => void {
            return this.eventEmitter.on('onEntityAdded', listener);
        }

        public onEntityUpdated(listener: (collection: string, sessionId: string, entity: any) => void): () => void {
            return this.eventEmitter.on('onEntityUpdated', listener);
        }

        public onEntityPatched(listener: (collection: string, sessionId: string, patch: any[]) => void): () => void {
            return this.eventEmitter.on('onEntityPatched', listener);
        }

        public onEntityRemoved(listener: (collection: string, sessionId: string) => void): () => void {
            return this.eventEmitter.on('onEntityRemoved', listener);
        }

        public onRoomJoined(listener: (room: Room) => void): () => void {
            return this.eventEmitter.on('onRoomJoined', listener);
        }

        public onRoomLeft(listener: (roomName: string, roomId: string, code?: number) => void): () => void {
            return this.eventEmitter.on('onRoomLeft', listener);
        }

        public onError(listener: (code: number, message: string, roomId: string) => void): () => void {
            return this.eventEmitter.on('onError', listener);
        }

        public onAnyMessage(listener: (type: string, message: any, roomId: string) => void): () => void {
            return this.eventEmitter.on('onAnyMessage', listener);
        }
    }
    ColyseusClient = RealColyseusClient;

} catch (e) {
    Logger.warn("colyseus.js package not found. Colyseus features will be unavailable.");

    ColyseusClient = class ColyseusClientUnavailable {
        constructor() {
            throw new Error("Colyseus is not available. Please install the 'colyseus.js' package.");
        }
    }
}

export { ColyseusClient };