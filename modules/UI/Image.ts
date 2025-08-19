
import { Component } from './Component';
import { ComponentProps } from './types';

export interface ImageProps extends ComponentProps {
    src: string;
    alt?: string;
}

export class Image extends Component<ImageProps> {
    constructor(props: ImageProps) {
        super('img', { ...props, className: ['mate-image', props.className].join(' ') });
        (this.element as HTMLImageElement).src = props.src;
        if (props.alt) {
            (this.element as HTMLImageElement).alt = props.alt;
        }
    }
}
