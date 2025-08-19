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
                background-color: #2c2f33;
                border: 1px solid #4a4e54;
                border-radius: 6px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
                font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
                color: #f2f2f2;
                overflow: hidden;
                transition: all 0.2s ease-in-out;
            }

            /* Draggable header bar */
            .mate-window-header {
                padding: 10px 15px;
                background-color: #23272a;
                cursor: grab;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid #4a4e54;
                user-select: none;
            }
            
            .mate-window-title {
                font-weight: 600;
                font-size: 16px;
                color: #ffffff;
            }

            .mate-window-controls {
                display: flex;
                gap: 5px;
            }

            /* Header buttons (close, minimize, etc.) */
            .mate-window-close-btn,
            .mate-window-collapse-btn {
                background: none;
                border: none;
                font-size: 20px;
                line-height: 1;
                color: #99aab5;
                cursor: pointer;
                padding: 0 4px;
                transition: color 0.2s ease;
            }

            .mate-window-close-btn:hover {
                color: #f04747;
            }
            
            .mate-window-collapse-btn:hover {
                color: #ffffff;
            }

            /* The scrollable content area */
            .mate-window-content {
                padding: 15px;
                background-color: #2c2f33;
                overflow-y: auto;
                flex-grow: 1;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            /* Primary action button */
            .mate-button {
                background-color: #7289da;
                color: #ffffff;
                border: none;
                padding: 10px 18px;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 600;
                transition: background-color 0.2s ease;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .mate-button:hover {
                background-color: #677bc4;
            }

            /* Input fields */
            .mate-text-input input {
                width: 100%;
                padding: 10px 12px;
                border: 1px solid #4a4e54;
                border-radius: 4px;
                background-color: #23272a;
                color: #ffffff;
                transition: border-color 0.2s ease, box-shadow 0.2s ease;
            }

            .mate-text-input input:focus {
                outline: none;
                border-color: #7289da;
                box-shadow: 0 0 0 1px #7289da;
            }

            /* --- Custom Checkbox --- */
            .mate-checkbox {
                /* Base styles are now set in the component constructor */
                position: relative; /* For positioning the input */
            }

            .mate-checkmark {
                position: relative;
                height: 18px;
                width: 18px;
                background-color: #23272a;
                border: 1px solid #4a4e54;
                border-radius: 3px;
                transition: background-color 0.2s, border-color 0.2s;
                flex-shrink: 0; /* Prevent it from shrinking */
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
                border: solid white;
                border-width: 0 2px 2px 0;
                transform: rotate(45deg);
            }

            /* Show the checkmark when the hidden input is checked */
            .mate-checkbox input:checked ~ .mate-checkmark:after {
                display: block;
            }

            /* Change background on check */
            .mate-checkbox input:checked ~ .mate-checkmark {
                background-color: #7289da;
                border-color: #7289da;
            }

            /* Hover effect */
            .mate-checkbox:hover .mate-checkmark {
                border-color: #99aab5;
            }

            .mate-checkbox-label {
                color: #b9bbbe;
            }

            /* Labels for inputs */
            .mate-label {
                font-weight: 500;
                margin-bottom: 5px;
                color: #b9bbbe;
                display: block;
            }

            /* General container and panel styles */
            .mate-panel,
            .mate-container,
            .mate-form {
                background-color: #36393f;
                border: 1px solid #4a4e54;
                padding: 12px;
                border-radius: 4px;
            }

            /* Scrollable container for lists, etc. */
            .mate-scroll-container {
                overflow-y: auto;
                border: 1px solid #4a4e54;
                border-radius: 4px;
                padding: 10px;
                background-color: #36393f;
            }

            /* Image styles */
            .mate-image {
                max-width: 100%;
                height: auto;
                display: block;
                border-radius: 4px;
            }

            /* --- Progress Bar --- */
            .mate-progress-bar {
                position: relative;
                width: 100%;
                height: 24px;
                background-color: #23272a;
                border: 1px solid #4a4e54;
                border-radius: 4px;
                overflow: hidden;
                margin: 10px 0;
                box-sizing: border-box;
            }

            .mate-progress-bar-fill {
                height: 100%;
                width: 0%;
                background-color: #7289da; /* Fallback */
                background-image: linear-gradient(
                    45deg, 
                    rgba(255, 255, 255, 0.15) 25%, 
                    transparent 25%, 
                    transparent 50%, 
                    rgba(255, 255, 255, 0.15) 50%, 
                    rgba(255, 255, 255, 0.15) 75%, 
                    transparent 75%, 
                    transparent
                );
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