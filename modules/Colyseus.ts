import { Logger } from "./Logger";

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

let ClientClass: new (serverAddress: string) => Client;
let isColyseusAvailable = false;

try {
    const Colyseus = require("colyseus.js");
    ClientClass = Colyseus.Client;
    isColyseusAvailable = true;
} catch (e) {
    // It's okay if Colyseus is not found, we'll use a dummy class.
}

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

    public async join<T = any>(roomName: string, options: any = {}): Promise<Room<T>> {
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
            Logger.error(`Failed to join room "${roomName}":`, e);
            this.eventEmitter.emit('onRoomJoinError', roomName, e);
            throw e;
        }
    }

    public async joinOrCreate<T = any>(roomName: string, options: any = {}): Promise<Room<T>> {
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
            Logger.error(`Failed to join or create room "${roomName}":`, e);
            this.eventEmitter.emit('onRoomJoinError', roomName, e);
            throw e;
        }
    }

    public async reconnect<T = any>(roomId: string, sessionId: string): Promise<Room<T>> {
        try {
            Logger.log(`Attempting to reconnect to room: ${roomId} with session: ${sessionId}`);
            const room = await this.client.reconnect<T>(roomId, sessionId);
            this.setupRoomListeners(room);
            this.currentRoom = room;
            Logger.log(`Reconnected to room: ${room.name} (ID: ${room.roomId})`);
            this.eventEmitter.emit('onReconnectSuccess', room);
            return room;
        } catch (e) {
            Logger.error(`Failed to reconnect to room "${roomId}" with session "${sessionId}":`, e);
            this.eventEmitter.emit('onReconnectError', roomId, sessionId, e);
            throw e;
        }
    }

    public async leaveCurrentRoom(consented: boolean = true): Promise<void> {
        if (this.currentRoom) {
            const roomName = this.currentRoom.name;
            const roomId = this.currentRoom.roomId;
            Logger.log(`Leaving room: ${roomName} (ID: ${roomId})`);
            await this.currentRoom.leave(consented);
            this.currentRoom = null;
            this.eventEmitter.emit('onRoomLeft', roomName, roomId);
        } else {
            Logger.warn("No room currently joined to leave.");
        }
    }

    public disconnect(): void {
        if (this.client) {
            this.currentRoom?.leave();
            this.currentRoom = null;
            Logger.log("Colyseus client disconnected.");
            this.eventEmitter.emit('onDisconnected');
            this._isConnected = false;
        } else {
            Logger.warn("Colyseus client is not initialized or already disconnected.");
        }
    }

    public async disconnectAndLeave(): Promise<void> {
        if (this.currentRoom) {
            await this.leaveCurrentRoom();
        }
        this.disconnect();
        Logger.log("Colyseus client disconnected and left room (if any).");
    }

    public sendMessage<M = any>(type: string, message: M): void {
        if (this.currentRoom) {
            Logger.log(`Sending message "${type}" to room ${this.currentRoom.roomId}`);
            this.currentRoom.send(type, message);
        } else {
            Logger.warn("Cannot send message: No room currently joined.");
        }
    }

    private setupRoomListeners<T = any>(room: Room<T>): void {
        room.onStateChange((state: T) => {
            this.eventEmitter.emit('onStateChange', state, room.roomId);
        });

        room.onMessage("*", (type: string, message: any) => {
            Logger.log(`Received message "${type}" in room ${room.roomId}:`, message);
            this.eventEmitter.emit('onMessage', type, message, room.roomId);
            this.eventEmitter.emit('onAnyMessage', type, message, room.roomId);
        });

        room.onError((code: number, message: string) => {
            Logger.error(`Room error in room ${room.roomId} (Code: ${code}): ${message}`);
            this.eventEmitter.emit('onError', code, message, room.roomId);
        });

        room.onLeave((code: number) => {
            Logger.log(`Left room (Code: ${code}): ${room.name} (ID: ${room.roomId})`);
            if (this.currentRoom === room) {
                this.currentRoom = null;
            }
            this.eventEmitter.emit('onRoomLeft', room.name, room.roomId, code);
        });
    }

    public getRoomState<T = any>(): T | null {
        return this.currentRoom ? (this.currentRoom.state as T) : null;
    }

    public onMessage<M = any>(type: string, handler: (message: M) => void): () => void {
        if (!this.currentRoom) {
            Logger.warn("No room currently joined to listen for messages.");
            return () => {};
        }
        const dispose = this.currentRoom.onMessage(type, handler);
        return () => dispose.remove();
    }

    public onRoomJoined(listener: (room: Room) => void): () => void {
        return this.eventEmitter.on('onRoomJoined', listener);
    }

    public onRoomLeft(listener: (roomName: string, roomId: string, code?: number) => void): () => void {
        return this.eventEmitter.on('onRoomLeft', listener);
    }

    public onReconnectSuccess(listener: (room: Room) => void): () => void {
        return this.eventEmitter.on('onReconnectSuccess', listener);
    }

    public onStateChange<T = any>(listener: (state: T, roomId: string) => void): () => void {
        return this.eventEmitter.on('onStateChange', listener);
    }

    public onError(listener: (code: number, message: string, roomId: string) => void): () => void {
        return this.eventEmitter.on('onError', listener);
    }

    public onDisconnected(listener: () => void): () => void {
        return this.eventEmitter.on('onDisconnected', listener);
    }

    public onRoomJoinError(listener: (roomName: string, error: any) => void): () => void {
        return this.eventEmitter.on('onRoomJoinError', listener);
    }

    public onReconnectError(listener: (roomId: string, sessionId: string, error: any) => void): () => void {
        return this.eventEmitter.on('onReconnectError', listener);
    }

    public onAnyMessage(listener: (type: string, message: any, roomId: string) => void): () => void {
        return this.eventEmitter.on('onAnyMessage', listener);
    }
}

class DummyColyseusClient {
    constructor(...args: any[]) {
        Logger.warn("Colyseus is not installed. All ColyseusClient operations will be ignored.");
    }
    public getClient() { Logger.warn("Colyseus not available."); return null; }
    public getCurrentRoom() { Logger.warn("Colyseus not available."); return null; }
    public isConnected() { Logger.warn("Colyseus not available."); return false; }
    public async join(...args: any[]) { Logger.warn("Colyseus not available."); throw new Error("Colyseus not available."); }
    public async joinOrCreate(...args: any[]) { Logger.warn("Colyseus not available."); throw new Error("Colyseus not available."); }
    public async reconnect(...args: any[]) { Logger.warn("Colyseus not available."); throw new Error("Colyseus not available."); }
    public async leaveCurrentRoom(...args: any[]) { Logger.warn("Colyseus not available."); }
    public disconnect() { Logger.warn("Colyseus not available."); }
    public async disconnectAndLeave() { Logger.warn("Colyseus not available."); }
    public sendMessage(...args: any[]) { Logger.warn("Colyseus not available."); }
    public getRoomState() { Logger.warn("Colyseus not available."); return null; }
    public onMessage(...args: any[]): () => void { Logger.warn("Colyseus not available."); return () => {}; }
    public onRoomJoined(...args: any[]): () => void { Logger.warn("Colyseus not available."); return () => {}; }
    public onRoomLeft(...args: any[]): () => void { Logger.warn("Colyseus not available."); return () => {}; }
    public onReconnectSuccess(...args: any[]): () => void { Logger.warn("Colyseus not available."); return () => {}; }
    public onStateChange(...args: any[]): () => void { Logger.warn("Colyseus not available."); return () => {}; }
    public onError(...args: any[]): () => void { Logger.warn("Colyseus not available."); return () => {}; }
    public onDisconnected(...args: any[]): () => void { Logger.warn("Colyseus not available."); return () => {}; }
    public onRoomJoinError(...args: any[]): () => void { Logger.warn("Colyseus not available."); return () => {}; }
    public onReconnectError(...args: any[]): () => void { Logger.warn("Colyseus not available."); return () => {}; }
    public onAnyMessage(...args: any[]): () => void { Logger.warn("Colyseus not available."); return () => {}; }
}

export const ColyseusClient = isColyseusAvailable ? RealColyseusClient : DummyColyseusClient;
