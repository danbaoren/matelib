import * as RE from 'rogue-engine';
import * as THREE from 'three';
import ColyseusStateSync from './ColyseusStateSync.re';

/**
 * Provides smooth, interpolated movement and rotation for a networked object.
 * 
 * This component reads the target transform from a `ColyseusStateSync` component
 * on the same object and smoothly moves the object towards that target over time.
 */
export default class SmoothedTransform extends RE.Component {
  // Require the ColyseusStateSync component to be on the same Object3D
  @RE.props.component(ColyseusStateSync) stateSync: ColyseusStateSync;

  @RE.props.group("Position Smoothing")
  @RE.props.checkbox() smoothPosition: boolean = true;
  @RE.props.num(15) positionLerpSpeed: number = 15;

  @RE.props.group("Rotation Smoothing")
  @RE.props.checkbox() smoothRotation: boolean = true;
  @RE.props.num(18) rotationSlerpSpeed: number = 18;

  private targetPosition = new THREE.Vector3();
  private targetQuaternion = new THREE.Quaternion();

  // Temporary variables to avoid creating new ones every frame
  private tempEuler = new THREE.Euler();

  start() {
    this.stateSync = RE.getComponent(ColyseusStateSync);
  }

  update() {
    if (!this.stateSync || !this.stateSync.state) return;

    const state = this.stateSync.state;
    const hasPosition = state.x !== undefined && state.y !== undefined && state.z !== undefined;
    const hasRotation = state.rotX !== undefined && state.rotY !== undefined && state.rotZ !== undefined;

    // --- Position Smoothing ---
    if (this.smoothPosition && hasPosition) {
      this.targetPosition.set(state.x, state.y, state.z);
      const factor = 1.0 - Math.pow(1.0 - Math.min(1, this.positionLerpSpeed), RE.Runtime.deltaTime);
      this.object3d.position.lerp(this.targetPosition, factor);
    }

    // --- Rotation Smoothing ---
    if (this.smoothRotation && hasRotation) {
      // Note: Assumes rotation is sent as Euler angles. Modify if your server sends quaternions.
      this.tempEuler.set(state.rotX, state.rotY, state.rotZ);
      this.targetQuaternion.setFromEuler(this.tempEuler);
      const factor = 1.0 - Math.pow(1.0 - Math.min(1, this.rotationSlerpSpeed), RE.Runtime.deltaTime);
      this.object3d.quaternion.slerp(this.targetQuaternion, factor);
    }
  }
}

RE.registerComponent(SmoothedTransform);
