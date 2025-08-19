import { DOM } from '../DOM';
import { ComponentProps, Renderable } from './types';

/**
 * A base class for creating UI components in a declarative style.
 * It handles element creation, styling, and appending to a parent.
 */
export class Component<P extends ComponentProps = ComponentProps> {
    public element: HTMLElement;
    public props: P;
    private _onMountCallbacks: (() => void)[] = [];
    private _onDestroyCallbacks: (() => void)[] = [];

    constructor(tag: keyof HTMLElementTagNameMap, props: P) {
        this.props = props;
        this.element = DOM.create(tag, {
            className: props.className,
            style: props.style,
        });

        if (props.children) {
            this.renderChildren(props.children);
        }

        if (props.parent) {
            DOM.append(props.parent, this.element);
        }
    }

    /**
     * Appends child components or elements to this component's root element.
     * @param children An array of renderable children.
     */
    private renderChildren(children: Renderable[]): void {
        for (const child of children) {
            const childElement = child instanceof HTMLElement ? child : child.element;
            DOM.append(this.element, childElement);
        }
    }

    public _addMountCallback(callback: () => void) {
        this._onMountCallbacks.push(callback);
    }

    public _addDestroyCallback(callback: () => void) {
        this._onDestroyCallbacks.push(callback);
    }

    public mount(): void {
        this._onMountCallbacks.forEach(cb => cb());
    }

    /**
     * Removes the component's element from the DOM and calls destroy callbacks.
     */
    public destroy(): void {
        this._onDestroyCallbacks.forEach(cb => cb());
        DOM.remove(this.element);
    }
}