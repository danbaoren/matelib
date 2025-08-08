
import { Logger } from './Logger'

export class InputManager {
    private static _instance: InputManager;
    private _keyState: { [key: string]: boolean } = {};
    private _keyStateDown: { [key: string]: boolean } = {};
    private _keyStateUp: { [key: string]: boolean } = {};

    private constructor() {
        if (InputManager._instance) {
            throw new Error("Error: Instantiation failed: Use InputManager.getInstance() instead of new.");
        }
        window.addEventListener('keydown', (e) => this._onKeyDown(e));
        window.addEventListener('keyup', (e) => this._onKeyUp(e));
        window.addEventListener('mousedown', (e) => this._onMouseDown(e));
        window.addEventListener('mouseup', (e) => this._onMouseUp(e));
    }

    public static getInstance(): InputManager {
        if (!InputManager._instance) {
            InputManager._instance = new InputManager();
        }
        return InputManager._instance;
    }

    private _onKeyDown(event: KeyboardEvent) {
        const key = event.key.toLowerCase();
        if (!this._keyState[key]) {
            this._keyStateDown[key] = true;
        }
        this._keyState[key] = true;
    }

    private _onKeyUp(event: KeyboardEvent) {
        const key = event.key.toLowerCase();
        this._keyState[key] = false;
        this._keyStateUp[key] = true;
    }

    private _onMouseDown(event: MouseEvent) {
        const key = 'mouse' + event.button;
        if (!this._keyState[key]) {
            this._keyStateDown[key] = true;
        }
        this._keyState[key] = true;
    }

    private _onMouseUp(event: MouseEvent) {
        const key = 'mouse' + event.button;
        this._keyState[key] = false;
        this._keyStateUp[key] = true;
    }

    public is(key: string): boolean {
        return this._keyState[key.toLowerCase()] || false;
    }

    public isPressed(key: string): boolean {
        const state = this._keyStateDown[key.toLowerCase()] || false;
        if (state) {
            this._keyStateDown[key.toLowerCase()] = false;
        }
        return state;
    }

    public isReleased(key: string): boolean {
        const state = this._keyStateUp[key.toLowerCase()] || false;
        if (state) {
            this._keyStateUp[key.toLowerCase()] = false;
        }
        return state;
    }

    public update() {
        // Clearing logic moved to isPressed/isReleased
    }

    /**
     * Debug method to log all currently pressed keys.
     * Use this to easily map key presses to their string identifiers.
     */
    public logPressedKeys() {
        for (const key in this._keyState) {
            if (this._keyState[key]) {
                Logger.log(`Key pressed: "${key}"`);
            }
        }
    }
}


export const Key = {
    // Keyboard Alpha
    A: 'a', B: 'b', C: 'c', D: 'd', E: 'e', F: 'f', G: 'g', H: 'h', I: 'i', J: 'j', K: 'k', L: 'l', M: 'm', N: 'n', O: 'o', P: 'p', Q: 'q', R: 'r', S: 's', T: 't', U: 'u', V: 'v', W: 'w', X: 'x', Y: 'y', Z: 'z',

    // Keyboard Numbers
    Num0: '0', Num1: '1', Num2: '2', Num3: '3', Num4: '4', Num5: '5', Num6: '6', Num7: '7', Num8: '8', Num9: '9',

    // Keyboard Function Keys
    F1: 'f1', F2: 'f2', F3: 'f3', F4: 'f4', F5: 'f5', F6: 'f6', F7: 'f7', F8: 'f8', F9: 'f9', F10: 'f10', F11: 'f11', F12: 'f12',

    // Keyboard Special Keys
    Space: ' ',
    Enter: 'enter',
    Escape: 'escape',
    Backspace: 'backspace',
    Tab: 'tab',
    Shift: 'shift',
    Control: 'control',
    Alt: 'alt',
    Meta: 'meta', // Command key on Mac, Windows key on Windows
    CapsLock: 'capslock',
    ArrowUp: 'arrowup',
    ArrowDown: 'arrowdown',
    ArrowLeft: 'arrowleft',
    ArrowRight: 'arrowright',
    PageUp: 'pageup',
    PageDown: 'pagedown',
    Home: 'home',
    End: 'end',
    Insert: 'insert',
    Delete: 'delete',

    // Keyboard Punctuation
    Backquote: '`',
    Minus: '-',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    Period: '.',
    Slash: '/',

    // Mouse Buttons
    MouseLeft: 'mouse0',
    MouseMiddle: 'mouse1',
    MouseRight: 'mouse2',

    // Gamepad 0
    Gamepad_0: {
        ButtonA: 'gamepad0_button0',      // Cross on PlayStation
        ButtonB: 'gamepad0_button1',      // Circle on PlayStation
        ButtonX: 'gamepad0_button2',      // Square on PlayStation
        ButtonY: 'gamepad0_button3',      // Triangle on PlayStation
        L1: 'gamepad0_button4',           // Left Bumper
        R1: 'gamepad0_button5',           // Right Bumper
        L2: 'gamepad0_button6',           // Left Trigger
        R2: 'gamepad0_button7',           // Right Trigger
        Select: 'gamepad0_button8',       // Back/Share
        Start: 'gamepad0_button9',        // Start/Options
        L3: 'gamepad0_button10',          // Left Stick Press
        R3: 'gamepad0_button11',          // Right Stick Press
        DpadUp: 'gamepad0_button12',
        DpadDown: 'gamepad0_button13',
        DpadLeft: 'gamepad0_button14',
        DpadRight: 'gamepad0_button15',
        Home: 'gamepad0_button16',        // PS/Xbox/Nintendo Button

        AxisLeftX: 'gamepad0_axis0',
        AxisLeftY: 'gamepad0_axis1',
        AxisRightX: 'gamepad0_axis2',
        AxisRightY: 'gamepad0_axis3',
    },

    // Gamepad 1
    Gamepad_1: {
        ButtonA: 'gamepad1_button0',
        ButtonB: 'gamepad1_button1',
        ButtonX: 'gamepad1_button2',
        ButtonY: 'gamepad1_button3',
        L1: 'gamepad1_button4',
        R1: 'gamepad1_button5',
        L2: 'gamepad1_button6',
        R2: 'gamepad1_button7',
        Select: 'gamepad1_button8',
        Start: 'gamepad1_button9',
        L3: 'gamepad1_button10',
        R3: 'gamepad1_button11',
        DpadUp: 'gamepad1_button12',
        DpadDown: 'gamepad1_button13',
        DpadLeft: 'gamepad1_button14',
        DpadRight: 'gamepad1_button15',
        Home: 'gamepad1_button16',

        AxisLeftX: 'gamepad1_axis0',
        AxisLeftY: 'gamepad1_axis1',
        AxisRightX: 'gamepad1_axis2',
        AxisRightY: 'gamepad1_axis3',
    },

    // Gamepad 2
    Gamepad_2: {
        ButtonA: 'gamepad2_button0',
        ButtonB: 'gamepad2_button1',
        ButtonX: 'gamepad2_button2',
        ButtonY: 'gamepad2_button3',
        L1: 'gamepad2_button4',
        R1: 'gamepad2_button5',
        L2: 'gamepad2_button6',
        R2: 'gamepad2_button7',
        Select: 'gamepad2_button8',
        Start: 'gamepad2_button9',
        L3: 'gamepad2_button10',
        R3: 'gamepad2_button11',
        DpadUp: 'gamepad2_button12',
        DpadDown: 'gamepad2_button13',
        DpadLeft: 'gamepad2_button14',
        DpadRight: 'gamepad2_button15',
        Home: 'gamepad2_button16',

        AxisLeftX: 'gamepad2_axis0',
        AxisLeftY: 'gamepad2_axis1',
        AxisRightX: 'gamepad2_axis2',
        AxisRightY: 'gamepad2_axis3',
    },

    // Gamepad 3
    Gamepad_3: {
        ButtonA: 'gamepad3_button0',
        ButtonB: 'gamepad3_button1',
        ButtonX: 'gamepad3_button2',
        ButtonY: 'gamepad3_button3',
        L1: 'gamepad3_button4',
        R1: 'gamepad3_button5',
        L2: 'gamepad3_button6',
        R2: 'gamepad3_button7',
        Select: 'gamepad3_button8',
        Start: 'gamepad3_button9',
        L3: 'gamepad3_button10',
        R3: 'gamepad3_button11',
        DpadUp: 'gamepad3_button12',
        DpadDown: 'gamepad3_button13',
        DpadLeft: 'gamepad3_button14',
        DpadRight: 'gamepad3_button15',
        Home: 'gamepad3_button16',

        AxisLeftX: 'gamepad3_axis0',
        AxisLeftY: 'gamepad3_axis1',
        AxisRightX: 'gamepad3_axis2',
        AxisRightY: 'gamepad3_axis3',
    },
};