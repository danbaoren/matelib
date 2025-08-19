
import { Component } from './Component';
import { ComponentProps } from './types';

/**
 * Props for the Container component.
 */
export interface ContainerProps extends ComponentProps {}

/**
 * A simple container component (div).
 */
export class Container extends Component<ContainerProps> {
    constructor(props: ContainerProps) {
        super('div', props);
    }
}
