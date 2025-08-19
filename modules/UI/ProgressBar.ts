
import { Component } from './Component';
import { ComponentProps } from './types';
import { DOM } from '../DOM';

export interface ProgressBarProps extends ComponentProps {
    label?: string;
    progress?: number;
}

export class ProgressBar extends Component<ProgressBarProps> {
    private fillElement: HTMLElement;
    private labelElement: HTMLElement;

    constructor(props: ProgressBarProps) {
        super('div', { ...props, className: ['mate-progress-bar', props.className].join(' ') });

        this.fillElement = DOM.create('div', { className: 'mate-progress-bar-fill', parent: this.element });
        this.labelElement = DOM.create('span', { className: 'mate-progress-bar-label', parent: this.element, text: props.label || '0%' });

        if (props.progress) {
            this.setProgress(props.progress, props.label);
        } else {
            this.element.style.display = 'none';
        }
    }

    public setProgress(percentage: number, label?: string) {
        const clampedPercentage = Math.max(0, Math.min(100, percentage));
        this.fillElement.style.width = `${clampedPercentage}%`;
        const percentageText = `${Math.round(clampedPercentage)}%`;
        
        if (label) {
            this.labelElement.textContent = `${label} (${percentageText})`;
        } else {
            this.labelElement.textContent = percentageText;
        }
        this.show();
    }

    public setLabel(text: string) {
        this.labelElement.textContent = text;
    }

    public show() {
        this.element.style.display = 'block';
    }

    public hide() {
        this.element.style.display = 'none';
    }
}
