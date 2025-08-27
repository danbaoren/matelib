import * as RE from 'rogue-engine';
import * as THREE from 'three';
import { Rapier } from '../modules/Rapier';
import { Scene } from '../modules/Scene';

/**
 * This component manages all high-level collision logic for the scene.
 * It uses the global Tag-Pair Handling system for maximum clarity and decoupling.
 * 
 * INSTRUCTIONS:
 * 1. Add this component to a single object in your scene (e.g., a "SceneManager" object).
 * 2. In the `tagObjects()` method, find your key objects and assign them tags.
 * 3. In the `defineInteractions()` method, define the rules for what happens when tags collide.
 */
@RE.registerComponent
export default class CollisionHandler extends RE.Component {

  awake() {
    Rapier.setupWorld({ gravity: new THREE.Vector3(0, -9.81, 0) });
  }

  start() {
    this.tagObjects();
    this.defineInteractions();
  }

  // Step 1: Find all important objects and give them tags.
  tagObjects() {
    console.log("Tagging scene objects for physics interactions...");

    const player = Scene.findObjectByName("Player");
    if (player) {
        const playerBody = Rapier.getRapierBody(player);
        if (playerBody) Rapier.setTags(playerBody, ["player"]);
    }

    const coin = Scene.findObjectByName("MyCoin");
    if (coin) {
        const coinBody = Rapier.getRapierBody(coin);
        if (coinBody) Rapier.setTags(coinBody, ["coin", "collectible"]);
    }

    const trap = Scene.findObjectByName("SpikeTrap");
    if (trap) {
        const trapBody = Rapier.getRapierBody(trap);
        if (trapBody) Rapier.setTags(trapBody, ["trap"]);
    }

    const bullet = Scene.findObjectByName("Bullet");
    if (bullet) {
        const bulletBody = Rapier.getRapierBody(bullet);
        if (bulletBody) Rapier.setTags(bulletBody, ["bullet"]);
    }
  }

  // Step 2: Define the interaction rules between tags.
  defineInteractions() {
    console.log("Defining global collision interaction rules...");

    // Rule: What happens when a 'player' touches a 'coin'.
    Rapier.addTagPairHandler("player", "coin", {
        onEnter: (playerBody, coinBody) => {
            console.log(`Interaction: ${playerBody.object3d.name} collected ${coinBody.object3d.name}`);
            RE.Runtime.scene.remove(coinBody.object3d); // Destroy the coin
        }
    });

    // Rule: What happens when a 'player' touches a 'trap'.
    Rapier.addTagPairHandler("player", "trap", {
        onEnter: (playerBody, trapBody) => {
            console.log("Ouch! Player hit a trap.");
            // Your logic for player damage
        }
    });

    // Rule: What happens when a 'bullet' hits anything with a 'trap' tag.
    Rapier.addTagPairHandler("bullet", "trap", {
        onEnter: (bulletBody, trapBody) => {
            console.log("Bullet destroyed a trap!");
            RE.Runtime.scene.remove(bulletBody.object3d);
            RE.Runtime.scene.remove(trapBody.object3d);
        }
    });
  }

  update() {
    // This drives the entire Rapier physics simulation and processes all events.
    Rapier.update();
  }
}