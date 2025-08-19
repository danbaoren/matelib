
import { Component } from './Component';
import { ComponentProps } from './types';

/**
 * Props for the Label component.
 */
export interface LabelProps extends ComponentProps {
    /** The text content of the label. */
    text?: string;
    /** The ID of the element this label is for. */
    forElement?: string;
}

/**
 * A declarative Label component.
 */
export class Label extends Component<LabelProps> {
    constructor(props: LabelProps) {
        const labelStyle: Partial<CSSStyleDeclaration> = {
            fontWeight: '500',
            marginBottom: '5px',
            color: '#b9bbbe',
            display: 'block',
        };

        const finalProps = {
            ...props,
            style: { ...labelStyle, ...props.style },
        };

        super('label', finalProps);

        if (props.text) {
            this.element.textContent = props.text;
        }

        if (props.forElement) {
            this.element.setAttribute('for', props.forElement);
        }
    }
}
