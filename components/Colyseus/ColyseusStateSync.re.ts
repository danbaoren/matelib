import * as RE from 'rogue-engine';

/**
 * A component that automatically receives and stores state updates from a Colyseus server.
 * Add this to your networked prefabs.
 * 
 * The ColyseusClient module will find this component on spawned prefabs and 
 * automatically update its `state` property to match the entity state from the server.
 */
export default class ColyseusStateSync extends RE.Component {
  // The sessionId from the server. Automatically populated by the ColyseusClient.
  public sessionId: string = "";

  // This is a dynamic container for state properties.
  // The ColyseusClient will add properties to it at runtime, for example:
  // this.state.x = 10;
  // this.state.y = 5;
  // this.state.health = 95;
  public state: { [key: string]: any } = {};
}

RE.registerComponent(ColyseusStateSync);
