
import { Component } from './Component';
import { ComponentProps } from './types';

/**
 * Props for the Header component.
 */
export interface HeaderProps extends ComponentProps {
    /** The text content of the header. */
    text?: string;
    /** The heading level (1-6). */
    level?: 1 | 2 | 3 | 4 | 5 | 6;
}

/**
 * A declarative Header component (h1, h2, etc.).
 */
export class Header extends Component<HeaderProps> {
    constructor(props: HeaderProps) {
        const headerStyle: Partial<CSSStyleDeclaration> = {
            color: '#ffffff',
            fontWeight: '600',
            margin: '0',
            padding: '0',
        };

        const finalProps = {
            ...props,
            style: { ...headerStyle, ...props.style },
        };

        super(`h${props.level || 1}`, finalProps);

        if (props.text) {
            this.element.textContent = props.text;
        }
    }
}
