
import { Component } from './Component';
import { ComponentProps } from './types';
import { DOM } from '../DOM';

export interface DropAreaProps extends ComponentProps {
    onDrop: (e: DragEvent) => void;
}

export class DropArea extends Component<DropAreaProps> {
    private hintElement: HTMLElement;

    constructor(props: DropAreaProps) {
        super('div', { ...props, className: ['mate-drop-area', props.className].join(' ') });

        const defaultStyles: Partial<CSSStyleDeclaration> = {
            border: '2px dashed #666',
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
            background: '#333',
            transition: 'border-color 0.3s',
            width: '200px',
            height: '200px',
            margin: '32px',
            overflow: 'hidden',
        };

        DOM.setStyle(this.element, { ...defaultStyles, ...props.style });

        this.hintElement = DOM.create('span', {
            text: 'Drag & Drop File Here',
            parent: this.element,
            style: { color: '#aaa' }
        });

        DOM.on(this.element, 'dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            DOM.setStyle(this.element, { borderColor: '#00ccff' });
        });

        DOM.on(this.element, 'dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            DOM.setStyle(this.element, { borderColor: '#666' });
        });

        DOM.on(this.element, 'drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            DOM.setStyle(this.element, { borderColor: '#666' });
            props.onDrop(e as DragEvent);
        });
    }

    public showHint(show: boolean) {
        DOM.setStyle(this.hintElement, { display: show ? 'block' : 'none' });
    }
}
