import * as RE from 'rogue-engine';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import RapierBody from '@RE/RogueEngine/rogue-rapier/Components/RapierBody.re';
import RogueRapier from '@RE/RogueEngine/rogue-rapier/Lib/RogueRapier';
import RapierBall from '@RE/RogueEngine/rogue-rapier/Components/Colliders/RapierBall.re';
import RapierCapsule from '@RE/RogueEngine/rogue-rapier/Components/Colliders/RapierCapsule.re';
import RapierCone from '@RE/RogueEngine/rogue-rapier/Components/Colliders/RapierCone.re';
import RapierCuboid from '@RE/RogueEngine/rogue-rapier/Components/Colliders/RapierCuboid.re';
import RapierCylinder from '@RE/RogueEngine/rogue-rapier/Components/Colliders/RapierCylinder.re';
import RapierTrimesh from '@RE/RogueEngine/rogue-rapier/Components/Colliders/RapierTrimesh.re';
import RapierConfig from '@RE/RogueEngine/rogue-rapier/Components/RapierConfig.re';
import { Scene } from './Scene';
import RapierCollider from '@RE/RogueEngine/rogue-rapier/Components/Colliders/RapierCollider';
import { Logger } from './Logger';

export enum BodyType {
    Dynamic = 0,
    Static = 1,
    KinematicPositionBased = 2,
    KinematicVelocityBased = 3,
}

export interface CollisionHandler {
    tags?: string[];
    onEnter?: (self: RapierBody, other: RapierBody) => void;
    onExit?: (self: RapierBody, other: RapierBody) => void;
    triggerOnce?: boolean;
    id?: string;
}

export interface TagPairHandler {
    onEnter?: (body1: RapierBody, body2: RapierBody) => void;
    onExit?: (body1: RapierBody, body2: RapierBody) => void;
}

interface VectorTween {
    body: RAPIER.RigidBody;
    target: THREE.Vector3;
    start: THREE.Vector3;
    startTime: number;
    duration: number;
}

interface QuaternionTween {
    body: RAPIER.RigidBody;
    target: THREE.Quaternion;
    start: THREE.Quaternion;
    startTime: number;
    duration: number;
}

interface CollisionListener {
    onStart?: ((otherBody: RapierBody, otherCollider: RAPIER.Collider, thisCollider: RAPIER.Collider) => void)[];
    onEnd?: ((otherBody: RapierBody, otherCollider: RAPIER.Collider, thisCollider: RAPIER.Collider) => void)[];
}

interface CollisionEvent {
    body1: RAPIER.RigidBody;
    body2: RAPIER.RigidBody;
    collider1: RAPIER.Collider;
    collider2: RAPIER.Collider;
}


type QueryOptions = {
    position: THREE.Vector3;
    rotation?: THREE.Quaternion;
} & (
    | { shape: 'sphere'; radius: number }
    | { shape: 'cuboid'; halfExtents: THREE.Vector3 }
    | { shape: 'capsule'; halfHeight: number; radius: number }
);

export class Rapier {
    private static _world: RAPIER.World;
    private static _eventQueue: RAPIER.EventQueue;

    private static activePositionTweens: Map<number, VectorTween> = new Map();
    private static activeRotationTweens: Map<number, QuaternionTween> = new Map();
    private static collisionListeners: Map<number, CollisionListener> = new Map();

    private static bodyTags: Map<number, string[]> = new Map();
    private static bodyHandlers: Map<number, CollisionHandler[]> = new Map();
    private static tagPairHandlers: Map<string, TagPairHandler> = new Map();

    // #region CORE
    // =================================================================

    public static get world(): RAPIER.World {
        if (!this._world) {
            this._world = RogueRapier.world;
        }
        return this._world;
    }

    public static get eventQueue(): RAPIER.EventQueue {
        if (!this._eventQueue) {
            this._eventQueue = RogueRapier.eventQueue;
            if (!this._eventQueue) {
                Logger.error("MATE.Rapier: Could not access RogueRapier.eventQueue. Collision events will not work.");
                this._eventQueue = new RAPIER.EventQueue(true);
            }
        }
        return this._eventQueue;
    }

    public static setupWorld(options: { gravity?: THREE.Vector3 } = {}): RapierConfig {
        let rapierConfig = RE.getComponent(RapierConfig, RE.Runtime.scene);
        if (rapierConfig) {
            if (options.gravity) {
                rapierConfig.gravity.copy(options.gravity);
                if (this.world) {
                    this.world.gravity = options.gravity;
                }
            }
        } else {
            rapierConfig = new RapierConfig("RapierConfig", RE.Runtime.scene);
            if (options.gravity) {
                rapierConfig.gravity.copy(options.gravity);
            }
            RE.addComponent(rapierConfig);
        }
        return rapierConfig;
    }

    public static update() {
        this.drainEvents();

        const now = RE.Runtime.clock.getElapsedTime();
        const deltaTime = RE.Runtime.deltaTime;
        const posTweensToDelete: number[] = [];
        const rotTweensToDelete: number[] = [];

        for (const [handle, tween] of this.activePositionTweens.entries()) {
            const elapsed = now - tween.startTime;
            const t = Math.min(elapsed / tween.duration, 1);
            const alpha = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            const newPos = new THREE.Vector3().lerpVectors(tween.start, tween.target, alpha);
            tween.body.setNextKinematicTranslation(newPos);
            if (t >= 1) {
                tween.body.setNextKinematicTranslation(tween.target);
                posTweensToDelete.push(handle);
            }
        }
        for (const handle of posTweensToDelete) this.activePositionTweens.delete(handle);

        for (const [handle, tween] of this.activeRotationTweens.entries()) {
            const elapsed = now - tween.startTime;
            const t = Math.min(elapsed / tween.duration, 1);
            const alpha = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            const newRot = new THREE.Quaternion().slerpQuaternions(tween.start, tween.target, alpha);
            tween.body.setNextKinematicRotation(newRot);
            if (t >= 1) {
                tween.body.setNextKinematicRotation(tween.target);
                rotTweensToDelete.push(handle);
            }
        }
        for (const handle of rotTweensToDelete) this.activeRotationTweens.delete(handle);

    }

    // #endregion

    // #region QUERIES
    // =================================================================

    public static raycast(origin: THREE.Vector3, direction: THREE.Vector3, maxToi: number = Infinity, solid: boolean = true): RAPIER.RayColliderHit | null {
        if (!this.world) return null;
        const ray = new RAPIER.Ray(origin, direction);
        return this.world.castRay(ray, maxToi, solid);
    }

    public static queryShape(options: QueryOptions, filter?: (collider: RAPIER.Collider) => boolean): THREE.Object3D[] {
        if (!this.world) {
            Logger.warn("Rapier.queryShape: Physics world is not initialized.");
            return [];
        }
        let queryShape: RAPIER.Shape;
        switch (options.shape) {
            case 'sphere':
                queryShape = new RAPIER.Ball(options.radius);
                break;
            case 'cuboid':
                queryShape = new RAPIER.Cuboid(options.halfExtents.x, options.halfExtents.y, options.halfExtents.z);
                break;
            case 'capsule':
                queryShape = new RAPIER.Capsule(options.halfHeight, options.radius);
                break;
            default:
                Logger.error("Rapier.queryShape: Invalid shape provided.");
                return [];
        }
        const queryPosition = options.position;
        const queryRotation = options.rotation || new THREE.Quaternion();
        const foundObjects = new Set<THREE.Object3D>();
        this.world.intersectionsWithShape(queryPosition, queryRotation, queryShape, (collider: RAPIER.Collider) => {
            if (filter && !filter(collider)) {
                return true;
            }
            const parentBody = collider.parent();
            if (parentBody) {
                const rapierBody = parentBody.userData as RapierBody;
                if (rapierBody && rapierBody.object3d) {
                    foundObjects.add(rapierBody.object3d);
                }
            }
            return true;
        });
        return Array.from(foundObjects);
    }

    public static inSphere(position: THREE.Vector3, radius: number, filter?: (collider: RAPIER.Collider) => boolean): THREE.Object3D[] {
        return this.queryShape({ shape: 'sphere', radius: radius, position: position }, filter);
    }

    public static inBox(position: THREE.Vector3, width: number, height: number, depth: number, filter?: (collider: RAPIER.Collider) => boolean): THREE.Object3D[] {
        const halfExtents = new THREE.Vector3(width / 2, height / 2, depth / 2);
        return this.queryShape({ shape: 'cuboid', halfExtents: halfExtents, position: position }, filter);
    }

    // #endregion

    // #region BODY
    // =================================================================

    public static getRapierBody(objectOrName: THREE.Object3D | string): RapierBody | undefined {
        const object3d = typeof objectOrName === 'string' ? Scene.findObjectByName(objectOrName) : objectOrName;
        if (!object3d) {
            if (typeof objectOrName === 'string') {
                Logger.warn(`Rapier.getRapierBody: Could not find object with name "${objectOrName}".`);
            }
            return undefined;
        }
        return RE.getComponent(RapierBody, object3d);
    }

    public static addRapierBody(objectOrName: THREE.Object3D | string, options: { bodyType?: BodyType, mass?: number } = {}): RapierBody | undefined {
        const object3d = typeof objectOrName === 'string' ? Scene.findObjectByName(objectOrName) : objectOrName;
        if (!object3d) {
            if (typeof objectOrName === 'string') {
                Logger.warn(`Rapier.addRapierBody: Could not find object with name "${objectOrName}".`);
            }
            return undefined;
        }
        const rapierBody = new RapierBody("RapierBody", object3d);
        rapierBody.type = options.bodyType || BodyType.Dynamic;
        rapierBody.mass = options.mass || 1;
        RE.addComponent(rapierBody);
        return rapierBody;
    }

    public static removeRapierBody(objectOrName: THREE.Object3D | string) {
        const body = this.getRapierBody(objectOrName);
        if (body) {
            RE.removeComponent(body);
        }
    }

    public static setBodyType(bodyOrObject: RapierBody | THREE.Object3D | string, type: BodyType, wakeUp: boolean = true) {
        const body = this._resolveBody(bodyOrObject);
        if (body) {
            body.setBodyType(type as unknown as RAPIER.RigidBodyType, wakeUp);
        }
    }

    public static getPosition(bodyOrObject: RapierBody | THREE.Object3D | string): THREE.Vector3 | null {
        const body = this._resolveBody(bodyOrObject);
        return body ? body.translation() as THREE.Vector3 : null;
    }

    public static getRotation(bodyOrObject: RapierBody | THREE.Object3D | string): THREE.Quaternion | null {
        const body = this._resolveBody(bodyOrObject);
        return body ? body.rotation() as THREE.Quaternion : null;
    }

    public static getLinearVelocity(bodyOrObject: RapierBody | THREE.Object3D | string): THREE.Vector3 | null {
        const body = this._resolveBody(bodyOrObject);
        return body ? body.linvel() as THREE.Vector3 : null;
    }

    public static setLinearVelocity(bodyOrObject: RapierBody | THREE.Object3D | string, velocity: THREE.Vector3) {
        const body = this._resolveBody(bodyOrObject);
        if (body) {
            body.setLinvel(velocity, true);
        }
    }

    public static setAngularVelocity(bodyOrObject: RapierBody | THREE.Object3D | string, velocity: THREE.Vector3) {
        const body = this._resolveBody(bodyOrObject);
        if (body) {
            body.setAngvel(velocity, true);
        }
    }

    public static isSleeping(bodyOrObject: RapierBody | THREE.Object3D | string): boolean {
        const body = this._resolveBody(bodyOrObject);
        return body ? body.isSleeping() : false;
    }

    public static wakeUp(bodyOrObject: RapierBody | THREE.Object3D | string) {
        const body = this._resolveBody(bodyOrObject);
        if (body) {
            body.wakeUp();
        }
    }

    public static teleport(bodyOrObject: RapierBody | THREE.Object3D | string, position: THREE.Vector3, rotation?: THREE.Quaternion) {
        const body = this._resolveBody(bodyOrObject);
        if (body) {
            this.activePositionTweens.delete(body.handle);
            this.activeRotationTweens.delete(body.handle);
            body.setTranslation(position, true);
            if (rotation) {
                body.setRotation(rotation, true);
            }
        }
    }

    public static move(bodyOrObject: RapierBody | THREE.Object3D | string, direction: THREE.Vector3 | 'forward' | 'backward' | 'left' | 'right' | 'up' | 'down', speed: number, options: { mode?: 'force' | 'velocity' | 'kinematic'; isWorldSpace?: boolean; applyOnAxes?: { x?: boolean, y?: boolean, z?: boolean }; deltaTime?: number; target?: THREE.Object3D; } = {}) {
        const body = this._resolveBody(bodyOrObject);
        if (!body) return;
        const { mode = 'force', applyOnAxes = { x: true, y: true, z: true }, deltaTime = RE.Runtime.deltaTime, target = null } = options;
        let finalDirection: THREE.Vector3;
        if (typeof direction === 'string') {
            let localDirection: THREE.Vector3;
            switch (direction) {
                case 'forward': localDirection = new THREE.Vector3(0, 0, -1); break;
                case 'backward': localDirection = new THREE.Vector3(0, 0, 1); break;
                case 'left': localDirection = new THREE.Vector3(-1, 0, 0); break;
                case 'right': localDirection = new THREE.Vector3(1, 0, 0); break;
                case 'up': localDirection = new THREE.Vector3(0, 1, 0); break;
                case 'down': localDirection = new THREE.Vector3(0, -1, 0); break;
                default:
                    Logger.warn(`Rapier.move: Invalid direction string "${direction}".`);
                    return;
            }
            if (target) {
                const targetQuaternion = target.getWorldQuaternion(new THREE.Quaternion());
                finalDirection = localDirection.applyQuaternion(targetQuaternion);
            } else {
                const bodyRotation = body.rotation();
                finalDirection = localDirection.applyQuaternion(bodyRotation as THREE.Quaternion);
            }
        } else {
            finalDirection = direction.clone();
            const isWorldSpace = options.isWorldSpace ?? true;
            if (!isWorldSpace) {
                const bodyRotation = body.rotation();
                finalDirection.applyQuaternion(bodyRotation as THREE.Quaternion);
            }
        }
        if (applyOnAxes.x === false) finalDirection.x = 0;
        if (applyOnAxes.y === false) finalDirection.y = 0;
        if (applyOnAxes.z === false) finalDirection.z = 0;
        if (finalDirection.lengthSq() === 0) {
            if (mode === 'velocity') {
                const currentVel = body.linvel();
                const newVel = new THREE.Vector3(applyOnAxes.x ? 0 : currentVel.x, applyOnAxes.y ? 0 : currentVel.y, applyOnAxes.z ? 0 : currentVel.z);
                body.setLinvel(newVel, true);
            }
            return;
        }
        finalDirection.normalize();
        switch (mode) {
            case 'force':
                const currentVelocity = body.linvel();
                const desiredVelocity = finalDirection.clone().multiplyScalar(speed);
                const velocityChange = desiredVelocity.sub(currentVelocity as THREE.Vector3);
                const requiredForce = velocityChange.multiplyScalar(body.mass() / deltaTime);
                body.addForce(requiredForce, true);
                break;
            case 'velocity':
                const targetVelocity = finalDirection.multiplyScalar(speed);
                const oldVel = body.linvel();
                if (applyOnAxes.x === false) targetVelocity.x = oldVel.x;
                if (applyOnAxes.y === false) targetVelocity.y = oldVel.y;
                if (applyOnAxes.z === false) targetVelocity.z = oldVel.z;
                body.setLinvel(targetVelocity, true);
                break;
            case 'kinematic':
                if (!body.isKinematic()) {
                    Logger.warn("Rapier.move: 'kinematic' mode can only be used on Kinematic bodies.");
                    return;
                }
                const currentPos = body.translation();
                const nextPos = new THREE.Vector3(currentPos.x, currentPos.y, currentPos.z).add(finalDirection.multiplyScalar(speed * deltaTime));
                body.setNextKinematicTranslation(nextPos);
                break;
        }
    }

    public static rotate(bodyOrObject: RapierBody | THREE.Object3D | string, axis: 'x' | 'y' | 'z', degreesPerSecond: number, options: { mode?: 'force' | 'velocity' | 'kinematic'; deltaTime?: number; } = {}) {
        const body = this._resolveBody(bodyOrObject);
        if (!body) return;
        const { mode = 'force', deltaTime = RE.Runtime.deltaTime } = options;
        const localAxis = new THREE.Vector3();
        if (axis === 'x') localAxis.set(1, 0, 0);
        else if (axis === 'y') localAxis.set(0, 1, 0);
        else if (axis === 'z') localAxis.set(0, 0, 1);
        else {
            Logger.warn(`Rapier.rotate: Invalid axis "${axis}". Use 'x', 'y', or 'z'.`);
            return;
        }
        const angularSpeed = THREE.MathUtils.degToRad(degreesPerSecond);
        switch (mode) {
            case 'force':
            case 'velocity':
                const bodyRotation = body.rotation() as THREE.Quaternion;
                const worldAxis = localAxis.clone().applyQuaternion(bodyRotation);
                const targetAngvel = worldAxis.multiplyScalar(angularSpeed);
                if (mode === 'force') {
                    body.addTorque(targetAngvel, true);
                } else {
                    body.setAngvel(targetAngvel, true);
                }
                break;
            case 'kinematic':
                if (!body.isKinematic()) {
                    Logger.warn("Rapier.rotate: 'kinematic' mode can only be used on Kinematic bodies.");
                    return;
                }
                const currentRotation = new THREE.Quaternion().copy(body.rotation() as THREE.Quaternion);
                const rotationDelta = new THREE.Quaternion().setFromAxisAngle(localAxis, angularSpeed * deltaTime);
                const nextRotation = currentRotation.multiply(rotationDelta);
                body.setNextKinematicRotation(nextRotation);
                break;
        }
    }

    public static rotateTowards(bodyOrObject: RapierBody | THREE.Object3D | string, targetDirection: THREE.Vector3, speed: number, options: { deltaTime?: number } = {}) {
        const body = this._resolveBody(bodyOrObject);
        if (!body) return;
        if (targetDirection.lengthSq() === 0) {
            body.setAngvel({ x: 0, y: 0, z: 0 }, true);
            return;
        }
        const { deltaTime = RE.Runtime.deltaTime } = options;
        const currentRotation = new THREE.Quaternion().copy(body.rotation() as THREE.Quaternion);
        const up = new THREE.Vector3(0, 1, 0);
        const targetQuaternion = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), targetDirection.clone().normalize(), up));
        const slerpedRotation = currentRotation.rotateTowards(targetQuaternion, speed * deltaTime);
        if (body.isKinematic()) {
            body.setNextKinematicRotation(slerpedRotation);
        } else {
            const q_diff = slerpedRotation.clone().multiply(new THREE.Quaternion().copy(body.rotation() as THREE.Quaternion).invert());
            let angle = 2 * Math.acos(q_diff.w);
            if (angle > Math.PI) {
                angle -= 2 * Math.PI;
            }
            const axis = new THREE.Vector3(q_diff.x, q_diff.y, q_diff.z);
            if (axis.lengthSq() > 0) {
                axis.normalize();
                const angularVelocity = axis.multiplyScalar(angle / deltaTime);
                body.setAngvel(angularVelocity, true);
            }
        }
    }

    public static jump(bodyOrObject: RapierBody | THREE.Object3D | string, jumpStrength: number) {
        const body = this._resolveBody(bodyOrObject);
        if (!body) return;
        const currentVel = body.linvel();
        body.setLinvel({ x: currentVel.x, y: jumpStrength, z: currentVel.z }, true);
    }

    // #endregion

    // #region COLLIDERS
    // =================================================================

    public static getAllColliders(objectOrName: THREE.Object3D | string): RE.Component[] {
        const object3d = typeof objectOrName === 'string' ? Scene.findObjectByName(objectOrName) : objectOrName;
        if (!object3d) {
            if (typeof objectOrName === 'string') {
                Logger.warn(`Rapier.getAllColliders: Could not find object with name "${objectOrName}".`);
            }
            return [];
        }
        const allComponents = Scene.getAllComponents(object3d);
        const colliderComponentClasses = [RapierBall, RapierCuboid, RapierCapsule, RapierCone, RapierCylinder, RapierTrimesh];
        return allComponents.filter(comp => colliderComponentClasses.some(colliderClass => comp instanceof colliderClass));
    }

    public static getCollider<T extends RE.Component>(objectOrName: THREE.Object3D | string, type: 'ball' | 'cuboid' | 'capsule' | 'cone' | 'cylinder' | 'trimesh'): T | null {
        const object3d = typeof objectOrName === 'string' ? Scene.findObjectByName(objectOrName) : objectOrName;
        if (!object3d) {
            if (typeof objectOrName === 'string') {
                Logger.warn(`Rapier.getCollider: Could not find object with name "${objectOrName}".`);
            }
            return null;
        }
        let componentClass: any;
        switch (type) {
            case 'ball': componentClass = RapierBall; break;
            case 'cuboid': componentClass = RapierCuboid; break;
            case 'capsule': componentClass = RapierCapsule; break;
            case 'cone': componentClass = RapierCone; break;
            case 'cylinder': componentClass = RapierCylinder; break;
            case 'trimesh': componentClass = RapierTrimesh; break;
            default: return null;
        }
        return RE.getComponent(componentClass, object3d) as T | null;
    }

    public static getOrAddCollider(objectOrName: THREE.Object3D | string, type: 'ball', options: { radius: number, isSensor?: boolean, collisionEvents?: boolean }): RapierBall | null;
    public static getOrAddCollider(objectOrName: THREE.Object3D | string, type: 'cuboid', options?: { halfExtents?: THREE.Vector3, isSensor?: boolean, collisionEvents?: boolean }): RapierCuboid | null;
    public static getOrAddCollider(objectOrName: THREE.Object3D | string, type: 'capsule', options: { halfHeight: number, radius: number, isSensor?: boolean, collisionEvents?: boolean }): RapierCapsule | null;
    public static getOrAddCollider(objectOrName: THREE.Object3D | string, type: 'cone', options: { halfHeight: number, radius: number, isSensor?: boolean, collisionEvents?: boolean }): RapierCone | null;
    public static getOrAddCollider(objectOrName: THREE.Object3D | string, type: 'cylinder', options: { halfHeight: number, radius: number, isSensor?: boolean, collisionEvents?: boolean }): RapierCylinder | null;
    public static getOrAddCollider(objectOrName: THREE.Object3D | string, type: 'trimesh', options?: { isSensor?: boolean, collisionEvents?: boolean }): RapierTrimesh | null;
    public static getOrAddCollider(objectOrName: THREE.Object3D | string, type: string, options?: any): RE.Component | undefined | null {
        let collider = this.getCollider(objectOrName, type as any);
        if (!collider) {
            collider = this.addCollider(objectOrName, type as any, options);
        }
        return collider;
    }

    public static addCollider(objectOrName: THREE.Object3D | string, type: 'ball', options: { radius: number, isSensor?: boolean, collisionEvents?: boolean }): RapierBall | null;
    public static addCollider(objectOrName: THREE.Object3D | string, type: 'cuboid', options?: { halfExtents?: THREE.Vector3, isSensor?: boolean, collisionEvents?: boolean }): RapierCuboid | null;
    public static addCollider(objectOrName: THREE.Object3D | string, type: 'capsule', options: { halfHeight: number, radius: number, isSensor?: boolean, collisionEvents?: boolean }): RapierCapsule | null;
    public static addCollider(objectOrName: THREE.Object3D | string, type: 'cone', options: { halfHeight: number, radius: number, isSensor?: boolean, collisionEvents?: boolean }): RapierCone | null;
    public static addCollider(objectOrName: THREE.Object3D | string, type: 'cylinder', options: { halfHeight: number, radius: number, isSensor?: boolean, collisionEvents?: boolean }): RapierCylinder | null;
    public static addCollider(objectOrName: THREE.Object3D | string, type: 'trimesh', options?: { isSensor?: boolean, collisionEvents?: boolean }): RapierTrimesh | null;
    public static addCollider(objectOrName: THREE.Object3D | string, type: string, options?: any): RE.Component | undefined | null {
        const object3d = typeof objectOrName === 'string' ? Scene.findObjectByName(objectOrName) : objectOrName;
        if (!object3d) {
            if (typeof objectOrName === 'string') {
                Logger.warn(`Rapier.addCollider: Could not find object with name "${objectOrName}".`);
            }
            return undefined;
        }
        let collider: RE.Component;
        switch (type) {
            case 'ball':
                const ball = new RapierBall('RapierBall', object3d);
                ball.radiusOffset = options.radius;
                collider = ball;
                break;
            case 'cuboid':
                const cuboid = new RapierCuboid('RapierCuboid', object3d);
                collider = cuboid;
                break;
            case 'capsule':
                const capsule = new RapierCapsule('RapierCapsule', object3d);
                capsule.halfHeight = options.halfHeight;
                capsule.radius = options.radius;
                collider = capsule;
                break;
            case 'cone':
                const cone = new RapierCone('RapierCone', object3d);
                cone.halfHeight = options.halfHeight;
                cone.radius = options.radius;
                collider = cone;
                break;
            case 'cylinder':
                const cylinder = new RapierCylinder('RapierCylinder', object3d);
                cylinder.halfHeight = options.halfHeight;
                cylinder.radius = options.radius;
                collider = cylinder;
                break;
            case 'trimesh':
                collider = new RapierTrimesh('RapierTrimesh', object3d);
                break;
            default:
                Logger.error("Invalid collider type");
                return undefined;
        }
        if (collider instanceof RapierCollider && options) {
            if (options.isSensor !== undefined) {
                collider.isSensor = options.isSensor;
            }
            if (options.collisionEvents !== undefined) {
                collider.collisionEvents = options.collisionEvents;
            }
        }
        RE.addComponent(collider);
        return collider;
    }

    public static removeCollider(objectOrName: THREE.Object3D | string, type: 'ball' | 'cuboid' | 'capsule' | 'cone' | 'cylinder' | 'trimesh') {
        const object3d = typeof objectOrName === 'string' ? Scene.findObjectByName(objectOrName) : objectOrName;
        if (!object3d) {
            if (typeof objectOrName === 'string') {
                Logger.warn(`Rapier.removeCollider: Could not find object with name "${objectOrName}".`);
            }
            return;
        }
        let componentClass: any;
        switch (type) {
            case 'ball': componentClass = RapierBall; break;
            case 'cuboid': componentClass = RapierCuboid; break;
            case 'capsule': componentClass = RapierCapsule; break;
            case 'cone': componentClass = RapierCone; break;
            case 'cylinder': componentClass = RapierCylinder; break;
            case 'trimesh': componentClass = RapierTrimesh; break;
            default: Logger.error("Invalid collider type"); return;
        }
        const collider = RE.getComponent(componentClass, object3d);
        if (collider) {
            RE.removeComponent(collider);
        }
    }

    // #endregion

    // #region KINEMATIC TWEENS
    // =================================================================

    public static moveKinematic(bodyOrObject: RapierBody | THREE.Object3D | string, targetPosition: THREE.Vector3, speed: number) {
        const body = this._resolveBody(bodyOrObject);
        if (!body || !body.isKinematic()) {
            Logger.warn("Rapier.moveKinematic: This method can only be used on Kinematic bodies.");
            return;
        }
        const startPosition = new THREE.Vector3().copy(body.translation() as THREE.Vector3);
        const distance = startPosition.distanceTo(targetPosition);
        if (distance < 0.01 || speed <= 0) {
            body.setNextKinematicTranslation(targetPosition);
            this.activePositionTweens.delete(body.handle);
            return;
        }
        const duration = distance / speed;
        const tween: VectorTween = { body: body, target: targetPosition, start: startPosition, startTime: RE.Runtime.clock.getElapsedTime(), duration: duration };
        this.activePositionTweens.set(body.handle, tween);
    }

    public static rotateKinematic(bodyOrObject: RapierBody | THREE.Object3D | string, targetRotation: THREE.Quaternion, speed: number) {
        const body = this._resolveBody(bodyOrObject);
        if (!body || !body.isKinematic()) {
            Logger.warn("Rapier.rotateKinematic: This method can only be used on Kinematic bodies.");
            return;
        }
        const startRotation = new THREE.Quaternion().copy(body.rotation() as THREE.Quaternion);
        const angle = startRotation.angleTo(targetRotation);
        if (angle < 0.001 || speed <= 0) {
            body.setNextKinematicRotation(targetRotation);
            this.activeRotationTweens.delete(body.handle);
            return;
        }
        const duration = angle / speed;
        const tween: QuaternionTween = { body: body, target: targetRotation, start: startRotation, startTime: RE.Runtime.clock.getElapsedTime(), duration: duration };
        this.activeRotationTweens.set(body.handle, tween);
    }

    // #endregion


    // #region EVENTS
    // =================================================================

    public static addTagPairHandler(tag1: string, tag2: string, handler: TagPairHandler) {
        const key = `${tag1}|${tag2}`;
        this.tagPairHandlers.set(key, handler);
    }

    public static setTags(bodyOrObject: RapierBody | THREE.Object3D | string, tags: string[]) {
        const body = this._resolveBody(bodyOrObject);
        if (body) {
            this.bodyTags.set(body.handle, tags);
        } else {
            Logger.warn("Rapier.setTags: Could not resolve a valid Rapier body.");
        }
    }

    public static getTags(bodyOrObject: RapierBody | THREE.Object3D | string): string[] {
        const body = this._resolveBody(bodyOrObject);
        return body ? this.bodyTags.get(body.handle) || [] : [];
    }

    public static addCollisionHandler(bodyOrObject: RapierBody | THREE.Object3D | string, handler: CollisionHandler) {
        const body = this._resolveBody(bodyOrObject);
        if (body) {
            if (!this.bodyHandlers.has(body.handle)) {
                this.bodyHandlers.set(body.handle, []);
            }
            if (!handler.id) {
                handler.id = Math.random().toString(36).substr(2, 9);
            }
            this.bodyHandlers.get(body.handle)!.push(handler);
        } else {
            Logger.warn("Rapier.addCollisionHandler: Could not resolve a valid Rapier body.");
        }
    }

    public static removeCollisionHandler(bodyOrObject: RapierBody | THREE.Object3D | string, handlerId: string) {
        const body = this._resolveBody(bodyOrObject);
        if (body && this.bodyHandlers.has(body.handle)) {
            const handlers = this.bodyHandlers.get(body.handle)!;
            const index = handlers.findIndex(h => h.id === handlerId);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    public static clearCollisionHandlers(bodyOrObject: RapierBody | THREE.Object3D | string) {
        const body = this._resolveBody(bodyOrObject);
        if (body) {
            this.bodyHandlers.delete(body.handle);
        }
    }

    public static onCollisionStart(bodyOrObject: RapierBody | THREE.Object3D | string, callback: (otherBody: RapierBody, otherCollider: RAPIER.Collider, thisCollider: RAPIER.Collider) => void): () => void {
        const body = this._resolveBody(bodyOrObject);
        if (!body) return () => {};
        const handle = body.handle;
        if (!this.collisionListeners.has(handle)) {
            this.collisionListeners.set(handle, {});
        }
        const listeners = this.collisionListeners.get(handle)!;
        if (!listeners.onStart) {
            listeners.onStart = [];
        }
        listeners.onStart.push(callback);
        return () => {
            const currentListeners = this.collisionListeners.get(handle)?.onStart;
            if (currentListeners) {
                const index = currentListeners.indexOf(callback);
                if (index > -1) {
                    currentListeners.splice(index, 1);
                }
            }
        };
    }

    public static onCollisionEnd(bodyOrObject: RapierBody | THREE.Object3D | string, callback: (otherBody: RapierBody, otherCollider: RAPIER.Collider, thisCollider: RAPIER.Collider) => void): () => void {
        const body = this._resolveBody(bodyOrObject);
        if (!body) return () => {};
        const handle = body.handle;
        if (!this.collisionListeners.has(handle)) {
            this.collisionListeners.set(handle, {});
        }
        const listeners = this.collisionListeners.get(handle)!;
        if (!listeners.onEnd) {
            listeners.onEnd = [];
        }
        listeners.onEnd.push(callback);
        return () => {
            const currentListeners = this.collisionListeners.get(handle)?.onEnd;
            if (currentListeners) {
                const index = currentListeners.indexOf(callback);
                if (index > -1) {
                    currentListeners.splice(index, 1);
                }
            }
        };
    }

    // #endregion

    // #region PRIVATE HELPERS
    // =================================================================

    private static _resolveBody(bodyOrObject: RapierBody | THREE.Object3D | string): RAPIER.RigidBody | null {
        let rapierBody: RapierBody | undefined | null;
        if (bodyOrObject instanceof RapierBody) {
            rapierBody = bodyOrObject;
        } else {
            rapierBody = this.getRapierBody(bodyOrObject);
        }
        if (!rapierBody || !rapierBody.body) {
            Logger.warn("Rapier: Could not resolve a valid Rapier body for the operation.");
            return null;
        }
        return rapierBody.body;
    }

    private static processBodyHandlers(selfBody: RapierBody, otherBody: RapierBody, started: boolean) {
        const handlers = this.bodyHandlers.get(selfBody.body.handle);
        if (!handlers || handlers.length === 0) return;

        const otherTags = this.bodyTags.get(otherBody.body.handle) || [];

        for (let i = handlers.length - 1; i >= 0; i--) {
            const handler = handlers[i];

            if (handler.tags && handler.tags.length > 0) {
                const match = handler.tags.some(tag => otherTags.includes(tag));
                if (!match) continue;
            }

            const callback = started ? handler.onEnter : handler.onExit;
            if (callback) {
                callback(selfBody, otherBody);
            }

            if (started && handler.triggerOnce) {
                handlers.splice(i, 1);
            }
        }
    }

    private static processTagPairHandlers(rb1: RapierBody, rb2: RapierBody, started: boolean) {
        const tags1 = this.bodyTags.get(rb1.body.handle) || [];
        const tags2 = this.bodyTags.get(rb2.body.handle) || [];

        for (const tag1 of tags1) {
            for (const tag2 of tags2) {
                // Check for handler registered as (tag1, tag2)
                let key = `${tag1}|${tag2}`;
                let handler = this.tagPairHandlers.get(key);
                if (handler) {
                    const callback = started ? handler.onEnter : handler.onExit;
                    if (callback) callback(rb1, rb2);
                }

                // Check for handler registered as (tag2, tag1) to avoid defining both
                let reverseKey = `${tag2}|${tag1}`;
                if (key !== reverseKey) {
                    let reverseHandler = this.tagPairHandlers.get(reverseKey);
                    if (reverseHandler) {
                        const callback = started ? reverseHandler.onEnter : reverseHandler.onExit;
                        if (callback) callback(rb2, rb1);
                    }
                }
            }
        }
    }

    private static drainEvents() {
        if (!this.world || !this.eventQueue) return;
        this.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
            const collider1 = this.world.getCollider(handle1);
            const collider2 = this.world.getCollider(handle2);
            if (!collider1 || !collider2) return;
            const body1 = collider1.parent();
            const body2 = collider2.parent();
            if (!body1 || !body2) return;
            const rb1 = body1.userData as RapierBody;
            const rb2 = body2.userData as RapierBody;
            if (!rb1 || !rb2) return;

            // New global tag-pair system
            this.processTagPairHandlers(rb1, rb2, started);

            // Body-specific handler system
            this.processBodyHandlers(rb1, rb2, started);
            this.processBodyHandlers(rb2, rb1, started);
            
            // Original low-level listener system
            const listeners1 = this.collisionListeners.get(body1.handle);
            if (listeners1) {
                const callbacks = started ? listeners1.onStart : listeners1.onEnd;
                if (callbacks) {
                    callbacks.forEach(cb => cb(rb2, collider2, collider1));
                }
            }
            const listeners2 = this.collisionListeners.get(body2.handle);
            if (listeners2) {
                const callbacks = started ? listeners2.onStart : listeners2.onEnd;
                if (callbacks) {
                    callbacks.forEach(cb => cb(rb1, collider1, collider2));
                }
            }
        });
    }

    // #endregion
}