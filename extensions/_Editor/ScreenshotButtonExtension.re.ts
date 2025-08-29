import * as RE from 'rogue-engine';
import { AssetManager } from '../../modules/AssetManager';
import { WindowButton } from '../../modules/UI/WindowButton';
import { Logger } from '../../modules/Logger';
import { DOM } from '../../modules/DOM';

declare global {
    interface Window {
        __MATE_SCREENSHOT_INITIALIZED__?: boolean;
    }
}

@RE.registerComponent
export default class ScreenshotButtonExtension extends RE.Component {
    static isEditorComponent = true;

    private screenshotButton: WindowButton<any>;
    private screenshotDataUrl: string | null = null;
    private previewContainer: HTMLElement | null = null;
    private previewImage: HTMLImageElement | null = null;

    start() {
        Logger.log("ScreenshotButtonExtension.start() called.");
        // Only initialize if not already initialized to prevent multiple instances
        if (window.__MATE_SCREENSHOT_INITIALIZED__) {
            Logger.log("ScreenshotButtonExtension already initialized.");
            return;
        }
        window.__MATE_SCREENSHOT_INITIALIZED__ = true;

        this.screenshotButton = new WindowButton({
            onClick: async () => {
                this.screenshotDataUrl = await AssetManager.screenshot();
                if (this.previewImage) {
                    this.previewImage.src = this.screenshotDataUrl;
                }
            },
            description: "Take a screenshot",
            icon: '📸',
            initialPosition: { right: '20px', bottom: '20px' },
            initialSize: { width: '60px', height: '60px' },
            draggable: true,
        });

        this.createPreviewElements();

        DOM.on(this.screenshotButton.element, 'mouseenter', this.handleButtonMouseEnter);
        DOM.on(this.screenshotButton.element, 'mouseleave', this.handleButtonMouseLeave);

        Logger.log("Screenshot Button Extension Initialized.");
    }

    private createPreviewElements() {
        this.previewContainer = DOM.create('div', {
            id: 'screenshot-preview-container',
            style: {
                position: 'fixed',
                top: '0',
                left: '0',
                zIndex: '10000',
                borderRadius: '4px',
                backgroundColor: 'rgba(28, 28, 30, 0.9)',
                padding: '12px',
                boxShadow: '0 8px 25px rgba(0,0,0,0.7)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                display: 'none', // Initially hidden
            }
        });

        this.previewImage = DOM.create('img', {
            style: {
                maxWidth: '300px',
                maxHeight: '230px',
                display: 'block',
                borderRadius: '1px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
            }
        });

        DOM.append(this.previewContainer, this.previewImage);
        DOM.append(document.body, this.previewContainer);
    }

    private handleButtonMouseEnter = () => {
        if (this.screenshotDataUrl && this.previewContainer && this.previewImage) {
            this.previewImage.src = this.screenshotDataUrl;
            DOM.setStyle(this.previewContainer, { display: 'block' });

            // Position the preview container relative to the button
            const buttonRect = this.screenshotButton.element.getBoundingClientRect();
            const previewWidth = 300 + 24; // max-width + padding
            const previewHeight = 230 + 24; // max-height + padding

            let top = buttonRect.top;
            let left = buttonRect.left - previewWidth - 10; // 10px left of the button

            // Adjust if it goes off screen
            if (left < 0) {
                left = buttonRect.right + 10; // 10px right of the button
            }
            if (top + previewHeight > window.innerHeight) {
                top = window.innerHeight - previewHeight - 10;
            }
            if (top < 0) {
                top = 10;
            }

            DOM.setStyle(this.previewContainer, { top: `${top}px`, left: `${left}px` });
        }
    };

    private handleButtonMouseLeave = () => {
        if (this.previewContainer) {
            DOM.setStyle(this.previewContainer, { display: 'none' });
        }
    };

    onDestroy() {
        if (this.screenshotButton) {
            this.screenshotButton.destroy();
        }
        if (this.previewContainer && this.previewContainer.parentNode) {
            this.previewContainer.parentNode.removeChild(this.previewContainer);
        }
    }
}
