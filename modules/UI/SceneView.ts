
import { Component } from './Component';
import { ComponentProps } from './types';
import { DOM } from '../DOM';
import * as THREE from 'three';

export interface SceneViewProps extends ComponentProps {
    onSetup?: (sceneView: SceneView) => void;
}

export class SceneView extends Component<SceneViewProps> {
    public renderer: THREE.WebGLRenderer;
    public scene: THREE.Scene;
    public camera: THREE.PerspectiveCamera;
    public onAnimate: (() => void) | null = null;

    private animationFrameId: number | null = null;
    private resizeObserver: ResizeObserver;

    constructor(props: SceneViewProps) {
        super('div', { ...props, className: ['mate-scene-view', props.className].join(' ') });

        DOM.setStyle(this.element, {
            width: '100%',
            height: '100%',
            position: 'relative',
            overflow: 'hidden'
        });

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, this.element.clientWidth / this.element.clientHeight, 0.1, 1000);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(this.element.clientWidth, this.element.clientHeight);

        DOM.append(this.element, this.renderer.domElement);
        DOM.setStyle(this.renderer.domElement, {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%'
        });

        if (props.onSetup) {
            props.onSetup(this);
        } else {
            this.camera.position.z = 5;
            const geometry = new THREE.BoxGeometry();
            const material = new THREE.MeshNormalMaterial();
            const cube = new THREE.Mesh(geometry, material);
            this.scene.add(cube);

            this.onAnimate = () => {
                cube.rotation.x += 0.005;
                cube.rotation.y += 0.005;
            };
        }

        this.resizeObserver = new ResizeObserver(this.onWindowResize.bind(this));
        this.resizeObserver.observe(this.element);

        this.start();
    }

    public onWindowResize() {
        const width = this.element.clientWidth;
        const height = this.element.clientHeight;

        if (width === 0 || height === 0) return;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    private animate() {
        this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
        this.onAnimate?.();
        this.renderer.render(this.scene, this.camera);
    }

    public start() {
        if (this.animationFrameId === null) this.animate();
    }

    public stop() {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    public destroy() {
        this.stop();
        this.resizeObserver.disconnect();
        this.renderer.dispose();
        super.destroy();
    }
}
