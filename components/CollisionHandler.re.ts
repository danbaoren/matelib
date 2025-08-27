import * as RE from 'rogue-engine';
import * as THREE from 'three';
import { Rapier } from '../modules/Rapier';
import { Scene } from '../modules/Scene';

// This component manages all high-level collision logic for the scene.
// Add it to a single object in your scene (e.g., the Scene root).

@RE.registerComponent
export default class CollisionHandler extends RE.Component {

  awake() {
    Rapier.setupWorld({ gravity: new THREE.Vector3(0, -9.81, 0) });
  }

  start() {
    // All collision logic for the entire scene can be defined here.
    // This keeps your game logic clean and in one central place.
    this.setupCollisionLogic();
  }

  // This is where you define all your game's collision rules.
  setupCollisionLogic() {
    console.log("Setting up scene collision handlers...");

    // --- Find the Player --- 
    const player = Scene.findObjectByName("Player");
    if (!player) {
        console.warn("CollisionHandler: Could not find an object named 'Player' to set up its handlers.");
        return; // Stop if there's no player
    }
    const playerBody = Rapier.getRapierBody(player);
    if (!playerBody) {
        console.warn("CollisionHandler: Player object does not have a RapierBody.");
        return;
    }

    // --- Tagging --- 
    // Tag the player so other objects can find it.
    Rapier.setTags(playerBody, ["player"]);

    // Tag other objects in the scene.
    const coin = Scene.findObjectByName("MyCoin");
    if (coin) {
        const coinBody = Rapier.getRapierBody(coin);
        if(coinBody) Rapier.setTags(coinBody, ["coin", "collectible"]);
    }

    const trap = Scene.findObjectByName("SpikeTrap");
    if (trap) {
        const trapBody = Rapier.getRapierBody(trap);
        if(trapBody) Rapier.setTags(trapBody, ["trap"]);
    }

    // --- Player Interaction Handlers ---
    // Define what happens when the player collides with other tagged objects.

    // Example 1: Player collecting coins
    Rapier.addCollisionHandler(playerBody, {
      id: "player-coin-collector", // Give it a name for clarity
      tags: ["coin"], // Reacts to any object tagged "coin"
      onEnter: (self, coinBody) => {
        console.log(`Player collected ${coinBody.object3d.name}`);
        RE.Runtime.scene.remove(coinBody.object3d); // Destroy the coin object
      }
    });

    // Example 2: Player hitting a trap
    Rapier.addCollisionHandler(playerBody, {
        id: "player-trap-detector",
        tags: ["trap"],
        onEnter: (self, trapBody) => {
            console.log("Player stepped on a trap!");
            // Add your damage logic here
        },
        triggerOnce: true // The trap only works once
    });
  }

  update() {
    // This is crucial. It drives the entire Rapier physics simulation,
    // including processing all collision events you defined above.
    Rapier.update();
  }
}

