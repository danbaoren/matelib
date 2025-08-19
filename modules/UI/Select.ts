
import { Component } from './Component';
import { ComponentProps } from './types';
import { DOM } from '../DOM';

/**
 * Represents a single option in a Select component.
 */
export interface SelectOption {
    /** The value of the option. */
    value: string;
    /** The text displayed for the option. */
    text: string;
}

/**
 * Props for the Select component.
 */
export interface SelectProps extends ComponentProps {
    /** The array of options to display in the dropdown. */
    options: SelectOption[];
    /** The initial selected value. */
    value?: string;
    /** The function to call when the selected value changes. */
    onChange?: (value: string) => void;
}

/**
 * A declarative Select (dropdown) component.
 */
export class Select extends Component<SelectProps> {
    public selectElement: HTMLSelectElement;

    constructor(props: SelectProps) {
        super('div', { ...props, children: [] }); // Pass empty children to super

        this.selectElement = DOM.create('select');

        props.options.forEach(opt => {
            const optionElement = DOM.create('option', {
                attributes: { value: opt.value },
                text: opt.text,
            });
            DOM.append(this.selectElement, optionElement);
        });

        DOM.append(this.element, this.selectElement);

        if (props.value) {
            this.setValue(props.value);
        }

        if (props.onChange) {
            DOM.on(this.selectElement, 'change', () => props.onChange!(this.selectElement.value));
        }

        DOM.on(this.element, 'click', (ev) => ev.stopPropagation());
    }

    /**
     * Gets the current value of the select.
     * @returns The current value.
     */
    public getValue = (): string => this.selectElement.value;

    /**
     * Sets the value of the select.
     * @param value The new value to set.
     */
    public setValue = (value: string): void => {
        this.selectElement.value = value;
    };
}
