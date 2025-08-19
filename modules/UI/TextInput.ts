
import { Component } from './Component';
import { ComponentProps } from './types';
import { DOM } from '../DOM';

/**
 * Props for the TextInput component.
 */
export interface TextInputProps extends ComponentProps {
    /** The placeholder text for the input. */
    placeholder?: string;
    /** The initial value of the input. */
    value?: string;
    /** The type of the input (e.g., 'text', 'number', 'password'). */
    type?: 'text' | 'number' | 'password' | 'email';
    /** The function to call when the input value changes. */
    onInput?: (value: string) => void;
}

/**
 * A declarative TextInput component.
 */
export class TextInput extends Component<TextInputProps> {
    public inputElement: HTMLInputElement;

    constructor(props: TextInputProps) {
        super('div', { ...props, children: [] }); // Pass empty children to super

        const inputStyle: Partial<CSSStyleDeclaration> = {
            width: '100%',
            padding: '10px 12px',
            border: '1px solid #4a4e54',
            borderRadius: '4px',
            backgroundColor: '#23272a',
            color: '#ffffff',
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        };

        this.inputElement = DOM.create('input', {
            parent: this.element,
            attributes: {
                type: props.type || 'text',
                placeholder: props.placeholder || '',
                value: props.value || '',
            },
            style: inputStyle,
        });

        if (props.onInput) {
            DOM.on(this.inputElement, 'input', () => props.onInput!(this.inputElement.value));
        }

        // Prevent clicks on the input from propagating to parent elements.
        DOM.on(this.element, 'click', (ev) => ev.stopPropagation());
    }

    /**
     * Gets the current value of the input.
     * @returns The current value.
     */
    public getValue = (): string => this.inputElement.value;

    /**
     * Sets the value of the input.
     * @param value The new value to set.
     */
    public setValue = (value: string): void => {
        this.inputElement.value = value;
    };
}
