/**
 * Represents a component that can be rendered in the UI.
 * It can be a class instance that has an `element` property, or a raw HTMLElement.
 */
export type Renderable = { element: HTMLElement } | HTMLElement;

/**
 * Base properties for all UI components.
 */
export interface ComponentProps {
    /** Optional CSS class name(s) to apply to the component's root element. */
    className?: string;
    /** Optional inline CSS styles to apply to the component's root element. */
    style?: Partial<CSSStyleDeclaration>;
    /** The parent element to which this component will be appended. */
    parent?: HTMLElement;
    /** The child components or elements to render inside this component. */
    children?: Renderable[];
}