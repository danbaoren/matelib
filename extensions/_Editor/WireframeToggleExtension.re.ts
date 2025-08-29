import * as RE from 'rogue-engine';
import * as THREE from 'three';
import { WindowButton } from '../../modules/UI/WindowButton';
import { Logger } from '../../modules/Logger';

declare global {
    interface Window {
        __MATE_WIREFRAME_INITIALIZED__?: boolean;
    }
}

@RE.registerComponent
export default class WireframeToggleExtension extends RE.Component {
    static isEditorComponent = true;

    private wireframeButton: WindowButton<any>;
    private isWireframe: boolean = false;

    start() {
        Logger.log("WireframeToggleExtension.start() called.");
        if (window.__MATE_WIREFRAME_INITIALIZED__) {
            Logger.log("WireframeToggleExtension already initialized.");
            return;
        }
        window.__MATE_WIREFRAME_INITIALIZED__ = true;

        this.wireframeButton = new WindowButton({
            onClick: () => {
                this.toggleWireframe();
            },
            description: "Toggle Wireframe",
            icon: this.isWireframe ? '🕸️' : '🕸️',
            initialPosition: { right: '20px', bottom: '90px' }, // Position above screenshot button
            initialSize: { width: '60px', height: '60px' },
            draggable: true,
        });
        Logger.log("Wireframe Toggle Extension Initialized.");
    }

    private toggleWireframe() {
        this.isWireframe = !this.isWireframe;
        RE.Runtime.scene.traverse((object) => {
            if (object instanceof THREE.Mesh) {
                const material = object.material;
                if (Array.isArray(material)) {
                    material.forEach(mat => {
                        if ('wireframe' in mat) {
                            mat.wireframe = this.isWireframe;
                        }
                    });
                } else if ('wireframe' in material) {
                    material.wireframe = this.isWireframe;
                }
            }
        });
        // Update button icon
        this.wireframeButton.element.querySelector('div')!.innerHTML = this.isWireframe ? '🕸️' : '🕸️';
    }

    onDestroy() {
        if (this.wireframeButton) {
            this.wireframeButton.destroy();
        }
    }
}
