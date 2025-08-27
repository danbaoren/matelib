import * as RE from 'rogue-engine';
import * as THREE from 'three';
import { Window } from '../Window';
import { Button } from '../Button';
import { DOM } from '../../DOM';
import { Logger } from '../../Logger';
import { Input } from '../Input';
import { Header } from '../Header';
import { SceneView } from '../SceneView';
import { FloatingScene } from '../FloatingScene';
import { Transition } from '../Transition';

@RE.registerComponent
export default class UIExample extends RE.Component {

  @RE.props.button()
  createWindows = () => {
    this.createExampleWindows();
  };
  createWindowsLabel = "Create Example Windows";

  @RE.props.button()
  createWindowss = () => {
    Transition.wipe(10000)
  };
  createWindowssLabel = "Create Example Windows";

  awake() {
    // Optional: Call createExampleWindows directly on awake if you want them to appear immediately
    // this.createExampleWindows();
  }

  createExampleWindows() {
    Logger.log("Creating example UI windows...");

    // --- Example 1: Basic Window ---
    try {
      new Window({
        windowId: "basicWindow",
        title: "Basic Window",
        initialSize: { width: "300px", height: "200px" },
        children: [
          DOM.create('p', { text: "This is a basic window." })
        ]
      });
      Logger.log("Basic Window created.");
    } catch (error) {
      Logger.error("Failed to create Basic Window:", error);
    }

    // --- Example 2: Window with Custom Position and Size ---
    try {
      new Window({
        windowId: "customPositionWindow",
        title: "Custom Position Window",
        initialPosition: { top: "100px", left: "100px" },
        initialSize: { width: "400px", height: "250px" },
        children: [
          DOM.create('p', { text: "This window has a custom initial position and size." })
        ]
      });
      Logger.log("Custom Position Window created.");
    } catch (error) {
      Logger.error("Failed to create Custom Position Window:", error);
    }

    // --- Example 3: Collapsible and Resizable Window with Interaction ---
    let interactionTextElement: HTMLElement;
    try {
      new Window({
        windowId: "interactiveWindow",
        title: "Interactive Window",
        collapsible: true,
        resizable: true,
        initialSize: { width: "350px", height: "300px" },
        children: [
          DOM.create('p', { text: "This window is collapsible and resizable." }),
          new Button({
            text: "Click Me!",
            onClick: () => {
              if (interactionTextElement) {
                interactionTextElement.textContent = "Button clicked at " + new Date().toLocaleTimeString();
              }
            }
          }),
          (interactionTextElement = DOM.create('p', { text: "Waiting for button click..." }))
        ]
      });
      Logger.log("Interactive Window created.");
    } catch (error) {
      Logger.error("Failed to create Interactive Window:", error);
    }

    // --- Example 4: Hoverable Window ---
    try {
      new Window({
        windowId: "hoverableWindow",
        title: "Hoverable Window",
        hoverable: true,
        hoverIcon: "💡",
        initialPosition: { bottom: "50px", right: "50px" },
        children: [
          DOM.create('p', { text: "Hover over me to expand!" })
        ]
      });
      Logger.log("Hoverable Window created.");
    } catch (error) {
      Logger.error("Failed to create Hoverable Window:", error);
    }

    // --- Example 5: Window with Input and Dynamic Content ---
    let inputElement: Input;
    let displayElement: HTMLElement;
    try {
      new Window({
        windowId: "inputWindow",
        title: "Input Window",
        initialSize: { width: "400px", height: "250px" },
        children: [
          new Header({ text: "Enter Text:", level: 3 }),
          (inputElement = new Input({
            placeholder: "Type something...",
            onInput: (value) => {
              if (displayElement) {
                displayElement.textContent = `You typed: ${value}`;
              }
            }
          })),
          (displayElement = DOM.create('p', { text: "You typed: " }))
        ]
      });
      Logger.log("Input Window created.");
    } catch (error) {
      Logger.error("Failed to create Input Window:", error);
    }

    // --- Example 6: Attempt to create a duplicate window (should fail) ---
    try {
      new Window({
        windowId: "basicWindow", // This ID already exists
        title: "Duplicate Basic Window",
        initialSize: { width: "300px", height: "200px" },
        children: [
          DOM.create('p', { text: "This window should NOT be created." })
        ]
      });
      Logger.log("Duplicate Basic Window created (THIS SHOULD NOT HAPPEN).");
    } catch (error) {
      Logger.log("Successfully prevented creation of duplicate Basic Window:", error.message);
    }

    // --- Example 7: Window with no explicit ID (auto-generated) ---
    try {
      new Window({
        title: "Auto-ID Window",
        initialPosition: { top: "200px", right: "200px" },
        children: [
          DOM.create('p', { text: "This window has an auto-generated ID." })
        ]
      });
      Logger.log("Auto-ID Window created.");
    } catch (error) {
      Logger.error("Failed to create Auto-ID Window:", error);
    }

    // --- Example 8: Scene View Window ---
    try {
      new Window({
        windowId: "sceneViewWindow",
        title: "Scene View Example",
        initialSize: { width: "600px", height: "400px" },
        children: [
          new SceneView({
            onSetup: (sceneView) => {
              // Adjust camera position
              sceneView.camera.position.z = 5;

              // Add a simple cube to the scene
              const geometry = new THREE.BoxGeometry();
              const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
              const cube = new THREE.Mesh(geometry, material);
              sceneView.scene.add(cube);

              // Animate the cube
              sceneView.onAnimate = () => {
                cube.rotation.x += 0.01;
                cube.rotation.y += 0.01;
              };
            }
          })
        ]
      });
      Logger.log("Scene View Window created.");
    } catch (error) {
      Logger.error("Failed to create Scene View Window:", error);
    }

    // --- Example 9: Floating Scene Window ---
    try {
      new FloatingScene({
        windowId: "floatingSceneExample",
        title: "Floating Scene Example",
        initialSize: { width: "500px", height: "350px" },
        onSetup: (sceneView, floatingScene) => {
          // Adjust camera position
          sceneView.camera.position.set(0, 10, 20);
          sceneView.camera.lookAt(0, 0, 0);

          // Create a plane geometry for the terrain
          const terrainWidth = 20;
          const terrainHeight = 20;
          const segments = 50;
          const geometry = new THREE.PlaneGeometry(terrainWidth, terrainHeight, segments, segments);

          // Displace vertices to create a basic terrain effect
          const positionAttribute = geometry.getAttribute('position');
          for (let i = 0; i < positionAttribute.count; i++) {
            const x = positionAttribute.getX(i);
            const y = positionAttribute.getY(i);

            // Simple sine wave displacement for demonstration
            const z = Math.sin(x * 0.5) * 2 + Math.cos(y * 0.5) * 2;
            positionAttribute.setZ(i, z);
          }
          geometry.computeVertexNormals(); // Recalculate normals for proper lighting

          // Create a material for the terrain
          const material = new THREE.MeshStandardMaterial({ color: 0x8B4513, flatShading: true }); // Brown, flat shaded

          // Create the terrain mesh
          const terrain = new THREE.Mesh(geometry, material);
          terrain.rotation.x = -Math.PI / 2; // Rotate to be flat on the XZ plane
          sceneView.scene.add(terrain);

          // Add ambient light
          const ambientLight = new THREE.AmbientLight(0x404040); // soft white light
          sceneView.scene.add(ambientLight);

          // Add directional light
          const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
          directionalLight.position.set(5, 10, 7.5);
          sceneView.scene.add(directionalLight);

          // Animate the terrain rotation
          sceneView.onAnimate = () => {
            terrain.rotation.z += 0.005; // Rotate around the Y-axis (which is Z after initial rotation)
          };
        }
      });
      Logger.log("Floating Scene Window created.");
    } catch (error) {
      Logger.error("Failed to create Floating Scene Window:", error);
    }
  
  }}