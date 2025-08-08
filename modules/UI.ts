import { DOM } from "./DOM";
import * as THREE from 'three';

// --- Base Component Class ---
type ComponentOptions = { id?: string; className?: string; style?: Partial<CSSStyleDeclaration>; parent?: HTMLElement | string; };

interface WindowOptions extends ComponentOptions {
    title?: string;
    initialPosition?: { top?: string; left?: string; right?: string; bottom?: string; };
    initialSize?: { width?: string; height?: string; };
    onClose?: () => void;
    collapsible?: boolean;
    resizable?: boolean;
    onCollapse?: () => void;
    onExpand?: () => void;
}

class Component {
    public element: HTMLElement;

    constructor(tag: keyof HTMLElementTagNameMap, options: ComponentOptions = {}) {
        this.element = DOM.create(tag, { id: options.id, className: options.className, style: options.style });
        if (options.parent) {
            DOM.append(options.parent, this.element);
        }
    }

    public destroy() {
        DOM.remove(this.element);
    }
}

// --- High-Level UI Components ---

export class Window extends Component {
    private headerElement: HTMLElement;
    private contentElement: HTMLElement;
    private closeButton: HTMLElement;
    private collapseButton: HTMLElement | null = null;
    private isCollapsed: boolean = false;
    private lastUnfoldedState: { top: string; left: string; width: string; height: string; } | null = null;
    private collapseTimeout: number | null = null;

    // --- Drag & Resize Properties ---
    private isDragging: boolean = false;
    private offsetX: number = 0;
    private offsetY: number = 0;
    private isResizing: boolean = false;
    private resizeDirection: string = '';
    private startX: number = 0;
    private startY: number = 0;
    private startWidth: number = 0;
    private startHeight: number = 0;
    private startLeft: number = 0;
    private startTop: number = 0;

    private boundOnMouseMove = this.onMouseMove.bind(this);
    private boundOnMouseUp = this.onMouseUp.bind(this);
    private boundOnResizeMouseMove = this.onResizeMouseMove.bind(this);
    private boundOnResizeMouseUp = this.onResizeMouseUp.bind(this);

    constructor(options: WindowOptions) {
        let uiContainer = document.getElementById('game-ui-container');
        if (!uiContainer) {
            uiContainer = DOM.create('div', { id: 'game-ui-container', parent: document.body });
        }

        super('div', { ...options, parent: uiContainer, className: ['mate-window', options.className].join(' ') });

        // Set initial position and size
        DOM.setStyle(this.element, {
            position: 'absolute',
            top: options.initialPosition?.top || '50%',
            left: options.initialPosition?.left || '50%',
            width: options.initialSize?.width || '450px',
            height: options.initialSize?.height || '500px',
            minWidth: '200px', minHeight: '150px',
            backgroundColor: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: '8px',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
            zIndex: '10000',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'Inter, sans-serif',
            ...options.style
        });

        // Header
        this.headerElement = DOM.create('div', {
            className: 'mate-window-header',
            parent: this.element,
            style: {
                cursor: 'grab',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px',
                backgroundColor: '#3a3a3a',
                borderBottom: '1px solid #444',
                color: '#E0E0E0',
                fontSize: '16px',
                fontWeight: 'bold',
                flexShrink: '0'
            }
        });

        const titleSpan = DOM.create('span', {
            text: options.title || 'Window',
            parent: this.headerElement
        });

        const controlsContainer = DOM.create('div', {
            parent: this.headerElement,
            style: { display: 'flex', gap: '5px' }
        });

        // Collapse/Expand Button
        if (options.collapsible) {
            this.collapseButton = DOM.create('button', {
                text: '−',
                className: 'mate-window-collapse-btn',
                parent: controlsContainer,
                style: {
                    background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#E0E0E0', lineHeight: '1', padding: '0 5px'
                },
                events: {
                    click: () => this.toggleCollapse()
                }
            });
        }

        // Close Button
        this.closeButton = DOM.create('button', {
            text: '✕',
            className: 'mate-window-close-btn',
            parent: controlsContainer,
            style: {
                background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#E0E0E0', lineHeight: '1', padding: '0 5px'
            },
            events: {
                click: () => {
                    this.destroy();
                    options.onClose?.();
                }
            }
        });

        // Content Area
        this.contentElement = DOM.create('div', {
            className: 'mate-window-content',
            parent: this.element,
            style: {
                flexGrow: '1',
                overflowY: 'auto',
                padding: '10px',
                color: '#E0E0E0',
            }
        });

        // Make draggable
        DOM.on(this.headerElement, 'mousedown', (e) => this.onMouseDown(e as MouseEvent));

        // Add resize handles if resizable
        if (options.resizable) {
            this.element.style.overflow = 'hidden'; // Required for handles to work correctly
            this._createResizeHandles(true);
        }
    }

    private _createResizeHandles(initiallyVisible: boolean = false) {
        const handleDirs: { [key: string]: Partial<CSSStyleDeclaration> } = {
            'n': { top: '0', left: '5px', right: '5px', height: '5px', cursor: 'ns-resize' },
            's': { bottom: '0', left: '5px', right: '5px', height: '5px', cursor: 'ns-resize' },
            'w': { top: '5px', bottom: '5px', left: '0', width: '5px', cursor: 'ew-resize' },
            'e': { top: '5px', bottom: '5px', right: '0', width: '5px', cursor: 'ew-resize' },
            'nw': { top: '0', left: '0', width: '10px', height: '10px', cursor: 'nwse-resize' },
            'ne': { top: '0', right: '0', width: '10px', height: '10px', cursor: 'nesw-resize' },
            'sw': { bottom: '0', left: '0', width: '10px', height: '10px', cursor: 'nesw-resize' },
            'se': { bottom: '0', right: '0', width: '10px', height: '10px', cursor: 'nwse-resize' }
        };

        for (const dir in handleDirs) {
            DOM.create('div', {
                className: `mate-resize-handle mate-resize-${dir}`,
                parent: this.element,
                style: {
                    position: 'absolute',
                    ...handleDirs[dir],
                    zIndex: '10001',
                    display: initiallyVisible ? 'block' : 'none'
                },
                events: {
                    mousedown: (e) => this.onResizeMouseDown(e as MouseEvent, dir)
                }
            });
        }
    }

    private onResizeMouseDown(e: MouseEvent, dir: string) {
        e.preventDefault();
        e.stopPropagation();

        this.isResizing = true;
        this.resizeDirection = dir;
        this.startX = e.clientX;
        this.startY = e.clientY;
        const rect = this.element.getBoundingClientRect();
        this.startWidth = rect.width;
        this.startHeight = rect.height;
        this.startLeft = rect.left;
        this.startTop = rect.top;

        document.addEventListener('mousemove', this.boundOnResizeMouseMove);
        document.addEventListener('mouseup', this.boundOnResizeMouseUp);
    }

    private onResizeMouseMove(e: MouseEvent) {
        if (!this.isResizing) return;

        const dx = e.clientX - this.startX;
        const dy = e.clientY - this.startY;

        let newWidth = this.startWidth;
        let newHeight = this.startHeight;
        let newLeft = this.startLeft;
        let newTop = this.startTop;

        if (this.resizeDirection.includes('e')) newWidth = this.startWidth + dx;
        if (this.resizeDirection.includes('w')) {
            newWidth = this.startWidth - dx;
            newLeft = this.startLeft + dx;
        }
        if (this.resizeDirection.includes('s')) newHeight = this.startHeight + dy;
        if (this.resizeDirection.includes('n')) {
            newHeight = this.startHeight - dy;
            newTop = this.startTop + dy;
        }

        const minWidth = parseInt(this.element.style.minWidth) || 150;
        const minHeight = parseInt(this.element.style.minHeight) || 100;

        if (newWidth > minWidth) {
            this.element.style.width = `${newWidth}px`;
            this.element.style.left = `${newLeft}px`;
        }
        if (newHeight > minHeight) {
            this.element.style.height = `${newHeight}px`;
            this.element.style.top = `${newTop}px`;
        }
    }

    private onResizeMouseUp() {
        this.isResizing = false;
        document.removeEventListener('mousemove', this.boundOnResizeMouseMove);
        document.removeEventListener('mouseup', this.boundOnResizeMouseUp);
    }

    public destroy() {
        document.removeEventListener('mousemove', this.boundOnMouseMove);
        document.removeEventListener('mouseup', this.boundOnMouseUp);
        document.removeEventListener('mousemove', this.boundOnResizeMouseMove);
        document.removeEventListener('mouseup', this.boundOnResizeMouseUp);
        super.destroy();
    }

    public appendChild(child: HTMLElement) {
        DOM.append(this.contentElement, child);
    }

    public get content(): HTMLElement {
        return this.contentElement;
    }

    private isFullscreen: boolean = false;
    private lastWindowState: { top: string; left: string; width: string; height: string; } | null = null;

    private toggleFullscreen() {
        if (this.isCollapsed) this.expand();

        if (!this.isFullscreen) {
            this.lastWindowState = {
                top: this.element.style.top,
                left: this.element.style.left,
                width: this.element.style.width,
                height: this.element.style.height,
            };
            DOM.setStyle(this.element, {
                top: '0', left: '0', width: '100vw', height: '100vh', borderRadius: '0'
            });
            this.isFullscreen = true;
        } else {
            if (this.lastWindowState) {
                DOM.setStyle(this.element, {
                    top: this.lastWindowState.top,
                    left: this.lastWindowState.left,
                    width: this.lastWindowState.width,
                    height: this.lastWindowState.height,
                    borderRadius: '8px',
                });
            }
            this.isFullscreen = false;
        }
    }

    private onMouseDown(e: MouseEvent) {
        if (this.isCollapsed) return;
        e.preventDefault();

        // Get the current visual position of the element, which accounts for transforms
        const rect = this.element.getBoundingClientRect();

        // Switch to absolute pixel positioning for smooth dragging.
        // This prevents jumps if the element was positioned with percentages or transforms.
        DOM.setStyle(this.element, {
            top: `${rect.top}px`,
            left: `${rect.left}px`,
            right: 'auto',
            bottom: 'auto',
            margin: '0',
            transform: 'none'
        });

        this.isDragging = true;
        this.offsetX = e.clientX - rect.left;
        this.offsetY = e.clientY - rect.top;
        DOM.setStyle(this.headerElement, { cursor: 'grabbing' });

        document.addEventListener('mousemove', this.boundOnMouseMove);
        document.addEventListener('mouseup', this.boundOnMouseUp);
    }

    private onMouseUp() {
        this.isDragging = false;
        DOM.setStyle(this.headerElement, { cursor: 'grab' });

        document.removeEventListener('mousemove', this.boundOnMouseMove);
        document.removeEventListener('mouseup', this.boundOnMouseUp);
    }

    private onMouseMove(e: MouseEvent) {
        if (!this.isDragging) return;
        let newX = e.clientX - this.offsetX;
        let newY = e.clientY - this.offsetY;
        DOM.setStyle(this.element, { left: `${newX}px`, top: `${newY}px` });
    }

    private toggleCollapse() {
        if (this.isCollapsed) {
            this.expand();
        } else {
            this.collapse();
        }
    }

    private collapse() {
        if (this.isCollapsed) return;
        this.isCollapsed = true;

        this.lastUnfoldedState = {
            top: this.element.style.top,
            left: this.element.style.left,
            width: this.element.style.width,
            height: this.element.style.height,
        };

        DOM.hide(this.contentElement);
        DOM.setStyle(this.headerElement, { borderBottom: 'none' });
        DOM.setStyle(this.element, {
            width: 'auto',
            height: 'auto',
            backgroundColor: 'transparent',
            border: 'none',
            boxShadow: 'none',
            borderRadius: '0'
        });
        if (this.collapseButton) {
            this.collapseButton.textContent = '+';
        }
        (this as any).options.onCollapse?.();
    }

    private expand() {
        if (!this.isCollapsed) return;
        this.isCollapsed = false;

        if (this.lastUnfoldedState) {
            DOM.setStyle(this.element, {
                width: this.lastUnfoldedState.width,
                height: this.lastUnfoldedState.height,
                top: this.lastUnfoldedState.top,
                left: this.lastUnfoldedState.left
            });
        }
        DOM.show(this.contentElement, 'block');
        DOM.setStyle(this.headerElement, { borderBottom: '1px solid #555' });
        DOM.setStyle(this.element, {
            backgroundColor: 'rgba(40, 40, 40, 0.9)',
            border: '1px solid #555',
            boxShadow: '0 6px 12px rgba(0, 0, 0, 0.2)',
            borderRadius: '8px'
        });
        if (this.collapseButton) {
            this.collapseButton.textContent = '−';
        }
        (this as any).options.onExpand?.();
    }
}

export class Panel extends Component {
    constructor(options: ComponentOptions) {
        super('div', { ...options, className: ['mate-panel', options.className].join(' ') });
    }
}

export class Container extends Component {
    constructor(options: ComponentOptions) {
        super('div', { ...options, className: ['mate-container', options.className].join(' ') });
    }
}

export class ScrollContainer extends Component {
    constructor(options: ComponentOptions) {
        super('div', { ...options, className: ['mate-scroll-container', options.className].join(' ') });
        this.element.style.flexGrow = "1";
        this.element.style.overflowY = "auto";
    }
}

export class Button extends Component {
    constructor(options: ComponentOptions & { text?: string; onClick?: (ev: MouseEvent) => void }) {
        super('button', { ...options, className: ['mate-button', options.className].join(' ') });
        if (options.text) this.element.textContent = options.text;
        if (options.onClick) DOM.on(this.element, 'click', (ev) => {
            ev.stopPropagation(); // Prevent click from bubbling up to parent elements like FloatingScene
            options.onClick!(ev);
        });

        DOM.setStyle(this.element, {
            padding: '10px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            margin: '10px'
        });
    }
}

export class TextInput extends Component {
    public inputElement: HTMLInputElement;
    constructor(options: ComponentOptions & { placeholder?: string; onInput?: (value: string) => void }) {
        super('div', { ...options, className: ['mate-text-input', options.className].join(' ') });
        this.inputElement = DOM.create('input', { 
            parent: this.element,
            attributes: { 
                type: 'number',
                placeholder: options.placeholder || ''
            },
            style: {
                width: '100px',
                padding: '5px',
                backgroundColor: '#3a3a3a',
                border: '1px solid #555',
                borderRadius: '4px',
                color: 'white'
            }
        });
        if (options.onInput) DOM.on(this.inputElement, 'input', () => options.onInput!(this.inputElement.value));
        DOM.on(this.element, 'click', (ev) => ev.stopPropagation());
    }
    public getValue = () => this.inputElement.value;
    public setValue = (value: string) => this.inputElement.value = value;
}

export class Checkbox extends Component {
    public inputElement: HTMLInputElement;
    constructor(options: ComponentOptions & { label?: string; checked?: boolean; onChange?: (checked: boolean) => void }) {
        super('label', { ...options, className: ['mate-checkbox', options.className].join(' ') });
        this.inputElement = DOM.create('input', { attributes: { type: 'checkbox', checked: String(options.checked || false) } });
        DOM.append(this.element, this.inputElement);
        if (options.label) DOM.append(this.element, DOM.create('span', { text: options.label }));
        if (options.onChange) DOM.on(this.inputElement, 'change', () => options.onChange!((this.inputElement as HTMLInputElement).checked));
        DOM.on(this.element, 'click', (ev) => ev.stopPropagation());
    }
    public getChecked = () => this.inputElement.checked;
    public setChecked = (checked: boolean) => this.inputElement.checked = checked;
}

export class Radio extends Component {
    public inputElement: HTMLInputElement;
    constructor(options: ComponentOptions & { name: string; value: string; label?: string; checked?: boolean; onChange?: (value: string) => void }) {
        super('label', { ...options, className: ['mate-radio', options.className].join(' ') });
        this.inputElement = DOM.create('input', { attributes: { type: 'radio', name: options.name, value: options.value, checked: String(options.checked || false) } });
        DOM.append(this.element, this.inputElement);
        if (options.label) DOM.append(this.element, DOM.create('span', { text: options.label }));
        if (options.onChange) DOM.on(this.inputElement, 'change', () => options.onChange!((this.inputElement as HTMLInputElement).value));
        DOM.on(this.element, 'click', (ev) => ev.stopPropagation());
    }
    public getValue = () => this.inputElement.value;
    public setChecked = (checked: boolean) => this.inputElement.checked = checked;
}

export class Select extends Component {
    public selectElement: HTMLSelectElement;
    constructor(options: ComponentOptions & { options: { value: string; text: string }[]; onChange?: (value: string) => void }) {
        super('div', { ...options, className: ['mate-select', options.className].join(' ') });
        this.selectElement = DOM.create('select');
        options.options.forEach(opt => {
            const optionElement = DOM.create('option', { attributes: { value: opt.value }, text: opt.text });
            DOM.append(this.selectElement, optionElement);
        });
        DOM.append(this.element, this.selectElement);
        if (options.onChange) DOM.on(this.selectElement, 'change', () => options.onChange!(this.selectElement.value));
        DOM.on(this.element, 'click', (ev) => ev.stopPropagation());
    }
    public getValue = () => this.selectElement.value;
    public setValue = (value: string) => this.selectElement.value = value;
}

export class Slider extends Component {
    public inputElement: HTMLInputElement;
    constructor(options: ComponentOptions & { min?: number; max?: number; value?: number; step?: number; onChange?: (value: number) => void }) {
        super('div', { ...options, className: ['mate-slider', options.className].join(' ') });
        this.inputElement = DOM.create('input', { attributes: { type: 'range', min: String(options.min || 0), max: String(options.max || 100), value: String(options.value || 0), step: String(options.step || 1) } });
        DOM.append(this.element, this.inputElement);
        if (options.onChange) DOM.on(this.inputElement, 'input', () => options.onChange!(parseFloat(this.inputElement.value)));
        DOM.on(this.element, 'click', (ev) => ev.stopPropagation());
    }
    public getValue = () => parseFloat(this.inputElement.value);
    public setValue = (value: number) => this.inputElement.value = value.toString();
}

export class TextArea extends Component {
    public textareaElement: HTMLTextAreaElement;
    constructor(options: ComponentOptions & { placeholder?: string; onInput?: (value: string) => void; rows?: number; cols?: number }) {
        super('div', { ...options, className: ['mate-textarea', options.className].join(' ') });
        this.textareaElement = DOM.create('textarea', { attributes: { placeholder: options.placeholder || '', rows: String(options.rows || 3), cols: String(options.cols || 30) } });
        DOM.append(this.element, this.textareaElement);
        if (options.onInput) DOM.on(this.textareaElement, 'input', () => options.onInput!(this.textareaElement.value));
        DOM.on(this.element, 'click', (ev) => ev.stopPropagation());
    }
    public getValue = () => this.textareaElement.value;
    public setValue = (value: string) => this.textareaElement.value = value;
}

export class Label extends Component {
    constructor(options: ComponentOptions & { text?: string; forElement?: HTMLElement | string }) {
        super('label', { ...options, className: ['mate-label', options.className].join(' ') });
        if (options.text) DOM.append(this.element, DOM.create('span', { text: options.text }));
        if (options.forElement) {
            if (typeof options.forElement === 'string') {
                this.element.setAttribute('for', options.forElement);
            } else {
                this.element.setAttribute('for', options.forElement.id);
            }
        }
    }
}

export class Image extends Component {
    constructor(options: ComponentOptions & { src: string; alt?: string }) {
        super('img', { ...options, className: ['mate-image', options.className].join(' ') });
        (this.element as HTMLImageElement).src = options.src;
        if (options.alt) (this.element as HTMLImageElement).alt = options.alt;
    }
}

export class Form extends Component {
    constructor(options: ComponentOptions & { onSubmit?: (event: Event) => void }) {
        super('form', { ...options, className: ['mate-form', options.className].join(' ') });
        if (options.onSubmit) DOM.on(this.element, 'submit', options.onSubmit);
    }
}

export class Header extends Component {
    constructor(options: ComponentOptions & { text?: string; level?: 1 | 2 | 3 | 4 | 5 | 6 }) {
        super(`h${options.level || 1}` as keyof HTMLElementTagNameMap, { ...options, className: ['mate-header', options.className].join(' ') });
        if (options.text) this.element.textContent = options.text;
    }
}

export class Canvas extends Component {
    public canvasElement: HTMLCanvasElement;
    constructor(options: ComponentOptions & { width?: number; height?: number }) {
        super('canvas', { ...options, className: ['mate-canvas', options.className].join(' ') });
        this.canvasElement = this.element as HTMLCanvasElement;
        if (options.width) this.canvasElement.width = options.width;
        if (options.height) this.canvasElement.height = options.height;
    }
}

interface FloatingSceneOptions extends ComponentOptions { // title removed
    initialPosition?: { top?: string; left?: string; right?: string; bottom?: string; };
    initialSize?: { width?: string; height?: string; };
    onClose?: () => void;
    onSetup?: (sceneView: SceneView, floatingScene: FloatingScene) => void;
    onFileDrop?: (file: File) => void;
    startSelected?: boolean;
}

export class FloatingScene extends Component {
    public sceneView: SceneView;
    private headerElement: HTMLElement;
    private closeButton: HTMLElement;

    // --- Drag & Resize Properties ---
    private isDragging: boolean = false;
    private offsetX: number = 0;
    private offsetY: number = 0;
    private isResizing: boolean = false;
    private resizeDirection: string = '';
    private startX: number = 0;
    private startY: number = 0;
    private startWidth: number = 0;
    private startHeight: number = 0;
    private startLeft: number = 0;
    private startTop: number = 0;
    // New properties for click vs drag detection
    private hasDragged: boolean = false;
    private dragStartX: number = 0;
    private dragStartY: number = 0;
    private readonly DRAG_THRESHOLD = 5; // pixels


    private boundOnMouseMove = this.onMouseMove.bind(this);
    private boundOnMouseUp = this.onMouseUp.bind(this);
    private boundOnResizeMouseMove = this.onResizeMouseMove.bind(this);
    private boundOnResizeMouseUp = this.onResizeMouseUp.bind(this);
    private boundOnDocumentClick = this.onDocumentClick.bind(this);

    private options: FloatingSceneOptions;
    private isSelected: boolean = false;

    constructor(options: FloatingSceneOptions) {
        let uiContainer = document.getElementById('game-ui-container');
        if (!uiContainer) {
            uiContainer = DOM.create('div', { id: 'game-ui-container', parent: document.body });
        }

        super('div', { ...options, parent: uiContainer, className: ['mate-floating-scene', options.className].join(' ') });
        this.options = options;

        // Main container styling - mostly transparent, becomes visible on selection
        DOM.setStyle(this.element, {
            position: 'absolute',
            top: options.initialPosition?.top || '20%',
            left: options.initialPosition?.left || '30%',
            width: options.initialSize?.width || '400px',
            height: options.initialSize?.height || '300px',
            // No background or backdrop filter by default
            border: '2px solid transparent', // Transparent border for hover/selection
            borderRadius: '8px',
            zIndex: '10000',
            display: 'flex',
            flexDirection: 'column',
            transition: 'all 0.2s ease',
            ...options.style
        });

        // SceneView fills the container
        const contentElement = DOM.create('div', { className: 'mate-floating-scene-content', parent: this.element, style: { flexGrow: '1', position: 'relative', overflow: 'hidden', borderRadius: '8px' } });

        this.sceneView = new SceneView({
            parent: contentElement,
            onSetup: (sv) => { if (options.onSetup) options.onSetup(sv, this); }
        });
        this.sceneView.renderer.setClearColor(0x000000, 0); // Transparent background for the 3D scene

        // Header for dragging and title, initially hidden
        this.headerElement = DOM.create('div', {
            className: 'mate-floating-scene-header',
            parent: this.element,
            style: {
                padding: '8px 12px',
                backgroundColor: 'rgba(40, 40, 40, 0.8)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                cursor: 'grab',
                display: 'none', // Hidden by default
                flexShrink: '0',
                color: '#E0E0E0',
                fontSize: '14px',
                fontWeight: 'bold',
                textAlign: 'center',
                position: 'relative' // For positioning the close button
            },
            text: 'Model Preview'
        });
        // Prepend header so it appears at the top
        this.element.insertBefore(this.headerElement, contentElement);

        // Fullscreen Button
        DOM.create('button', {
            text: '⛶',
            className: 'mate-window-fullscreen-btn',
            parent: this.headerElement,
            style: {
                position: 'absolute', top: '5px', right: '35px', // Position next to close button
                background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#E0E0E0',
            },
            events: {
                click: (e) => { e.stopPropagation(); this.toggleFullscreen(); }
            }
        });

        // Close button, initially hidden
        this.closeButton = DOM.create('button', {
            text: '✕',
            parent: this.headerElement, // Attach to header
            style: {
                position: 'absolute',
                top: '5px',
                right: '5px',
                background: 'rgba(0, 0, 0, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                fontSize: '16px',
                cursor: 'pointer',
                color: '#E0E0E0',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                display: 'block', // Visibility is controlled by the header's display property
                zIndex: '10'
            },
            events: {
                click: (e) => {
                    e.stopPropagation(); // Prevent click from deselecting
                    this.destroy();
                },
                mousedown: (e) => e.stopPropagation() // Prevent drag start on button
            }
        });

        // Event listeners
        DOM.on(this.headerElement, 'mousedown', (e) => this.onMouseDown(e as MouseEvent)); // Dragging is now on the header
        
        // --- Drag and Drop Listeners ---
        DOM.on(this.element, 'dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.isSelected) {
                DOM.setStyle(this.element, { borderColor: '#4caf50' }); // Green highlight on drag over
            }
        });

        DOM.on(this.element, 'dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.isSelected) {
                DOM.setStyle(this.element, { borderColor: 'rgba(0, 150, 255, 0.8)' }); // Revert to selection highlight
            }
        });

        DOM.on(this.element, 'drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer?.files.length) {
                this.options.onFileDrop?.(e.dataTransfer.files[0]);
            }
            DOM.setStyle(this.element, { borderColor: 'rgba(0, 150, 255, 0.8)' }); // Revert to selection highlight
        });

        document.addEventListener('click', this.boundOnDocumentClick);

        this._createResizeHandles(); // Create handles but keep them hidden initially

        if (options.startSelected) {
            // Start in the "selected but transparent" state to show borders/header
            // without the background, which appears on a direct click.
            this._showDragState();
        }
    }

    public select() {
        // This is the "fully selected" state with an opaque background.
        this.isSelected = true;
        DOM.setStyle(this.element, {
            borderColor: 'rgba(0, 150, 255, 0.8)',
            boxShadow: '0 4px 15px rgba(0, 150, 255, 0.3)',
            backgroundColor: 'rgba(30, 30, 30, 0.7)', // Show background on select
            backdropFilter: 'blur(10px)',
        });
        DOM.show(this.headerElement, 'flex'); // Show the header, which contains the close button
        DOM.getAll('.mate-resize-handle', this.element).forEach(h => DOM.show(h as HTMLElement, 'block'));
    }

    // Shows selection visuals without the background, for use during a drag.
    private _showDragState() {
        // This is the "dragging" or "initial" state with a transparent background.
        DOM.setStyle(this.element, {
            borderColor: 'rgba(0, 150, 255, 0.8)',
            boxShadow: '0 4px 15px rgba(0, 150, 255, 0.3)',
            // Explicitly set background to transparent for the drag state
            backgroundColor: 'transparent',
            backdropFilter: 'none',
        });
        // This must be set after styling to ensure the state is correct for other logic
        this.isSelected = true;
        DOM.show(this.headerElement, 'flex');
        DOM.getAll('.mate-resize-handle', this.element).forEach(h => DOM.show(h as HTMLElement, 'block'));
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
        DOM.hide(this.headerElement); // Hide the header
        DOM.getAll('.mate-resize-handle', this.element).forEach(h => DOM.hide(h as HTMLElement));
    }

    private onDocumentClick(e: MouseEvent) {
        // If the click is outside this element, deselect it
        if (this.isSelected && !this.element.contains(e.target as Node)) {
            this.deselect();
        }
    }

    public destroy() {
        this.options.onClose?.();
        this.sceneView.destroy();
        document.removeEventListener('mousemove', this.boundOnMouseMove);
        document.removeEventListener('mouseup', this.boundOnMouseUp);
        document.removeEventListener('mousemove', this.boundOnResizeMouseMove);
        document.removeEventListener('mouseup', this.boundOnResizeMouseUp);
        document.removeEventListener('click', this.boundOnDocumentClick);
        super.destroy();
    }

    private onMouseDown(e: MouseEvent) {
        e.preventDefault();

        this.isDragging = true;
        this.hasDragged = false; // Reset on new mousedown
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;

        const rect = this.element.getBoundingClientRect();
        DOM.setStyle(this.element, { top: `${rect.top}px`, left: `${rect.left}px`, right: 'auto', bottom: 'auto', margin: '0', transform: 'none' });
        this.offsetX = e.clientX - rect.left;
        this.offsetY = e.clientY - rect.top;

        document.addEventListener('mousemove', this.boundOnMouseMove);
        document.addEventListener('mouseup', this.boundOnMouseUp);
    }

    private onMouseUp() {
        if (this.isDragging && !this.hasDragged) {
            // If the mouse didn't move, it's a click.
            this.select();
        }

        this.isDragging = false;
        DOM.setStyle(this.headerElement, { cursor: 'grab' });
        document.removeEventListener('mousemove', this.boundOnMouseMove);
        document.removeEventListener('mouseup', this.boundOnMouseUp);
    }

    private onMouseMove(e: MouseEvent) {
        if (!this.isDragging) return;

        if (!this.hasDragged) {
            const dx = e.clientX - this.dragStartX;
            const dy = e.clientY - this.dragStartY;
            if (Math.sqrt(dx * dx + dy * dy) > this.DRAG_THRESHOLD) {
                this.hasDragged = true;
                this._showDragState(); // Show drag visuals (border/header) without the background
                DOM.setStyle(this.headerElement, { cursor: 'grabbing' });
            }
        }

        if (this.hasDragged) {
            let newX = e.clientX - this.offsetX;
            let newY = e.clientY - this.offsetY;
            DOM.setStyle(this.element, { left: `${newX}px`, top: `${newY}px` });
        }
    }

    // --- Resizing and Fullscreen Logic (similar to Window) ---

    private isFullscreen: boolean = false;
    private lastWindowState: { top: string; left: string; width: string; height: string; } | null = null;

    private _createResizeHandles() {
        const handleDirs: { [key: string]: Partial<CSSStyleDeclaration> } = {
            'n': { top: '0', left: '5px', right: '5px', height: '5px', cursor: 'ns-resize' },
            's': { bottom: '0', left: '5px', right: '5px', height: '5px', cursor: 'ns-resize' },
            'w': { top: '5px', bottom: '5px', left: '0', width: '5px', cursor: 'ew-resize' },
            'e': { top: '5px', bottom: '5px', right: '0', width: '5px', cursor: 'ew-resize' },
            'nw': { top: '0', left: '0', width: '10px', height: '10px', cursor: 'nwse-resize' },
            'ne': { top: '0', right: '0', width: '10px', height: '10px', cursor: 'nesw-resize' },
            'sw': { bottom: '0', left: '0', width: '10px', height: '10px', cursor: 'nesw-resize' },
            'se': { bottom: '0', right: '0', width: '10px', height: '10px', cursor: 'nwse-resize' }
        };

        for (const dir in handleDirs) {
            DOM.create('div', {
                className: `mate-resize-handle mate-resize-${dir}`,
                parent: this.element,
                style: {
                    position: 'absolute', ...handleDirs[dir], zIndex: '10001', display: 'none'
                },
                events: {
                    mousedown: (e) => this.onResizeMouseDown(e as MouseEvent, dir)
                }
            });
        }
    }

    private onResizeMouseDown(e: MouseEvent, dir: string) {
        e.preventDefault(); e.stopPropagation();
        this.isResizing = true; this.resizeDirection = dir;
        this.startX = e.clientX; this.startY = e.clientY;
        const rect = this.element.getBoundingClientRect();
        this.startWidth = rect.width; this.startHeight = rect.height;
        this.startLeft = rect.left; this.startTop = rect.top;
        document.addEventListener('mousemove', this.boundOnResizeMouseMove);
        document.addEventListener('mouseup', this.boundOnResizeMouseUp);
    }

    private onResizeMouseMove(e: MouseEvent) {
        if (!this.isResizing) return;
        const dx = e.clientX - this.startX; const dy = e.clientY - this.startY;
        let newWidth = this.startWidth, newHeight = this.startHeight, newLeft = this.startLeft, newTop = this.startTop;
        if (this.resizeDirection.includes('e')) newWidth = this.startWidth + dx;
        if (this.resizeDirection.includes('w')) { newWidth = this.startWidth - dx; newLeft = this.startLeft + dx; }
        if (this.resizeDirection.includes('s')) newHeight = this.startHeight + dy;
        if (this.resizeDirection.includes('n')) { newHeight = this.startHeight - dy; newTop = this.startTop + dy; }
        const minWidth = 150, minHeight = 100;
        if (newWidth > minWidth) { this.element.style.width = `${newWidth}px`; this.element.style.left = `${newLeft}px`; }
        if (newHeight > minHeight) { this.element.style.height = `${newHeight}px`; this.element.style.top = `${newTop}px`; }
    }

    private onResizeMouseUp() {
        this.isResizing = false;
        document.removeEventListener('mousemove', this.boundOnResizeMouseMove);
        document.removeEventListener('mouseup', this.boundOnResizeMouseUp);
    }

    private toggleFullscreen() {
        if (!this.isFullscreen) {
            this.lastWindowState = { top: this.element.style.top, left: this.element.style.left, width: this.element.style.width, height: this.element.style.height };
            DOM.setStyle(this.element, { top: '0', left: '0', width: '100vw', height: '100vh', borderRadius: '0' });
            this.isFullscreen = true;
        } else {
            if (this.lastWindowState) {
                DOM.setStyle(this.element, { ...this.lastWindowState, borderRadius: '8px' });
            }
            this.isFullscreen = false;
        }
    }
}

export class SceneView extends Component {
    public renderer: THREE.WebGLRenderer;
    public scene: THREE.Scene;
    public camera: THREE.PerspectiveCamera;
    public onAnimate: (() => void) | null = null; // Public callback for custom animation logic

    private animationFrameId: number | null = null;
    private resizeObserver: ResizeObserver;

    constructor(options: ComponentOptions & { onSetup?: (sceneView: SceneView) => void }) {
        super('div', { ...options, className: ['mate-scene-view', options.className].join(' ') });
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

        // Initial setup by the user
        if (options.onSetup) {
            options.onSetup(this);
        } else {
            // Default setup if none provided
            this.camera.position.z = 5;
            const geometry = new THREE.BoxGeometry();
            const material = new THREE.MeshNormalMaterial();
            const cube = new THREE.Mesh(geometry, material);
            this.scene.add(cube);

            // Default animation
            this.onAnimate = () => {
                cube.rotation.x += 0.005;
                cube.rotation.y += 0.005;
            };
        }

        this.resizeObserver = new ResizeObserver(this.onResize.bind(this));
        this.resizeObserver.observe(this.element);

        this.start();
    }

    private onResize() {
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

// --- Notification System ---

interface NotificationOptions {
    duration?: number;
    backgroundColor?: string;
    textColor?: string;
    fontSize?: string;
    html?: string; // Allow HTML content
}

interface SiteTransitionOptions {
    duration?: number;
    backgroundColor?: string;
    animationType?: 'fade' | 'slide'; // Future expansion
    onComplete?: () => void;
}

// --- Main UI Class ---

/**
 * # UI - High-Level UI Framework
 * Provides a component-based system for creating complex user interfaces, including a notification system.
 */
export class UI {
    public static Window = Window;
    public static Panel = Panel;
    public static Container = Container;
    public static ScrollContainer = ScrollContainer;
    public static Button = Button;
    public static TextInput = TextInput;
    public static Checkbox = Checkbox;
    public static Radio = Radio;
    public static Select = Select;
    public static Slider = Slider;
    public static TextArea = TextArea;
    public static Label = Label;
    public static Image = Image;
    public static Form = Form;
    public static Header = Header;
    public static Canvas = Canvas;
    public static SceneView = SceneView;
    public static FloatingScene = FloatingScene;

    /**
     * Initiates a site transition overlay with customizable animation.
     * @param options Configuration for the transition, including duration, background color, and animation type.
     */
    public static transition(options: SiteTransitionOptions = {}) {
        const { duration = 500, backgroundColor = 'rgba(0, 0, 0, 0.8)', animationType = 'fade', onComplete } = options;

        const overlay = DOM.create('div', {
            style: {
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                backgroundColor: backgroundColor,
                zIndex: '99999',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '2em',
                pointerEvents: 'none', // Allow clicks to pass through when not active
                // Initial state based on animation type
                opacity: animationType === 'fade' ? '0' : '1',
                transform: animationType === 'slide' ? 'translateX(100%)' : 'none',
                transition: `opacity ${duration}ms ease-in-out, transform ${duration}ms ease-in-out`
            }
        });

        DOM.append(document.body, overlay);

        // Animate in
        requestAnimationFrame(() => {
            if (animationType === 'fade') {
                DOM.setStyle(overlay, { opacity: '1', pointerEvents: 'auto' });
            } else if (animationType === 'slide') {
                DOM.setStyle(overlay, { transform: 'translateX(0%)', pointerEvents: 'auto' });
            }
        });

        // Animate out after duration
        setTimeout(() => {
            if (animationType === 'fade') {
                DOM.setStyle(overlay, { opacity: '0', pointerEvents: 'none' });
            } else if (animationType === 'slide') {
                DOM.setStyle(overlay, { transform: 'translateX(-100%)', pointerEvents: 'none' });
            }
            setTimeout(() => {
                DOM.remove(overlay);
                onComplete?.();
            }, duration); // Wait for fade-out transition to complete before removing
        }, duration);
    }

    /**
     * Makes an HTMLElement draggable within the viewport.
     * @param element The HTMLElement to make draggable.
     */
    public static makeDraggable(element: HTMLElement) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

        if (element.style.position === '' || element.style.position === 'static') {
            element.style.position = 'absolute';
        }

        const dragMouseDown = (e: MouseEvent) => {
            e = e || window.event;
            e.preventDefault();
            // get the mouse cursor position at startup:
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            // call a function whenever the cursor moves:
            document.onmousemove = elementDrag;
        };

        const elementDrag = (e: MouseEvent) => {
            e = e || window.event;
            e.preventDefault();
            // calculate the new cursor position:
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            // set the element's new position:
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        };

        const closeDragElement = () => {
            // stop moving when mouse button is released:
            document.onmouseup = null;
            document.onmousemove = null;
        };

        element.onmousedown = dragMouseDown;
    }

    /**
     * Injects the default stylesheet for all MATE UI components into the document head.
     * Should be called once at the start of the application.
     */
    public static injectStylesheet() {
        const styles = `
            .mate-panel { background: #f0f0f0; border: 1px solid #ccc; padding: 10px; }
            .mate-container { padding: 5px; border: 1px solid #eee; }
            .mate-scroll-container { overflow-y: auto; border: 1px solid #ddd; padding: 5px; }
            .mate-button { background: #007bff; color: white; border: none; padding: 10px 15px; cursor: pointer; }
            .mate-text-input input { width: 100%; padding: 8px; border: 1px solid #ccc; }
            .mate-label { font-weight: bold; margin-bottom: 5px; display: block; }
            .mate-image { max-width: 100%; height: auto; display: block; }
            .mate-form { padding: 10px; border: 1px solid #eee; }
            .mate-window {
                background-color: rgba(40, 40, 40, 0.9);
                border: 1px solid #555;
                border-radius: 8px;
                box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2);
                z-index: 1000;
                font-family: 'Inter, sans-serif';
                color: '#E0E0E0';
                transition: width 0.2s ease, height 0.2s ease, border-radius 0.2s ease, background-color 0.2s ease, border 0.2s ease, box-shadow 0.2s ease;
            }
            .mate-window-header {
                padding: 8px 12px;
                background-color: #3a3a3a;
                cursor: grab;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .mate-window-close-btn, .mate-window-collapse-btn {
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                color: #E0E0E0;
                line-height: 1;
                padding: 0 5px;
            }
            .mate-window-content {
                flex-grow: 1;
                overflow: auto;
                padding: 10px;
                background-color: rgba(40, 40, 40, 0.9);
                color: #E0E0E0;
                border-top: 1px solid #555;
            }
        `;
        const styleElement = DOM.create('style', { html: styles });
        DOM.append(document.head, styleElement);
    }

    /**
     * Displays a highly customizable, temporary notification on the screen.
     * @param message The plain text message to display.
     * @param options A configuration object for the notification.
     */
    public static notify(message: string, options: NotificationOptions = {}) {
        const { 
            duration = 2500, 
            ...styleOptions 
        } = options;

        const notificationElement = DOM.create('div', {
            html: options.html || message
        });

        DOM.setStyle(notificationElement, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            padding: '12px 20px',
            backgroundColor: styleOptions.backgroundColor || 'rgba(30, 30, 30, 0.9)',
            color: styleOptions.textColor || '#e0e0e0',
            borderRadius: '8px',
            zIndex: '10002',
            fontFamily: 'Inter, sans-serif',
            fontSize: styleOptions.fontSize || '16px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
            opacity: '0',
            transform: 'translateY(20px)',
            transition: 'opacity 0.4s ease, transform 0.4s ease',
            pointerEvents: 'none',
        });

        document.body.appendChild(notificationElement);

        requestAnimationFrame(() => {
            DOM.setStyle(notificationElement, {
                opacity: '1',
                transform: 'translateY(0)'
            });
        });

        setTimeout(() => {
            DOM.setStyle(notificationElement, {
                opacity: '0',
                transform: 'translateY(20px)'
            });
            setTimeout(() => {
                DOM.remove(notificationElement);
            }, 400); // Matches transition duration
        }, duration);
    }
}