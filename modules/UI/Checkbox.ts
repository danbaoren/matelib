
import { Component } from './Component';
import { ComponentProps } from './types';
import { DOM } from '../DOM';

/**
 * Props for the Checkbox component.
 */
export interface CheckboxProps extends ComponentProps {
    /** The label text for the checkbox. */
    label?: string;
    /** The initial checked state of the checkbox. */
    checked?: boolean;
    /** The function to call when the checkbox state changes. */
    onChange?: (checked: boolean) => void;
}

/**
 * A declarative Checkbox component.
 */
export class Checkbox extends Component<CheckboxProps> {
    public inputElement: HTMLInputElement;
    private checkmarkElement: HTMLElement;
    private labelSpan: HTMLElement | null = null;

    constructor(props: CheckboxProps) {
        const checkboxStyle: Partial<CSSStyleDeclaration> = {
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            userSelect: 'none',
            gap: '8px',
        };

        const finalProps = {
            ...props,
            style: { ...checkboxStyle, ...props.style },
            children: [], // Children are handled manually
        };

        super('label', finalProps);

        this.inputElement = DOM.create('input', {
            attributes: { type: 'checkbox' },
            style: {
                position: 'absolute',
                opacity: '0',
                cursor: 'pointer',
                height: '0',
                width: '0',
            },
        });

        this.checkmarkElement = DOM.create('span', { className: 'mate-checkmark' });

        DOM.append(this.element, this.inputElement);
        DOM.append(this.element, this.checkmarkElement);

        if (props.label) {
            this.labelSpan = DOM.create('span', { text: props.label, className: 'mate-checkbox-label' });
            DOM.append(this.element, this.labelSpan);
        }

        this.setChecked(props.checked || false);

        if (props.onChange) {
            DOM.on(this.inputElement, 'change', () => props.onChange!(this.inputElement.checked));
        }

        DOM.on(this.element, 'click', (ev) => ev.stopPropagation());
    }

    /**
     * Gets the current checked state of the checkbox.
     * @returns The current checked state.
     */
    public getChecked = (): boolean => this.inputElement.checked;

    /**
     * Sets the checked state of the checkbox.
     * @param checked The new checked state.
     */
    public setChecked = (checked: boolean): void => {
        this.inputElement.checked = checked;
    };
}
