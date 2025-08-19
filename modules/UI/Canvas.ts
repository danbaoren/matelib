
import { Component } from './Component';
import { ComponentProps } from './types';

export interface CanvasProps extends ComponentProps {
    width?: number;
    height?: number;
}

export class Canvas extends Component<CanvasProps> {
    public canvasElement: HTMLCanvasElement;

    constructor(props: CanvasProps) {
        super('canvas', { ...props, className: ['mate-canvas', props.className].join(' ') });
        this.canvasElement = this.element as HTMLCanvasElement;
        if (props.width) {
            this.canvasElement.width = props.width;
        }
        if (props.height) {
            this.canvasElement.height = props.height;
        }
    }
}
