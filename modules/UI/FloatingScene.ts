import { Window, WindowProps } from './Window';
import { DOM } from '../DOM';
import { SceneView } from './SceneView';

export interface FloatingSceneProps extends WindowProps {
    onSetup?: (sceneView: SceneView, floatingScene: FloatingScene) => void;
    onFileDrop?: (file: File) => void;
    startSelected?: boolean;
}

export class FloatingScene extends Window<FloatingSceneProps> {
    public sceneView: SceneView;
    private isSelected: boolean = false;

    private boundOnDocumentClick = this.onDocumentClick.bind(this);

    constructor(props: FloatingSceneProps) {
        let uiContainer = document.getElementById('game-ui-container');
        if (!uiContainer) {
            uiContainer = DOM.create('div', { id: 'game-ui-container', parent: document.body });
        }

        super({
            ...props,
            parent: uiContainer,
            className: ['mate-floating-scene', props.className].join(' '),
            initialPosition: props.initialPosition || { top: '20%', left: '30%' },
            initialSize: props.initialSize || { width: '400px', height: '300px' },
            resizable: true, // Enable resizing
            collapsible: true, // Enable collapsing
            closable: true, // Enable closing
            style: {
                ...props.style
            }
        });

        // Explicitly set background to transparent after super call
        DOM.setStyle(this.element, { backgroundColor: 'transparent' });

        


        this.sceneView = new SceneView({
            parent: this.content,
            onSetup: (sv) => { if (props.onSetup) props.onSetup(sv, this); }
        });
        this.sceneView.renderer.setClearColor(0x000000, 0); // Transparent background for the 3D scene

        // Drag and Drop Listeners
        DOM.on(this.element, 'dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.isSelected) {
                DOM.setStyle(this.element, { borderColor: '#4caf50' });
            }
        });

        DOM.on(this.element, 'dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.isSelected) {
                DOM.setStyle(this.element, { borderColor: 'rgba(0, 150, 255, 0.8)' });
            }
        });

        DOM.on(this.element, 'drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer?.files.length) {
                this.props.onFileDrop?.(e.dataTransfer.files[0]);
            }
            DOM.setStyle(this.element, { borderColor: 'rgba(0, 150, 255, 0.8)' });
        });

        document.addEventListener('click', this.boundOnDocumentClick);

        if (props.startSelected) {
            this.select();
        }
    }

    protected addCustomHeaderElements(controlsContainer: HTMLElement) {
        // Add background toggle button to the header
        DOM.create('button', {
            text: '◎',
            className: 'mate-window-bg-toggle-btn',
            parent: controlsContainer,
            style: {
                background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#E0E0E0',
            },
            events: {
                click: (e) => { e.stopPropagation(); this.toggleBackgroundTransparency(); }
            }
        });
    }

    public select() {
        this.isSelected = true;
        DOM.show(this.header.element, 'flex'); // Show the header
        if (this.resizeHandle) this.resizeHandle.style.display = 'block';
    }

    public deselect() {
        if (!this.isSelected) return;
        this.isSelected = false;
        DOM.setStyle(this.element, {
            borderColor: 'transparent',
            boxShadow: 'none',
            backgroundColor: 'transparent',
            backdropFilter: 'none',
        });
        DOM.hide(this.header.element); // Hide the header
        if (this.resizeHandle) this.resizeHandle.style.display = 'none';
    }

    private isBackgroundTransparent: boolean = true; // Initial state is transparent

    public toggleBackgroundTransparency() {
        if (this.isBackgroundTransparent) {
            // Change to semi-transparent
            DOM.setStyle(this.element, {
                backgroundColor: 'rgba(30, 30, 30, 0.7)',
                backdropFilter: 'blur(10px)',
            });
            this.isBackgroundTransparent = false;
        } else {
            // Change to transparent
            DOM.setStyle(this.element, {
                backgroundColor: 'transparent',
                backdropFilter: 'none',
            });
            this.isBackgroundTransparent = true;
        }
    }

    private onDocumentClick(e: MouseEvent) {
        if (this.isSelected && !this.element.contains(e.target as Node)) {
            this.deselect();
        }
    }

    public destroy() {
        // Call SceneView destroy first to clean up Three.js resources
        this.sceneView.destroy();
        // Then call the super class destroy method to remove the element from DOM and clean up Window event listeners
        super.destroy();
        document.removeEventListener('click', this.boundOnDocumentClick);
    }
}