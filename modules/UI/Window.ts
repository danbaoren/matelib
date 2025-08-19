import { Component } from './Component';
import { ComponentProps } from './types';
import { DOM } from '../DOM';
import { Header } from './Header';
import { Button } from './Button';
import { UIUtils } from './utils';

import { Logger } from '../Logger';

export interface WindowProps extends ComponentProps {
    windowId?: string;
    title?: string;
    initialPosition?: { top?: string; left?: string; right?: string; bottom?: string };
    initialSize?: { width?: string; height?: string };
    collapsible?: boolean;
    resizable?: boolean;
    closable?: boolean;
    onClose?: () => void;
    hoverable?: boolean;
    hoverIcon?: string;
    initialBackgroundColor?: string;
    initialBorder?: string;
    initialBoxShadow?: string;
    hideHeader?: boolean;
    fullscreenable?: boolean;
    hasShadow?: boolean;
}

type UnfoldedState = {
    width: string;
    height: string;
    minWidth: string;
    minHeight: string;
    backgroundColor: string;
    border: string;
    boxShadow: string;
};

const defaultWindowStyle: Partial<CSSStyleDeclaration> = {
    position: 'absolute',
    width: '450px',
    height: 'auto',
    minWidth: '200px',
    minHeight: '150px',
    backgroundColor: '#2a2a2a',
    border: '0px solid #444',
    borderRadius: '0px',
    boxShadow: '0 0px 0px rgba(0, 0, 0, 0.3)',
    zIndex: '10000',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'Inter, sans-serif',
    transition: 'width 0.2s ease, height 0.2s ease, min-width 0.2s ease, min-height 0.2s ease, background-color 0.2s ease, border 0.2s ease, box-shadow 0.2s ease',
};

export class Window<P extends WindowProps> extends Component<P> {
    protected header: Header;
    public content: HTMLElement;
    protected closeButton?: Button;
    protected collapseButton?: Button;
    protected hoverIconElement: HTMLElement | null = null;
    protected resizeHandle: HTMLElement | null = null;
    protected collapseTimeout: number | null = null;

    protected isDragging = false;
    protected offsetX = 0;
    protected offsetY = 0;

    protected isResizing = false;
    protected startX = 0;
    protected startY = 0;
    protected startWidth = 0;
    protected startHeight = 0;

    protected isCollapsed = false;
    protected lastUnfoldedState: Partial<UnfoldedState> | null = null;

    protected isFullscreen: boolean = false;
    protected originalPosition: { top: string, left: string };
    protected originalSize: { width: string, height: string };

    private static windowCounter = 0;

    constructor(props: P) {
        const finalProps = { ...props }; // Create a mutable copy of props

        // Assign a unique ID if not provided
        if (!finalProps.windowId) {
            finalProps.windowId = `window-${Window.windowCounter++}`;
        }

        // Check if a window with this ID already exists in the DOM
        if (document.getElementById(finalProps.windowId)) {
            Logger.error(`Window with ID '${finalProps.windowId}' already exists. Preventing creation of duplicate window.`);
            throw new Error(`Window with ID '${finalProps.windowId}' already exists.`);
        }

        if (!finalProps.parent) { // If parent is not provided, default to document.body
            finalProps.parent = document.body;
        }

        const finalWindowStyle = {
            ...defaultWindowStyle,
            backgroundColor: finalProps.initialBackgroundColor || defaultWindowStyle.backgroundColor,
            border: (finalProps.hasShadow === false) ? 'none' : (finalProps.initialBorder || defaultWindowStyle.border),
            boxShadow: (finalProps.hasShadow === false) ? 'none' : (finalProps.initialBoxShadow || defaultWindowStyle.boxShadow),
            ...finalProps.initialSize,
            ...finalProps.style,
        };

        let isCenteredViaTransform = false;
        if (finalProps.initialPosition && (finalProps.initialPosition.top !== undefined || finalProps.initialPosition.left !== undefined)) {
            Object.assign(finalWindowStyle, finalProps.initialPosition);
        } else {
            Object.assign(finalWindowStyle, { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });
            isCenteredViaTransform = true;
        }

        super('div', { ...finalProps, id: finalProps.windowId, style: finalWindowStyle, children: [] });

        // Check if a window with this ID already exists in the DOM after the element is created
        // This is necessary because super() must be called first, and the Component constructor
        // might immediately append the element to the DOM.
        const existingElement = document.getElementById(finalProps.windowId);
        if (existingElement && existingElement !== this.element) {
            Logger.error(`Window with ID '${finalProps.windowId}' already exists. Preventing creation of duplicate window.`);
            if (this.element && this.element.parentNode) {
                this.element.parentNode.removeChild(this.element);
            }
            throw new Error(`Window with ID '${finalProps.windowId}' already exists.`);
        }

        UIUtils.injectStylesheet(); // Inject stylesheet on window creation

        if (isCenteredViaTransform) {
            setTimeout(() => {
                if (!this.element) return;
                const rect = this.element.getBoundingClientRect();
                DOM.setStyle(this.element, {
                    top: `${rect.top}px`,
                    left: `${rect.left}px`,
                    transform: 'none'
                });
            }, 0);
        }

        this.header = new Header({
            parent: this.element,
            text: props.title || 'Window',
            level: 2,
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
                flexShrink: '0',
            },
        });

        if (props.hideHeader) {
            DOM.hide(this.header.element);
        }

        const controlsContainer = DOM.create('div', {
            parent: this.header.element,
            style: { display: 'flex', gap: '5px' },
        });

        if (props.collapsible) {
            this.collapseButton = new Button({
                parent: controlsContainer,
                text: '−',
                onClick: () => this.toggleCollapse(),
                style: { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#E0E0E0', lineHeight: '1', padding: '0 5px' },
            });
        }

        if (props.fullscreenable === true) {
            // Add fullscreen button
            DOM.create('button', {
                text: '⛶',
                className: 'mate-window-fullscreen-btn',
                parent: controlsContainer,
                style: {
                    background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#E0E0E0', lineHeight: '1', padding: '0 5px',
                },
                events: {
                    click: (e) => { e.stopPropagation(); this.toggleFullscreen(); }
                }
            });
        }

        if (props.closable !== false) {
            this.closeButton = new Button({
                parent: controlsContainer,
                text: '✕',
                onClick: () => this.close(),
                style: { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#E0E0E0', lineHeight: '1', padding: '0 5px' },
            });
        }

        this.addCustomHeaderElements(controlsContainer);

        this.content = DOM.create('div', {
            parent: this.element,
            style: {
                flexGrow: '1', overflowY: 'auto', padding: '10px', color: '#E0E0E0',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
            },
        });

        if (props.children) {
            props.children.forEach(child => {
                DOM.append(this.content, child instanceof HTMLElement ? child : child.element);
            });
        }

        DOM.on(this.header.element, 'mousedown', this.onMouseDown);

        if (props.hoverable) {
            this.hoverIconElement = DOM.create('div', {
                parent: this.element,
                html: props.hoverIcon || '🗒️',
                style: {
                    display: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    width: '40px',
                    height: '40px',
                    alignItems: 'center',
                    justifyContent: 'center',
                }
            });

            DOM.on(this.element, 'mouseenter', this.handleMouseEnter);
            DOM.on(this.element, 'mouseleave', this.handleMouseLeave);
            
            setTimeout(() => this.collapse(), 0);
        }

        if (props.resizable) {
            this.resizeHandle = DOM.create('div', {
                parent: this.element,
                style: {
                    position: 'absolute',
                    bottom: '0',
                    right: '0',
                    width: '12px',
                    height: '12px',
                    cursor: 'nwse-resize',
                    borderBottom: '2px solid #888',
                    borderRight: '2px solid #888',
                    boxSizing: 'border-box',
                }
            });
            DOM.on(this.resizeHandle, 'mousedown', this.onResizeMouseDown);
        }
    }

    protected onResizeMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        this.isResizing = true;

        this.startX = e.clientX;
        this.startY = e.clientY;
        this.startWidth = this.element.offsetWidth;
        this.startHeight = this.element.offsetHeight;

        document.addEventListener('mousemove', this.onResizeMouseMove);
        document.addEventListener('mouseup', this.onResizeMouseUp);
    }

    protected onResizeMouseMove = (e: MouseEvent) => {
        if (!this.isResizing) return;

        const dx = e.clientX - this.startX;
        const dy = e.clientY - this.startY;

        const newWidth = this.startWidth + dx;
        const newHeight = this.startHeight + dy;

        const minWidth = parseInt(this.element.style.minWidth) || 0;
        const minHeight = parseInt(this.element.style.minHeight) || 0;

        if (newWidth > minWidth) {
            this.element.style.width = `${newWidth}px`;
        }
        if (newHeight > minHeight) {
            this.element.style.height = `${newHeight}px`;
        }
    }

    protected onResizeMouseUp = () => {
        this.isResizing = false;
        document.removeEventListener('mousemove', this.onResizeMouseMove);
        document.removeEventListener('mouseup', this.onResizeMouseUp);
    }

    protected onMouseDown = (e: MouseEvent) => {
        this.isDragging = true;
        const rect = this.element.getBoundingClientRect();
        this.offsetX = e.clientX - rect.left;
        this.offsetY = e.clientY - rect.top;
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mouseup', this.onMouseUp);
    };

    protected onMouseMove = (e: MouseEvent) => {
        if (!this.isDragging) return;
        const newX = e.clientX - this.offsetX;
        const newY = e.clientY - this.offsetY;
        DOM.setStyle(this.element, { left: `${newX}px`, top: `${newY}px`, transform: 'none' });
    };

    protected onMouseUp = () => {
        this.isDragging = false;
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);
    };

    protected handleMouseEnter = () => {
        if (this.props.hoverable) {
            if (this.collapseTimeout) {
                clearTimeout(this.collapseTimeout);
                this.collapseTimeout = null;
            }
            if (this.isCollapsed) {
                this.expand();
            }
        }
    }

    protected handleMouseLeave = () => {
        if (this.props.hoverable && !this.isDragging && !this.isResizing && !this.isCollapsed) {
            this.collapseTimeout = window.setTimeout(() => this.collapse(), 300);
        }
    }

    protected toggleCollapse = () => {
        if (this.isCollapsed) {
            this.expand();
        } else {
            this.collapse();
        }
    };

    protected collapse = () => {
        if (this.isCollapsed) return;
        this.isCollapsed = true;

        if (this.resizeHandle) this.resizeHandle.style.display = 'none';

        const style = this.element.style;
        this.lastUnfoldedState = {
            height: style.height,
            minHeight: style.minHeight,
            width: style.width,
            minWidth: style.minWidth,
            backgroundColor: style.backgroundColor,
            border: style.border,
            boxShadow: style.boxShadow,
        };

        if (this.props.hoverable) {
            DOM.hide(this.header.element);
            DOM.hide(this.content);
            if(this.hoverIconElement) {
                this.hoverIconElement.style.display = 'flex';
            }
            
            DOM.setStyle(this.element, {
                width: 'auto',
                height: 'auto',
                minWidth: '0',
                minHeight: '0',
                backgroundColor: 'transparent',
                border: 'none',
                boxShadow: 'none',
            });

        } else { // Original collapse logic
            DOM.hide(this.content);
            DOM.setStyle(this.element, { height: 'auto', minHeight: '0' });
            if (this.collapseButton) {
                this.collapseButton.element.textContent = '+';
            }
        }
    };

    protected expand = () => {
        if (!this.isCollapsed) return;
        this.isCollapsed = false;

        if (this.resizeHandle) this.resizeHandle.style.display = 'block';

        if (this.lastUnfoldedState) {
            DOM.setStyle(this.element, {
                height: this.lastUnfoldedState.height,
                minHeight: this.lastUnfoldedState.minHeight,
                width: this.lastUnfoldedState.width,
                minWidth: this.lastUnfoldedState.minWidth,
                backgroundColor: this.lastUnfoldedState.backgroundColor,
                border: this.lastUnfoldedState.border,
                boxShadow: this.lastUnfoldedState.boxShadow,
            });
        }

        if (this.props.hoverable) {
            DOM.show(this.header.element, 'flex');
            DOM.show(this.content, 'flex');
            if(this.hoverIconElement) this.hoverIconElement.style.display = 'none';
        } else { // Original expand logic
            DOM.show(this.content, 'flex');
            if (this.collapseButton) {
                this.collapseButton.element.textContent = '−';
            }
        }
    };

    public toggleFullscreen() {
        if (this.isFullscreen) {
            // Exit fullscreen
            DOM.setStyle(this.element, {
                position: 'absolute',
                top: this.originalPosition.top,
                left: this.originalPosition.left,
                width: this.originalSize.width,
                height: this.originalSize.height,
                borderRadius: '8px',
                zIndex: 'unset'
            });
            DOM.show(this.header.element, 'flex');
            if (this.resizeHandle) this.resizeHandle.style.display = 'block';
            this.isFullscreen = false;
        } else {
            // Enter fullscreen
            this.originalPosition = { top: this.element.style.top, left: this.element.style.left };
            this.originalSize = { width: this.element.style.width, height: this.element.style.height };

            DOM.setStyle(this.element, {
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                borderRadius: '0',
                zIndex: '9999' // Ensure it's on top
            });
            if (this.resizeHandle) this.resizeHandle.style.display = 'none';
            this.isFullscreen = true;
        }
    }

    protected addCustomHeaderElements(controlsContainer: HTMLElement) {
        // This method can be overridden by child classes to add custom elements to the header.
    }

    public close = () => {
        if (this.props.onClose) {
            this.props.onClose();
        }
        this.destroy();
    };
}