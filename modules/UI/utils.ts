import { DOM } from '../DOM';
import { Logger } from '../Logger';

interface SiteTransitionOptions {
    duration?: number;
    backgroundColor?: string;
    animationType?: 'fade' | 'slide'; // Future expansion
    onComplete?: () => void;
}

export class UIUtils {
    private static stylesheetInjected = false;

    /**
     * Injects the default stylesheet for all MATE UI components into the document head.
     * Should be called once at the start of the application.
     */
    public static injectStylesheet() {
        if (this.stylesheetInjected) return;
        const styleId = 'mate-ui-stylesheet';
        if (document.getElementById(styleId)) {
            this.stylesheetInjected = true;
            return;
        }

        const styles = `
            /* Variables for consistent theming */
            :root {
                --mate-bg-primary: #1a1a1a;
                --mate-bg-secondary: #222222;
                --mate-border-color: #444444;
                --mate-text-color: #e0e0e0;
                --mate-accent-color: #6a82fb;
                --mate-accent-color-hover: #5a70e0;
            }

            /* General resets and base styles for the UI */
            .mate-window,
            .mate-window-header,
            .mate-window-content,
            .mate-button,
            .mate-text-input input {
                box-sizing: border-box;
            }

            /* The main window container */
            .mate-window {
                background: linear-gradient(to bottom, var(--mate-bg-primary), #121212);
                border: 1px solid var(--mate-border-color); /* Re-introducing a subtle border for brutalism */
                border-radius: 0px;
                box-shadow: none;
                font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
                color: var(--mate-text-color);
                overflow: hidden;
                transition: all 0.2s ease-in-out;
            }

            /* Draggable header bar */
            .mate-window-header {
                padding: 10px 15px;
                background: linear-gradient(to bottom, var(--mate-bg-secondary), #1b1b1b);
                cursor: grab;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid var(--mate-border-color);
                user-select: none;
            }
            
            .mate-window-title {
                font-weight: 600;
                font-size: 16px;
                color: var(--mate-text-color);
            }

            .mate-window-controls {
                display: flex;
                gap: 5px;
            }

            /* Header buttons (close, minimize, etc.) */
            .mate-window-close-btn,
            .mate-window-collapse-btn,
            .mate-window-fullscreen-btn { /* Added fullscreen button */
                background: none;
                border: none;
                font-size: 20px;
                line-height: 1;
                color: var(--mate-text-color);
                cursor: pointer;
                padding: 0 4px;
                transition: color 0.2s ease;
            }

            .mate-window-close-btn:hover {
                color: #f04747; /* Keep red for close */
            }
            
            .mate-window-collapse-btn:hover,
            .mate-window-fullscreen-btn:hover {
                color: var(--mate-accent-color);
            }

            /* The scrollable content area */
            .mate-window-content {
                padding: 15px;
                background: linear-gradient(to bottom, var(--mate-bg-primary), #121212);
                overflow-y: auto;
                flex-grow: 1;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            /* Primary action button */
            .mate-button {
                background: linear-gradient(to bottom, var(--mate-accent-color), var(--mate-accent-color-hover));
                color: var(--mate-text-color);
                border: 1px solid var(--mate-accent-color);
                padding: 10px 18px;
                border-radius: 0px; /* Brutalist */
                cursor: pointer;
                font-weight: 600;
                transition: background-color 0.2s ease, border-color 0.2s ease;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .mate-button:hover {
                background: linear-gradient(to bottom, var(--mate-accent-color-hover), var(--mate-accent-color));
                border-color: var(--mate-accent-color-hover);
            }

            /* Input fields */
            .mate-text-input input {
                width: 100%;
                padding: 10px 12px;
                border: 1px solid var(--mate-border-color);
                border-radius: 0px; /* Brutalist */
                background-color: var(--mate-bg-secondary);
                color: var(--mate-text-color);
                transition: border-color 0.2s ease, box-shadow 0.2s ease;
            }

            .mate-text-input input:focus {
                outline: none;
                border-color: var(--mate-accent-color);
                box-shadow: 0 0 0 1px var(--mate-accent-color);
            }

            /* --- Custom Checkbox --- */
            .mate-checkbox {
                position: relative;
            }

            .mate-checkmark {
                position: relative;
                height: 18px;
                width: 18px;
                background-color: var(--mate-bg-secondary);
                border: 1px solid var(--mate-border-color);
                border-radius: 0px; /* Brutalist */
                transition: background-color 0.2s, border-color 0.2s;
                flex-shrink: 0;
            }

            /* Checkmark symbol (the check) */
            .mate-checkmark:after {
                content: "";
                position: absolute;
                display: none;
                left: 6px;
                top: 2px;
                width: 5px;
                height: 10px;
                border: solid var(--mate-text-color);
                border-width: 0 2px 2px 0;
                transform: rotate(45deg);
            }

            /* Show the checkmark when the hidden input is checked */
            .mate-checkbox input:checked ~ .mate-checkmark:after {
                display: block;
            }

            /* Change background on check */
            .mate-checkbox input:checked ~ .mate-checkmark {
                background-color: var(--mate-accent-color);
                border-color: var(--mate-accent-color);
            }

            /* Hover effect */
            .mate-checkbox:hover .mate-checkmark {
                border-color: var(--mate-accent-color);
            }

            .mate-checkbox-label {
                color: var(--mate-text-color);
            }

            /* Labels for inputs */
            .mate-label {
                font-weight: 500;
                margin-bottom: 5px;
                color: var(--mate-text-color);
                display: block;
            }

            /* General container and panel styles */
            .mate-panel,
            .mate-container,
            .mate-form {
                background-color: var(--mate-bg-secondary);
                border: 1px solid var(--mate-border-color);
                padding: 12px;
                border-radius: 0px; /* Brutalist */
            }

            /* Scrollable container for lists, etc. */
            .mate-scroll-container {
                overflow-y: auto;
                border: 1px solid var(--mate-border-color);
                border-radius: 0px; /* Brutalist */
                padding: 10px;
                background-color: var(--mate-bg-secondary);
            }

            /* Image styles */
            .mate-image {
                max-width: 100%;
                height: auto;
                display: block;
                border-radius: 0px; /* Brutalist */
            }

            /* --- Progress Bar --- */
            .mate-progress-bar {
                position: relative;
                width: 100%;
                height: 24px;
                background-color: var(--mate-bg-secondary);
                border: 1px solid var(--mate-border-color);
                border-radius: 0px; /* Brutalist */
                overflow: hidden;
                margin: 10px 0;
                box-sizing: border-box;
            }

            .mate-progress-bar-fill {
                height: 100%;
                width: 0%;
                background: linear-gradient(45deg, var(--mate-accent-color), var(--mate-accent-color-hover));
                background-size: 40px 40px;
                transition: width 0.3s ease-in-out;
                animation: mate-progress-bar-stripes 1s linear infinite;
            }

            @keyframes mate-progress-bar-stripes {
                from { background-position: 40px 0; }
                to { background-position: 0 0; }
            }
        `;
        const styleElement = DOM.create('style', { id: styleId, html: styles });
        DOM.append(document.head, styleElement);
        this.stylesheetInjected = true;
    }

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
}