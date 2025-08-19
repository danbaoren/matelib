
import { Component } from './Component';
import { ComponentProps } from './types';
import { DOM } from '../DOM';

export interface TextAreaProps extends ComponentProps {
    placeholder?: string;
    onInput?: (value: string) => void;
    rows?: number;
    cols?: number;
    value?: string;
}

export class TextArea extends Component<TextAreaProps> {
    public textareaElement: HTMLTextAreaElement;

    constructor(props: TextAreaProps) {
        super('div', { ...props, className: ['mate-textarea', props.className].join(' ') });

        this.textareaElement = DOM.create('textarea', {
            attributes: {
                placeholder: props.placeholder || '',
                rows: String(props.rows || 3),
                cols: String(props.cols || 30)
            }
        });

        if (props.value) {
            this.textareaElement.value = props.value;
        }

        DOM.append(this.element, this.textareaElement);

        if (props.onInput) {
            DOM.on(this.textareaElement, 'input', () => props.onInput!(this.textareaElement.value));
        }

        DOM.on(this.element, 'click', (ev) => ev.stopPropagation());
    }

    public getValue = () => this.textareaElement.value;
    public setValue = (value: string) => this.textareaElement.value = value;
}
