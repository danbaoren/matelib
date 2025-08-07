
import * as RE from 'rogue-engine';

export enum LogLevel {
    NONE = 0,
    ERROR = 1,
    WARN = 2,
    INFO = 3,
    DEBUG = 4,
}

export class Logger {
    private static currentLevel: LogLevel = LogLevel.INFO;
    private static timerMap: Map<string, number> = new Map();

    public static setLevel(level: LogLevel): void {
        this.currentLevel = level;
    }

    public static log(message: any, context?: string, ...args: any[]): void {
        this._log(LogLevel.INFO, 'log', '#ffffff', message, context, ...args);
    }

    public static warn(message: any, context?: string, ...args: any[]): void {
        this._log(LogLevel.WARN, 'warn', '#ffcc00', message, context, ...args);
    }

    public static error(message: any, context?: string, ...args: any[]): void {
        this._log(LogLevel.ERROR, 'error', '#ff4d4d', message, context, ...args);
    }

    public static debug(message: any, context?: string, ...args: any[]): void {
        this._log(LogLevel.DEBUG, 'log', '#888888', message, context, ...args);
    }

    public static logcolor(color: string, message: any, context?: string, ...args: any[]): void {
        this._log(LogLevel.INFO, 'log', color, message, context, ...args);
    }

    public static time(label: string): void {
        if (this.currentLevel < LogLevel.DEBUG) return;
        this.timerMap.set(label, performance.now());
        console.time(label); // Use native console.time for better dev tool integration
    }

    public static timeEnd(label: string): void {
        if (this.currentLevel < LogLevel.DEBUG) return;
        if (this.timerMap.has(label)) {
            const startTime = this.timerMap.get(label)!;
            const duration = performance.now() - startTime;
            this.timerMap.delete(label);
            this.log(`Timer ${label}: ${duration.toFixed(2)}ms`, 'Performance');
            console.timeEnd(label); // Use native console.timeEnd
        } else {
            this.warn(`Timer with label "${label}" does not exist.`, 'Performance');
        }
    }

    public static assert(condition: boolean, message: string, context?: string, ...args: any[]): void {
        if (!condition) {
            this.error(`Assertion Failed: ${message}`, context, ...args);
            console.assert(condition, message, ...args); // Native assert for dev tools
        }
    }

    public static group(label: string, collapsed: boolean = false): void {
        if (this.currentLevel < LogLevel.INFO) return;
        if (collapsed) {
            console.groupCollapsed(label);
        } else {
            console.group(label);
        }
    }

    public static groupEnd(): void {
        if (this.currentLevel < LogLevel.INFO) return;
        console.groupEnd();
    }

    private static _log(
        level: LogLevel,
        type: 'log' | 'warn' | 'error',
        color: string,
        message: any,
        context?: string,
        ...args: any[]
    ): void {
        if (level > this.currentLevel) {
            return;
        }

        const timestamp = new Date().toLocaleTimeString();
        const contextPrefix = context ? `[${context}] ` : '';

        const isEditor = (window as any)["rogue-editor-api"];

        if (isEditor) {
            const messageForRE = `${contextPrefix}${String(message)} ${args.map(arg => {
                if (typeof arg === 'object' && arg !== null) {
                    try {
                        return JSON.stringify(arg);
                    } catch (e) {
                        return '[Unserializable Object]';
                    }
                }
                return String(arg);
            }).join(' ')}`;
            if (RE.Debug) RE.Debug.log(messageForRE);
        } else {
            const consoleMessage = `%c[mate] ${timestamp} ${contextPrefix}${String(message)}`;
            console[type](consoleMessage, `color: ${color};`, ...args);

            if (level === LogLevel.ERROR && (message instanceof Error)) {
                console.error(message);
            }
        }
    }
}
