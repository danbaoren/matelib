import { Component } from './Component';
import { ComponentProps } from './types';
import { DOM } from '../DOM';
import { UIUtils } from './utils';

export interface WindowButtonProps extends ComponentProps {
    onClick: () => void;
    description?: string;
    icon?: string;
    initialPosition?: { top?: string; left?: string; right?: string; bottom?: string };
    initialSize?: { width?: string; height?: string };
    draggable?: boolean;
    hoverable?: boolean;
}

const defaultWindowButtonStyle: Partial<CSSStyleDeclaration> = {
    position: 'absolute',
    width: '50px',
    height: '50px',
    backgroundColor: 'transparent',
    borderRadius: '8px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
    userSelect: 'none',
    zIndex: '9999',
    color: '#E0E0E0',
    fontSize: '24px',
};

export class WindowButton<P extends WindowButtonProps> extends Component<P> {
    protected descriptionElement: HTMLElement | null = null;
    protected isDragging = false;
    protected isClickBlocked = false; // New flag to block clicks after drag
    protected initialMouseX = 0;
    protected initialMouseY = 0;
    protected offsetX = 0;
    protected offsetY = 0;
    protected hoverTimeout: number | null = null;

    constructor(props: P) {
        const finalProps = { ...props };

        if (!finalProps.parent) {
            finalProps.parent = document.body;
        }

        const finalButtonStyle = {
            ...defaultWindowButtonStyle,
            ...finalProps.initialSize,
            ...finalProps.initialPosition,
            ...finalProps.style,
        };

        super('div', { ...finalProps, style: finalButtonStyle, children: [] });

        UIUtils.injectStylesheet();

        // Icon
        DOM.create('div', {
            parent: this.element,
            html: props.icon || '✨',
            style: {
                width: '100%',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
            }
        });

        // Description on hover
        if (props.description) {
            this.descriptionElement = DOM.create('div', {
                parent: this.element,
                text: props.description,
                style: {
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    color: '#fff',
                    padding: '5px 10px',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap',
                    opacity: '0',
                    transition: 'opacity 0.2s ease-in-out',
                    pointerEvents: 'none',
                    marginBottom: '5px',
                    fontSize: '12px',
                }
            });

            DOM.on(this.element, 'mouseenter', this.handleMouseEnter);
            DOM.on(this.element, 'mouseleave', this.handleMouseLeave);
        }

        // Click handler
        DOM.on(this.element, 'click', this.handleClick);

        // Draggable
        if (props.draggable !== false) {
            DOM.on(this.element, 'mousedown', this.onMouseDown);
        }
    }

    protected handleClick = (e: MouseEvent) => {
        // Prevent drag from triggering click
        if (!this.isClickBlocked) {
            this.props.onClick();
        }
        this.isClickBlocked = false; // Reset for next click
    };

    protected handleMouseEnter = () => {
        if (this.descriptionElement) {
            if (this.hoverTimeout) {
                clearTimeout(this.hoverTimeout);
                this.hoverTimeout = null;
            }
            this.hoverTimeout = window.setTimeout(() => {
                if (this.descriptionElement) {
                    DOM.setStyle(this.descriptionElement, { opacity: '1' });
                }
            }, 250); // Show after 2 seconds
        }
    };

    protected handleMouseLeave = () => {
        if (this.descriptionElement) {
            if (this.hoverTimeout) {
                clearTimeout(this.hoverTimeout);
                this.hoverTimeout = null;
            }
            DOM.setStyle(this.descriptionElement, { opacity: '0' });
        }
    };

    protected onMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        this.isDragging = false; // Assume no drag initially
        this.isClickBlocked = false; // Assume click is not blocked initially
        this.initialMouseX = e.clientX;
        this.initialMouseY = e.clientY;

        const rect = this.element.getBoundingClientRect();
        this.offsetX = e.clientX - rect.left;
        this.offsetY = e.clientY - rect.top;
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mouseup', this.onMouseUp);
    };

    protected onMouseMove = (e: MouseEvent) => {
        if (!this.isDragging && (Math.abs(e.clientX - this.initialMouseX) > 5 || Math.abs(e.clientY - this.initialMouseY) > 5)) {
            // If mouse moves more than 5 pixels, consider it a drag
            this.isDragging = true;
            this.isClickBlocked = true; // Block click if dragging starts
        }

        if (!this.isDragging) return; // Only proceed if dragging has started

        const newX = e.clientX - this.offsetX;
        const newY = e.clientY - this.offsetY;
        DOM.setStyle(this.element, { left: `${newX}px`, top: `${newY}px`, transform: 'none' });
    };

    protected onMouseUp = () => {
        this.isDragging = false;
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);
    };
}

