import { Component } from './Component';
import { ComponentProps } from './types';
import { DOM } from '../DOM';

/**
 * Props for the Button component.
 */
export interface ButtonProps extends ComponentProps {
    /** The text content of the button. */
    text?: string;
    /** The title attribute of the button (tooltip). */
    title?: string;
    /** The function to call when the button is clicked. */
    onClick?: (event: MouseEvent) => void;
}

/**
 * A declarative Button component.
 */
export class Button extends Component<ButtonProps> {
    constructor(props: ButtonProps) {
        const buttonStyle: Partial<CSSStyleDeclaration> = {
            backgroundColor: '#7289da',
            color: '#ffffff',
            border: 'none',
            padding: '10px 18px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '600',
            transition: 'background-color 0.2s ease',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
        };

        const finalProps = {
            ...props,
            style: { ...buttonStyle, ...props.style },
        };

        super('button', finalProps);

        if (props.text) {
            this.element.textContent = props.text;
        }

        if (props.title) {
            this.element.title = props.title;
        }

        if (props.onClick) {
            DOM.on(this.element, 'click', (ev) => {
                ev.stopPropagation();
                props.onClick!(ev);
            });
        }
    }
}