import * as RE from 'rogue-engine';
import * as THREE from 'three';
import { WindowButton } from '../../modules/UI/WindowButton';
import { Logger } from '../../modules/Logger';

declare global {
    interface Window {
        __MATE_BOUNDINGBOX_INITIALIZED__?: boolean;
    }
}

@RE.registerComponent
export default class BoundingBoxToggleExtension extends RE.Component {
    static isEditorComponent = true;

    private boundingBoxButton: WindowButton<any>;
    private isBoundingBoxVisible: boolean = false;
    private boxHelpers: THREE.BoxHelper[] = [];

    start() {
        Logger.log("BoundingBoxToggleExtension.start() called.");
        if (window.__MATE_BOUNDINGBOX_INITIALIZED__) {
            Logger.log("BoundingBoxToggleExtension already initialized.");
            return;
        }
        window.__MATE_BOUNDINGBOX_INITIALIZED__ = true;

        this.boundingBoxButton = new WindowButton({
            onClick: () => {
                this.toggleBoundingBoxes();
            },
            description: "Toggle Bounding Boxes",
            icon: this.isBoundingBoxVisible ? '📦' : '📦',
            initialPosition: { right: '20px', bottom: '160px' }, // Position above wireframe toggle
            initialSize: { width: '60px', height: '60px' },
            draggable: true,
        });
        Logger.log("Bounding Box Toggle Extension Initialized.");
    }

    private toggleBoundingBoxes() {
        this.isBoundingBoxVisible = !this.isBoundingBoxVisible;

        if (this.isBoundingBoxVisible) {
            RE.Runtime.scene.traverse((object) => {
                if (object instanceof THREE.Mesh && object.geometry) {
                    const boxHelper = new THREE.BoxHelper(object, 0xffff00); // Yellow bounding box
                    RE.Runtime.scene.add(boxHelper);
                    this.boxHelpers.push(boxHelper);
                }
            });
        } else {
            this.boxHelpers.forEach(helper => {
                RE.Runtime.scene.remove(helper);
            });
            this.boxHelpers = [];
        }
        // Update button icon
        this.boundingBoxButton.element.querySelector('div')!.innerHTML = this.isBoundingBoxVisible ? '📦' : '📦';
    }

    onDestroy() {
        if (this.boundingBoxButton) {
            this.boundingBoxButton.destroy();
        }
        // Clean up any remaining box helpers
        this.boxHelpers.forEach(helper => {
            RE.Runtime.scene.remove(helper);
        });
        this.boxHelpers = [];
    }
}
