import { Component } from './Component';
import { ComponentProps } from './types';
import { DOM } from '../DOM';

export interface InputProps extends ComponentProps {
    placeholder?: string;
    value?: string;
    type?: string;
    onInput?: (value: string) => void;
    onChange?: (value: string) => void;
}

const defaultInputStyle: Partial<CSSStyleDeclaration> = {
    padding: '8px 12px',
    border: '1px solid #444',
    borderRadius: '4px',
    backgroundColor: '#333',
    color: '#E0E0E0',
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box',
    outline: 'none',
    fontFamily: 'Inter, sans-serif',
};

export class Input extends Component<InputProps> {
    protected inputElement: HTMLInputElement;

    constructor(props: InputProps) {
        super('input', { ...props, style: { ...defaultInputStyle, ...props.style } });

        this.inputElement = this.element as HTMLInputElement;

        if (props.placeholder) {
            this.inputElement.placeholder = props.placeholder;
        }
        if (props.value) {
            this.inputElement.value = props.value;
        }
        if (props.type) {
            this.inputElement.type = props.type;
        }

        if (props.onInput) {
            DOM.on(this.inputElement, 'input', (e) => {
                props.onInput!((e.target as HTMLInputElement).value);
            });
        }

        if (props.onChange) {
            DOM.on(this.inputElement, 'change', (e) => {
                props.onChange!((e.target as HTMLInputElement).value);
            });
        }
    }

    public getValue(): string {
        return this.inputElement.value;
    }

    public setValue(value: string): void {
        this.inputElement.value = value;
    }
}
