
import { Client, Room } from "colyseus.js";
import { Logger } from "./Logger";

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

/**
 * # ColyseusClient - Real-time Multiplayer Integration
 * Provides a robust and easy-to-use interface for integrating Colyseus real-time multiplayer
 * capabilities into your Rogue Engine web applications and games.
 *
 * --- USAGE ---
 *
 * ### 1. Basic Setup and Room Joining
 * ```typescript
 * import { ColyseusClient } from "./Colyseus";
 *
 * // Initialize the client with your Colyseus server address
 * const colyseus = new ColyseusClient("ws://localhost:2567");
 *
 * async function connectAndJoin() {
 *     try {
 *         // Join or create a room named "my_room"
 *         const room = await colyseus.joinOrCreate("my_room", { options  });
 *         console.log("Joined successfully:", room.name, room.roomId);
 *
 *         // Listen for state changes
 *         room.onStateChange((state) => {
 *             console.log("Room state changed:", state);
 *         });
 *
 *         // Listen for custom messages from the server
 *         room.onMessage("my_message_type", (message) => {
 *             console.log("Received message:", message);
 *         });
 *
 *         // Send a message to the room
 *         room.send("player_action", { action: "move", x: 10, y: 5 });
 *
 *     } catch (e) {
 *         console.error("Join error:", e);
 *     }
 * }
 *
 * connectAndJoin();
 * ```
 *
 * ### 2. Event Handling
 * ```typescript
 * import { ColyseusClient } from "./Colyseus";
 *
 * const colyseus = new ColyseusClient("ws://localhost:2567");
 *
 * // Listen for connection status changes
 * colyseus.onConnected(() => {
 *     console.log("Colyseus client connected to server.");
 * });
 *
 * colyseus.onDisconnected(() => {
 *     console.log("Colyseus client disconnected from server.");
 * });
 *
 * // Listen for room-specific events
 * colyseus.onRoomJoined((room) => {
 *     console.log(`Client joined room: ${room.name} (${room.roomId})`);
 * });
 *
 * colyseus.onRoomLeft((roomName, roomId, code) => {
 *     console.log(`Client left room: ${roomName} (${roomId}) with code ${code}`);
 * });
 *
 * colyseus.onError((code, message, roomId) => {
 *     console.error(`Error in room ${roomId}: [${code}] ${message}`);
 * });
 *
 * // You can also listen for any message received by the client
 * colyseus.onAnyMessage((type, message, roomId) => {
 *     console.log(`Received any message of type "${type}" from room ${roomId}:`, message);
 * });
 *
 * // Don't forget to call a join method to initiate connection
 * // colyseus.joinOrCreate("my_room");
 * ```
 *
 * ### 3. Reconnection and Disconnection
 * ```typescript
 * import { ColyseusClient } from "./Colyseus";
 *
 * const colyseus = new ColyseusClient("ws://localhost:2567");
 * let currentRoomId: string | null = null;
 * let currentSessionId: string | null = null;
 *
 * async function exampleFlow() {
 *     try {
 *         const room = await colyseus.joinOrCreate("reconnect_test_room");
 *         currentRoomId = room.roomId;
 *         currentSessionId = room.sessionId;
 *         console.log("Initial join successful. Room ID:", currentRoomId, "Session ID:", currentSessionId);
 *
 *         // Simulate a temporary disconnection and then try to reconnect
 *         // In a real app, this might happen due to network issues
 *         colyseus.disconnect();
 *         console.log("Simulated disconnection.");
 *
 *         // After some time, try to reconnect
 *         if (currentRoomId && currentSessionId) {
 *             console.log("Attempting to reconnect...");
 *             const reconnectedRoom = await colyseus.reconnect(currentRoomId, currentSessionId);
 *             console.log("Reconnection successful:", reconnectedRoom.name, reconnectedRoom.roomId);
 *         }
 *
 *         // When done, leave the room and disconnect
 *         await colyseus.disconnectAndLeave();
 *         console.log("Cleanly disconnected and left room.");
 *
 *     } catch (e) {
 *         console.error("Operation failed:", e);
 *     }
 * }
 *
 * exampleFlow();
 * ```
 *
 * --- END USAGE ---
 */
export class ColyseusClient {
    private client: Client;
    private currentRoom: Room | null = null;
    private serverAddress: string;
    private eventEmitter: BasicEventEmitter = new BasicEventEmitter();
    private _isConnected: boolean = false;

    /**
     * Initializes the Colyseus client with the server address.
     * @param serverAddress The WebSocket address of your Colyseus server (e.g., "ws://localhost:2567").
     */
    constructor(serverAddress: string) {
        this.serverAddress = serverAddress;
        this.client = new Client(serverAddress);
        Logger.log(`ColyseusClient initialized for server: ${serverAddress}`);
    }

    /**
     * Gets the Colyseus client instance.
     * @returns The Colyseus Client instance.
     */
    public getClient(): Client {
        return this.client;
    }

    /**
     * Gets the currently joined Colyseus room instance.
     * @returns The Colyseus Room instance, or null if not joined to a room.
     */
    public getCurrentRoom(): Room | null {
        return this.currentRoom;
    }

    /**
     * Gets the current connection status of the Colyseus client.
     * @returns True if the client is connected to a Colyseus server, false otherwise.
     */
    public isConnected(): boolean {
        return this._isConnected;
    }

    /**
     * Joins an existing Colyseus room.
     * @param roomName The name of the room to join.
     * @param options Optional. Options to send to the room upon joining.
     * @returns A Promise that resolves with the joined Room instance.
     */
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

    /**
     * Creates a new Colyseus room, or joins it if it already exists.
     * @param roomName The name of the room to create or join.
     * @param options Optional. Options to send to the room upon creation/joining.
     * @returns A Promise that resolves with the joined Room instance.
     */
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

    /**
     * Reconnects to a previously joined Colyseus room using its ID and session ID.
     * @param roomId The ID of the room to reconnect to.
     * @param sessionId The session ID of the client in that room.
     * @returns A Promise that resolves with the reconnected Room instance.
     */
    public async reconnect<T = any>(roomId: string, sessionId: string): Promise<Room<T>> {
        try {
            Logger.log(`Attempting to reconnect to room: ${roomId} with session: ${sessionId}`);
            const room = await this.client.reconnect<T>(roomId, sessionId as any);
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


    /**
     * Leaves the currently joined room.
     * @param consented Optional. Whether the client is leaving consensually.
     * @returns A Promise that resolves when the room is left.
     */
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

    /**
     * Disconnects the Colyseus client from the server.
     */
    public disconnect(): void {
        if (this.client) {
            this.currentRoom?.leave(); // Colyseus client has a disconnect method
            this.currentRoom = null;
            Logger.log("Colyseus client disconnected.");
            this.eventEmitter.emit('onDisconnected');
            this._isConnected = false;
        } else {
            Logger.warn("Colyseus client is not initialized or already disconnected.");
        }
    }

    /**
     * Leaves the current room and then disconnects the Colyseus client from the server.
     * This ensures a clean shutdown of the connection.
     */
    public async disconnectAndLeave(): Promise<void> {
        if (this.currentRoom) {
            await this.leaveCurrentRoom();
        }
        this.disconnect();
        Logger.log("Colyseus client disconnected and left room (if any).");
    }

    /**
     * Sends a message to the currently joined room.
     * @param type The message type.
     * @param message The message payload.
     */
    public sendMessage<M = any>(type: string, message: M): void {
        if (this.currentRoom) {
            Logger.log(`Sending message "${type}" to room ${this.currentRoom.roomId}`);
            this.currentRoom.send(type, message);
        } else {
            Logger.warn("Cannot send message: No room currently joined.");
        }
    }

    /**
     * Sets up common listeners for a Colyseus room and emits events.
     * @param room The Room instance to set up listeners for.
     */
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

    /**
     * Allows direct access to the room's state.
     * @returns The current state of the joined room, or null if no room is joined.
     */
    public getRoomState<T = any>(): T | null {
        return this.currentRoom ? (this.currentRoom.state as T) : null;
    }

    /**
     * Adds a listener for a specific message type on the current room.
     * @param type The message type to listen for.
     * @param handler The callback function to execute on message.
     * @returns A function to remove the listener.
     */
    public onMessage<M = any>(type: string, handler: (message: M) => void): () => void {
        if (!this.currentRoom) {
            Logger.warn("No room currently joined to listen for messages.");
            return () => {};
        }
        const dispose = this.currentRoom.onMessage(type, handler);
        return () => dispose.remove();
    }

    // Event Emitter methods for external subscription
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
