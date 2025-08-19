import { DOM } from "../DOM";

// --- Notification System ---

export interface NotificationOptions {
    duration?: number;
    backgroundColor?: string;
    textColor?: string;
    fontSize?: string;
    html?: string; // Allow HTML content
}

export class Notify {
    /**
     * Displays a highly customizable, temporary notification on the screen.
     * @param message The plain text message to display.
     * @param options A configuration object for the notification.
     */
    public static show(message: string, options: NotificationOptions = {}) {
        const {
            duration = 3000,
            ...styleOptions
        } = options;

        const notificationElement = DOM.create('div', {
            html: options.html || message
        });

        // Base style
        DOM.setStyle(notificationElement, {
            position: 'fixed',
            bottom: '40px',
            left: '50%',
            padding: '16px 28px',
            background: styleOptions.backgroundColor || 'linear-gradient(145deg, rgba(30,30,35,0.96), rgba(15,15,20,0.96))',
            color: styleOptions.textColor || '#fff',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            fontSize: styleOptions.fontSize || '17px',
            fontWeight: '500',
            borderRadius: '14px',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: `
                0 4px 20px rgba(0,0,0,0.5),
                inset 0 1px 0 rgba(255,255,255,0.06)
            `,
            backdropFilter: 'blur(10px) saturate(150%)',
            transform: 'translate(-50%, 60px) scale(0.8)',
            opacity: '0',
            transition: 'transform 0.55s cubic-bezier(0.23, 1, 0.32, 1), opacity 0.45s ease',
            pointerEvents: 'none',
            zIndex: '10002',
        });

        document.body.appendChild(notificationElement);

        // Animate in with subtle overshoot for a "spring" feel
        requestAnimationFrame(() => {
            DOM.setStyle(notificationElement, {
                opacity: '1',
                transform: 'translate(-50%, 0) scale(1.02)',
            });

            setTimeout(() => {
                DOM.setStyle(notificationElement, {
                    transform: 'translate(-50%, 0) scale(1)',
                });
            }, 350); // Overshoot correction
        });

        // Auto dismiss
        setTimeout(() => {
            DOM.setStyle(notificationElement, {
                opacity: '0',
                transform: 'translate(-50%, -30px) scale(0.96)',
            });
            setTimeout(() => {
                DOM.remove(notificationElement);
            }, 500);
        }, duration);
    }
}
