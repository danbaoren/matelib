
import { Component } from './Component';
import { ComponentProps } from './types';

/**
 * Props for the Panel component.
 */
export interface PanelProps extends ComponentProps {}

/**
 * A simple panel component, which is a styled container.
 */
export class Panel extends Component<PanelProps> {
    constructor(props: PanelProps) {
        const panelStyle: Partial<CSSStyleDeclaration> = {
            backgroundColor: '#36393f',
            border: '1px solid #4a4e54',
            padding: '12px',
            borderRadius: '4px',
        };

        const finalProps = {
            ...props,
            style: { ...panelStyle, ...props.style },
        };

        super('div', finalProps);
    }
}
