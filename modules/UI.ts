import { DOM } from "./DOM";

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
    private isDragging: boolean = false;
    private offsetX: number = 0;
    private offsetY: number = 0;

    constructor(options: WindowOptions) {
        super('div', { ...options, className: ['mate-window', options.className].join(' ') });

        // Set initial position and size
        DOM.setStyle(this.element, {
            position: 'absolute',
            ...options.initialPosition,
            width: options.initialSize?.width || '300px',
            height: options.initialSize?.height || '200px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
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
                padding: '8px',
                backgroundColor: '#3a3a3a',
                color: '#E0E0E0',
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
                text: '−', // Minus sign for collapse
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
                overflow: 'auto',
                padding: '10px',
                backgroundColor: 'rgba(40, 40, 40, 0.9)',
                color: '#E0E0E0',
                borderTop: '1px solid #555'
            }
        });

        // Make draggable
        this.headerElement.onmousedown = (e: MouseEvent) => this.onMouseDown(e);
        document.onmouseup = () => this.onMouseUp();
        document.onmousemove = (e: MouseEvent) => this.onMouseMove(e);

        // Auto-collapse/expand on mouse leave/enter
        if (options.collapsible) {
            this.element.onmouseenter = () => this.handleMouseEnter();
            this.element.onmouseleave = () => this.handleMouseLeave();
        }
    }

    public appendChild(child: HTMLElement) {
        DOM.append(this.contentElement, child);
    }

    public get content(): HTMLElement {
        return this.contentElement;
    }

    private onMouseDown(e: MouseEvent) {
        if (!this.isCollapsed) {
            this.isDragging = true;
            this.offsetX = e.clientX - this.element.getBoundingClientRect().left;
            this.offsetY = e.clientY - this.element.getBoundingClientRect().top;
            DOM.setStyle(this.headerElement, { cursor: 'grabbing' });
        }
    }

    private onMouseUp() {
        this.isDragging = false;
        DOM.setStyle(this.headerElement, { cursor: 'grab' });
    }

    private onMouseMove(e: MouseEvent) {
        if (!this.isDragging || this.isCollapsed) return;
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
        DOM.setStyle(this.headerElement, { borderBottom: 'none' }); // Remove border when content is hidden
        DOM.setStyle(this.element, {
            width: 'auto',
            height: 'auto',
            backgroundColor: 'transparent',
            border: 'none',
            boxShadow: 'none',
            borderRadius: '0'
        });
        if (this.collapseButton) {
            this.collapseButton.textContent = '+'; // Plus sign for expand
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
        DOM.setStyle(this.headerElement, { borderBottom: '1px solid #555' }); // Restore border
        DOM.setStyle(this.element, {
            backgroundColor: 'rgba(40, 40, 40, 0.9)',
            border: '1px solid #555',
            boxShadow: '0 6px 12px rgba(0, 0, 0, 0.2)',
            borderRadius: '8px'
        });
        if (this.collapseButton) {
            this.collapseButton.textContent = '−'; // Minus sign for collapse
        }
        (this as any).options.onExpand?.();
    }

    private handleMouseEnter() {
        if (this.collapseTimeout) {
            clearTimeout(this.collapseTimeout);
            this.collapseTimeout = null;
        }
        if (this.isCollapsed) {
            this.expand();
        }
    }

    private handleMouseLeave() {
        if (this.isDragging || this.isCollapsed) return;
        this.collapseTimeout = window.setTimeout(() => this.collapse(), 500);
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
    }
}

export class Button extends Component {
    constructor(options: ComponentOptions & { text?: string; onClick?: (ev: MouseEvent) => void }) {
        super('button', { ...options, className: ['mate-button', options.className].join(' ') });
        if (options.text) this.element.textContent = options.text;
        if (options.onClick) DOM.on(this.element, 'click', options.onClick);
    }
}

export class TextInput extends Component {
    public inputElement: HTMLInputElement;
    constructor(options: ComponentOptions & { placeholder?: string; onInput?: (value: string) => void }) {
        super('div', { ...options, className: ['mate-text-input', options.className].join(' ') });
        this.inputElement = DOM.create('input', { attributes: { placeholder: options.placeholder || '' } });
        DOM.append(this.element, this.inputElement);
        if (options.onInput) DOM.on(this.inputElement, 'input', () => options.onInput!(this.inputElement.value));
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
