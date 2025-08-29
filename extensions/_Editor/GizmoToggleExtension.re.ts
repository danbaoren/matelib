import * as RE from 'rogue-engine';
import * as THREE from 'three';
import { WindowButton } from '../../modules/UI/WindowButton';
import { Logger } from '../../modules/Logger';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

declare global {
    interface Window {
        __MATE_GIZMO_INITIALIZED__?: boolean;
    }
}

@RE.registerComponent
export default class GizmoToggleExtension extends RE.Component {
    static isEditorComponent = true;

    private gizmoButton: WindowButton<any>;
    private transformControls: TransformControls | null = null;
    private selectedObjectUuid: string | null = null;
    private isSelectionMode: boolean = false;
    private selectionTimeout: number | null = null;
    private mouseClickListener: ((event: MouseEvent) => void) | null = null;

    start() {
        Logger.log("GizmoToggleExtension.start() called.");
        if (window.__MATE_GIZMO_INITIALIZED__) {
            Logger.log("GizmoToggleExtension already initialized.");
            return;
        }
        window.__MATE_GIZMO_INITIALIZED__ = true;

        this.gizmoButton = new WindowButton({
            onClick: () => {
                this.toggleSelectionMode();
            },
            description: "Toggle Gizmo Controls",
            icon: '➕',
            initialPosition: { right: '20px', bottom: '230px' }, // Position above bounding box toggle
            initialSize: { width: '60px', height: '60px' },
            draggable: true,
        });
        Logger.log("Gizmo Toggle Extension Initialized.");
    }

    private toggleSelectionMode() {
        if (this.selectedObjectUuid) {
            this.detachGizmos();
            this.selectedObjectUuid = null;
            this.gizmoButton.element.querySelector('div')!.innerHTML = '➕';
            Logger.log("Gizmo detached and object deselected.", "GizmoToggleExtension");
            return;
        }

        if (this.isSelectionMode) {
            // If already in selection mode, cancel it
            this.resetSelectionMode();
        } else {
            // Enter selection mode
            this.isSelectionMode = true;
            this.gizmoButton.element.querySelector('div')!.innerHTML = '🎯'; // Target icon for selection mode
            Logger.log("Entering gizmo selection mode (5 seconds).", "GizmoToggleExtension");

            // Set 5-second timeout
            this.selectionTimeout = window.setTimeout(() => {
                Logger.log("Gizmo selection mode timed out.", "GizmoToggleExtension");
                this.resetSelectionMode();
            }, 5000);

            // Add mouse click listener for raycasting
            if (RE.Runtime.rogueDOMContainer) {
                this.mouseClickListener = this.handleMouseClickForSelection.bind(this);
                RE.Runtime.rogueDOMContainer.addEventListener('click', this.mouseClickListener!);
            } else {
                Logger.warn("RE.Runtime.rogueDOMContainer not available for click listener.", "GizmoToggleExtension");
                this.resetSelectionMode(); // Cannot proceed without DOM container
            }
        }
    }

    private handleMouseClickForSelection = (event: MouseEvent) => {
        if (!RE.Runtime.camera || !RE.Runtime.rogueDOMContainer) {
            Logger.warn("Cannot raycast: Camera or DOM container not available.", "GizmoToggleExtension");
            this.resetSelectionMode();
            return;
        }

        // Normalize mouse coordinates
        const rect = RE.Runtime.rogueDOMContainer.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, RE.Runtime.camera);

        const intersects = raycaster.intersectObjects(RE.Runtime.scene.children, true);

        let selectedMesh: THREE.Mesh | null = null;
        for (const intersect of intersects) {
            if (intersect.object instanceof THREE.Mesh && intersect.object.visible) {
                selectedMesh = intersect.object;
                break; // Select the first visible mesh intersected
            }
        }

        if (selectedMesh) {
            Logger.log(`Object selected: ${selectedMesh.name || selectedMesh.uuid}`, "GizmoToggleExtension");
            this.attachGizmos(selectedMesh);
            this.resetSelectionMode();
        } else {
            Logger.log("No mesh found at clicked position.", "GizmoToggleExtension");
        }
    };

    private attachGizmos(object: THREE.Object3D) {
        // Detach existing gizmo if any
        this.detachGizmos();

        if (RE.Runtime.camera && RE.Runtime.rogueDOMContainer) {
            this.transformControls = new TransformControls(RE.Runtime.camera, RE.Runtime.rogueDOMContainer);
            this.transformControls.attach(object);
            RE.Runtime.scene.add(this.transformControls);
            this.selectedObjectUuid = object.uuid;
            this.gizmoButton.element.querySelector('div')!.innerHTML = '✖️'; // Set to cross icon

            // Optional: Add event listeners for gizmo changes if needed
            this.transformControls.addEventListener('change', () => {
                // Update object properties in UI if you had an inspector
            });
            this.transformControls.addEventListener('dragging-changed', (event) => {
                // Handle dragging state if needed
            });
        } else {
            Logger.warn("Cannot attach gizmos: Camera or DOM container not available.", "GizmoToggleExtension");
        }
    }

    private detachGizmos() {
        if (this.transformControls) {
            this.transformControls.detach();
            RE.Runtime.scene.remove(this.transformControls);
            this.transformControls.dispose();
            this.transformControls = null;
        }
    }

    private resetSelectionMode() {
        this.isSelectionMode = false;
        if (this.selectionTimeout) {
            clearTimeout(this.selectionTimeout);
            this.selectionTimeout = null;
        }
        if (this.mouseClickListener && RE.Runtime.rogueDOMContainer) {
            RE.Runtime.rogueDOMContainer.removeEventListener('click', this.mouseClickListener!);
            this.mouseClickListener = null;
        }
        // If no object is selected, revert button icon to default
        if (!this.selectedObjectUuid) {
            this.gizmoButton.element.querySelector('div')!.innerHTML = '➕';
        }
        Logger.log("Gizmo selection mode reset.", "GizmoToggleExtension");
    }

    onDestroy() {
        if (this.gizmoButton) {
            this.gizmoButton.destroy();
        }
        this.detachGizmos();
        this.resetSelectionMode(); // Ensure all listeners and timeouts are cleared
    }
}
