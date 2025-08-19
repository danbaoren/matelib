import { Component } from './Component';
import { DOM } from '../DOM';
import { Renderable } from './types';
import { setCurrentComponent } from './Effect';
import { State } from './State';

/**
 * Renders a reactive component or a tree of components into a parent element.
 * The render function will be re-invoked when any state it depends on changes.
 * @param renderFn A function that returns the component to render.
 * @param parent The DOM element to render the component into.
 */
export function render(renderFn: () => Renderable, parent: HTMLElement): void {
    let currentComponent: Component | null = null;
    let unsubscribe: (() => void) | null = null;

    function reRender() {
        if (currentComponent) {
            currentComponent.destroy();
        }

        setCurrentComponent(null);
        const newComponent = renderFn();

        if (newComponent instanceof Component) {
            currentComponent = newComponent;
            setCurrentComponent(newComponent);

            DOM.append(parent, newComponent.element);
            newComponent.mount();

            // This is a simplified reactivity model. A real implementation would
            // track dependencies more granularly.
            if ((newComponent.props as any).state) {
                const state: State<any> = (newComponent.props as any).state;
                if (unsubscribe) {
                    unsubscribe();
                }
                unsubscribe = state.subscribe(reRender);
            }
        } else if (newComponent instanceof HTMLElement) {
            DOM.append(parent, newComponent);
        } else if (typeof newComponent === 'string') {
            DOM.append(parent, document.createTextNode(newComponent));
        }

        setCurrentComponent(null);
    }

    reRender();
}