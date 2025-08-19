
import { Component } from './Component';
import { ComponentProps } from './types';
import { DOM } from '../DOM';

/**
 * Props for the Slider component.
 */
export interface SliderProps extends ComponentProps {
    /** The minimum value of the slider. */
    min?: number;
    /** The maximum value of the slider. */
    max?: number;
    /** The initial value of the slider. */
    value?: number;
    /** The step increment of the slider. */
    step?: number;
    /** The function to call when the slider value changes. */
    onChange?: (value: number) => void;
}

/**
 * A declarative Slider component.
 */
export class Slider extends Component<SliderProps> {
    public inputElement: HTMLInputElement;

    constructor(props: SliderProps) {
        super('div', { ...props, children: [] }); // Pass empty children to super

        this.inputElement = DOM.create('input', {
            parent: this.element,
            attributes: {
                type: 'range',
                min: String(props.min || 0),
                max: String(props.max || 100),
                value: String(props.value || 0),
                step: String(props.step || 1),
            },
        });

        if (props.onChange) {
            DOM.on(this.inputElement, 'input', () => props.onChange!(parseFloat(this.inputElement.value)));
        }

        DOM.on(this.element, 'click', (ev) => ev.stopPropagation());
    }

    /**
     * Gets the current value of the slider.
     * @returns The current value.
     */
    public getValue = (): number => parseFloat(this.inputElement.value);

    /**
     * Sets the value of the slider.
     * @param value The new value to set.
     */
    public setValue = (value: number): void => {
        this.inputElement.value = value.toString();
    };
}
