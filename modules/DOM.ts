/**
 * # DOM - Advanced Low-Level DOM Manipulation Utility
 * Provides a comprehensive set of tools for creating, querying, modifying, and interacting with DOM elements.
 * This module serves as the foundation for the higher-level UI module.
 */
export class DOM {

    /**
     * Creates an HTML element with specified options.
     * @param tagName The tag name of the element to create.
     * @param options A configuration object for the element's properties.
     * @returns The newly created HTMLElement.
     */
    public static create<K extends keyof HTMLElementTagNameMap>(
        tagName: K,
        options: {
            id?: string;
            className?: string | string[];
            text?: string;
            html?: string;
            style?: Partial<CSSStyleDeclaration>;
            attributes?: { [key: string]: string };
            dataset?: { [key: string]: string };
            children?: HTMLElement[];
            events?: { [K2 in keyof HTMLElementEventMap]?: (this: HTMLElement, ev: HTMLElementEventMap[K2]) => any };
            parent?: HTMLElement | string;
        } = {}
    ): HTMLElementTagNameMap[K] {
        const element = document.createElement(tagName);
        if (options.id) element.id = options.id;
        if (options.className) {
            const classes = (Array.isArray(options.className) ? options.className.join(' ') : options.className)
                .split(' ')
                .filter(Boolean);
            if (classes.length > 0) {
                element.classList.add(...classes);
            }
        }
        if (options.text) element.textContent = options.text;
        if (options.html) element.innerHTML = options.html;
        if (options.style) this.setStyle(element, options.style);
        if (options.attributes) {
            for (const key in options.attributes) {
                element.setAttribute(key, options.attributes[key]);
            }
        }
        if (options.dataset) {
            for (const key in options.dataset) {
                element.dataset[key] = options.dataset[key];
            }
        }
        if (options.children) {
            options.children.forEach(child => element.appendChild(child));
        }
        if (options.events) {
            for (const eventName in options.events) {
                this.on(element, eventName as keyof HTMLElementEventMap, options.events[eventName] as any);
            }
        }
        if (options.parent) {
            this.append(options.parent, element);
        }
        return element;
    }

    /**
     * Finds the first element matching a CSS selector.
     * @param selector The CSS selector to query.
     * @param parent The element to search within (defaults to document).
     * @returns The found element or null.
     */
    public static get<T extends HTMLElement>(selector: string, parent: Element | Document = document): T | null {
        return parent.querySelector<T>(selector);
    }

    /**
     * Finds all elements matching a CSS selector.
     * @param selector The CSS selector to query.
     * @param parent The element to search within (defaults to document).\n     * @returns A NodeListOf found elements.
     */
    public static getAll<T extends HTMLElement>(selector: string, parent: Element | Document = document): NodeListOf<T> {
        return parent.querySelectorAll<T>(selector);
    }

    /**
     * Attaches an event listener to an element.
     * @param element The target element or a selector string.
     * @param event The event name to listen for.
     * @param handler The function to execute when the event occurs.
     * @returns A function to remove the event listener.
     */
    public static on<K extends keyof HTMLElementEventMap>(
        element: HTMLElement | string,
        event: K,
        handler: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
        options?: boolean | AddEventListenerOptions
    ): () => void {
        const targetElement = typeof element === 'string' ? this.get<HTMLElement>(element) : element;

        if (!targetElement) {
            console.warn(`mate.DOM.on: Element not found for selector or element provided: "${element}"`);
            return () => {};
        }

        targetElement.addEventListener(event, handler, options);

        return () => targetElement.removeEventListener(event, handler, options);
    }

    /**
     * Removes an element from the DOM.
     * @param element The element or selector for the element to remove.
     */
    public static remove(element: HTMLElement | string): void {
        const target = typeof element === 'string' ? this.get(element) : element;
        target?.parentNode?.removeChild(target);
    }

    /**
     * Adds or removes CSS classes from an element.
     * @param element The target element or selector.
     * @param classes The class name(s) to toggle.
     * @param force Optional boolean to force add or remove.
     */
    public static toggleClass(element: HTMLElement | string, classes: string | string[], force?: boolean): void {
        const target = typeof element === 'string' ? this.get(element) : element;
        const classArray = Array.isArray(classes) ? classes : [classes];
        classArray.forEach(cls => target?.classList.toggle(cls, force));
    }

    /**
     * Sets multiple CSS properties on an element.
     * @param element The target element or selector.
     * @param styles An object of CSS properties and values.
     */
    public static setStyle(element: HTMLElement | string, styles: Partial<CSSStyleDeclaration>): void {
        const target = typeof element === 'string' ? this.get(element) : element;
        if (target) {
            Object.assign(target.style, styles);
        }
    }

    /**
     * Gets a specific CSS property value from an element.
     * @param element The target element or selector.
     * @param propertyName The CSS property name.
     * @returns The value of the CSS property.
     */
    public static getStyle(element: HTMLElement | string, propertyName: keyof CSSStyleDeclaration): string {
        const target = typeof element === 'string' ? this.get(element) : element;
        return target ? window.getComputedStyle(target)[propertyName as any] : '';
    }

    /**
     * Finds the closest ancestor of an element that matches a selector.
     * @param element The starting element.
     * @param selector The selector to match.
     * @returns The matching ancestor element or null.
     */
    public static closest(element: HTMLElement, selector: string): HTMLElement | null {
        return element.closest(selector);
    }

    /**
     * Inserts an element as the first child of a parent.
     * @param parent The parent element or selector.
     * @param child The child element to prepend.
     */
    public static prepend(parent: HTMLElement | string, child: HTMLElement): void {
        const parentEl = typeof parent === 'string' ? this.get(parent) : parent;
        parentEl?.insertBefore(child, parentEl.firstChild);
    }

    /**
     * Inserts an element as the last child of a parent.
     * @param parent The parent element or selector.
     * @param child The child element to append.
     */
        public static append(parent: HTMLElement | string, child: Node): void {
        const parentEl = typeof parent === 'string' ? this.get(parent) : parent;
        parentEl?.appendChild(child);
    }

    /**
     * Gets or sets an attribute on an element.
     * @param element The target element or selector.
     * @param name The name of the attribute.
     * @param value Optional. The value to set the attribute to. If omitted, gets the attribute value.
     * @returns The attribute value if getting, or the DOM class for chaining if setting.
     */
    public static attr(element: HTMLElement | string, name: string, value?: string): string | DOM {
        const target = typeof element === 'string' ? this.get(element) : element;
        if (!target) {
            console.warn(`mate.DOM.attr: Element not found for selector or element provided: "${element}"`);
            return this;
        }
        if (value === undefined) {
            return target.getAttribute(name) || '';
        } else {
            target.setAttribute(name, value);
            return this;
        }
    }

    /**
     * Removes an attribute from an element.
     * @param element The target element or selector.
     * @param name The name of the attribute to remove.
     * @returns The DOM class for chaining.
     */
    public static removeAttr(element: HTMLElement | string, name: string): DOM {
        const target = typeof element === 'string' ? this.get(element) : element;
        if (target) {
            target.removeAttribute(name);
        }
        return this;
    }

    /**
     * Checks if an element has a specific attribute.
     * @param element The target element or selector.
     * @param name The name of the attribute.
     * @returns True if the element has the attribute, false otherwise.
     */
    public static hasAttr(element: HTMLElement | string, name: string): boolean {
        const target = typeof element === 'string' ? this.get(element) : element;
        return target ? target.hasAttribute(name) : false;
    }

    /**
     * Gets or sets the text content of an element.
     * @param element The target element or selector.
     * @param value Optional. The text content to set. If omitted, gets the text content.
     * @returns The text content if getting, or the DOM class for chaining if setting.
     */
    public static text(element: HTMLElement | string, value?: string): string | DOM {
        const target = typeof element === 'string' ? this.get(element) : element;
        if (!target) {
            console.warn(`mate.DOM.text: Element not found for selector or element provided: "${element}"`);
            return this;
        }
        if (value === undefined) {
            return target.textContent || '';
        } else {
            target.textContent = value;
            return this;
        }
    }

    /**
     * Gets or sets the HTML content of an element.
     * @param element The target element or selector.
     * @param value Optional. The HTML content to set. If omitted, gets the HTML content.
     * @returns The HTML content if getting, or the DOM class for chaining if setting.
     */
    public static html(element: HTMLElement | string, value?: string): string | DOM {
        const target = typeof element === 'string' ? this.get(element) : element;
        if (!target) {
            console.warn(`mate.DOM.html: Element not found for selector or element provided: "${element}"`);
            return this;
        }
        if (value === undefined) {
            return target.innerHTML;
        } else {
            target.innerHTML = value;
            return this;
        }
    }

    /**
     * Removes all child nodes from an element.
     * @param element The target element or selector.
     * @returns The DOM class for chaining.
     */
    public static empty(element: HTMLElement | string): DOM {
        const target = typeof element === 'string' ? this.get(element) : element;
        if (target) {
            while (target.firstChild) {
                target.removeChild(target.firstChild);
            }
        }
        return this;
    }

    /**
     * Finds the first descendant of an element that matches a CSS selector.
     * @param element The element to search within.
     * @param selector The CSS selector to query.
     * @returns The found element or null.
     */
    public static find<T extends HTMLElement>(element: HTMLElement | string, selector: string): T | null {
        const target = typeof element === 'string' ? this.get(element) : element;
        return target ? target.querySelector<T>(selector) : null;
    }

    /**
     * Finds all descendants of an element that match a CSS selector.
     * @param element The element to search within.
     * @param selector The CSS selector to query.
     * @returns An array of found elements.
     */
    public static findAll<T extends HTMLElement>(element: HTMLElement | string, selector: string): T[] {
        const target = typeof element === 'string' ? this.get(element) : element;
        return target ? Array.from(target.querySelectorAll<T>(selector)) : [];
    }

    /**
     * Gets the parent element of an element, optionally filtered by a selector.
     * @param element The target element or selector.
     * @param selector Optional. A CSS selector to filter the parent.
     * @returns The parent element or null.
     */
    public static parent(element: HTMLElement | string, selector?: string): HTMLElement | null {
        const target = typeof element === 'string' ? this.get(element) : element;
        if (!target) return null;
        const parentEl = target.parentElement;
        if (!parentEl) return null;
        return selector ? parentEl.closest(selector) : parentEl;
    }

    /**
     * Gets the direct children of an element, optionally filtered by a selector.
     * @param element The target element or selector.
     * @param selector Optional. A CSS selector to filter the children.
     * @returns An array of child elements.
     */
    public static children(element: HTMLElement | string, selector?: string): HTMLElement[] {
        const target = typeof element === 'string' ? this.get(element) : element;
        if (!target) return [];
        const children = Array.from(target.children) as HTMLElement[];
        return selector ? children.filter(child => child.matches(selector)) : children;
    }

    /**
     * Gets the next sibling of an element, optionally filtered by a selector.
     * @param element The target element or selector.
     * @param selector Optional. A CSS selector to filter the sibling.
     * @returns The next sibling element or null.
     */
    public static next(element: HTMLElement | string, selector?: string): HTMLElement | null {
        const target = typeof element === 'string' ? this.get(element) : element;
        if (!target) return null;
        let sibling: Element | null = target.nextElementSibling;
        while (sibling) {
            if (sibling instanceof HTMLElement && (!selector || sibling.matches(selector))) {
                return sibling;
            }
            sibling = sibling.nextElementSibling;
        }
        return null;
    }

    /**
     * Gets the previous sibling of an element, optionally filtered by a selector.
     * @param element The target element or selector.
     * @param selector Optional. A CSS selector to filter the sibling.
     * @returns The previous sibling element or null.
     */
    public static prev(element: HTMLElement | string, selector?: string): HTMLElement | null {
        const target = typeof element === 'string' ? this.get(element) : element;
        if (!target) return null;
        let sibling: Element | null = target.previousElementSibling;
        while (sibling) {
            if (sibling instanceof HTMLElement && (!selector || sibling.matches(selector))) {
                return sibling;
            }
            sibling = sibling.previousElementSibling;
        }
                return null;
    }

    /**
     * Gets all siblings of an element, optionally filtered by a selector.
     * @param element The target element or selector.
     * @param selector Optional. A CSS selector to filter the siblings.
     * @returns An array of sibling elements.
     */
    public static siblings(element: HTMLElement | string, selector?: string): HTMLElement[] {
        const target = typeof element === 'string' ? this.get(element) : element;
        if (!target || !target.parentElement) return [];
        const siblings = Array.from(target.parentElement.children).filter(child => child !== target) as HTMLElement[];
        return selector ? siblings.filter(sibling => sibling.matches(selector)) : siblings;
    }

    /**
     * Shows an element by setting its display style.
     * @param element The target element or selector.
     * @param displayValue The display value to set (e.g., 'block', 'flex', 'grid'). Defaults to 'block'.
     * @returns The DOM class for chaining.
     */
    public static show(element: HTMLElement | string, displayValue: string = 'block'): DOM {
        const target = typeof element === 'string' ? this.get(element) : element;
        if (target) {
            target.style.display = displayValue;
        }
        return this;
    }

    /**
     * Hides an element by setting its display style to 'none'.
     * @param element The target element or selector.
     * @returns The DOM class for chaining.
     */
    public static hide(element: HTMLElement | string): DOM {
        const target = typeof element === 'string' ? this.get(element) : element;
        if (target) {
            target.style.display = 'none';
        }
        return this;
    }

    /**
     * Checks if an element is currently visible.
     * @param element The target element or selector.
     * @returns True if the element is visible, false otherwise.
     */
    public static isVisible(element: HTMLElement | string): boolean {
        const target = typeof element === 'string' ? this.get(element) : element;
        if (!target) return false;
        return target.offsetWidth > 0 || target.offsetHeight > 0 || target.getClientRects().length > 0;
    }

    /**
     * Enables a form element by removing the 'disabled' attribute.
     * @param element The target form element or selector.
     * @returns The DOM class for chaining.
     */
    public static enable(element: HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement | string): DOM {
        const target = typeof element === 'string' ? this.get(element) : element;
        if (target instanceof HTMLInputElement || target instanceof HTMLButtonElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
            target.disabled = false;
        }
        return this;
    }

    /**
     * Disables a form element by setting the 'disabled' attribute.
     * @param element The target form element or selector.
     * @returns The DOM class for chaining.
     */
    public static disable(element: HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement | string): DOM {
        const target = typeof element === 'string' ? this.get(element) : element;
        if (target instanceof HTMLInputElement || target instanceof HTMLButtonElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
            target.disabled = true;
        }
        return this;
    }

    /**
     * Gets the computed width of an element.
     * @param element The target element or selector.
     * @param includePadding Whether to include padding in the calculation.
     * @param includeBorder Whether to include border in the calculation.
     * @param includeMargin Whether to include margin in the calculation.
     * @returns The computed width in pixels.
     */
    public static width(element: HTMLElement | string, includePadding: boolean = false, includeBorder: boolean = false, includeMargin: boolean = false): number {
        const target = typeof element === 'string' ? this.get(element) : element;
        if (!target) return 0;
        let width = target.offsetWidth;
        if (includePadding || includeBorder || includeMargin) {
            const style = window.getComputedStyle(target);
            if (!includePadding) {
                width -= parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
            }
            if (!includeBorder) {
                width -= parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
            }
            if (includeMargin) {
                width += parseFloat(style.marginLeft) + parseFloat(style.marginRight);
            }
        }
        return width;
    }

    /**
     * Gets the computed height of an element.
     * @param element The target element or selector.
     * @param includePadding Whether to include padding in the calculation.
     * @param includeBorder Whether to include border in the calculation.
     * @param includeMargin Whether to include margin in the calculation.
     * @returns The computed height in pixels.
     */
    public static height(element: HTMLElement | string, includePadding: boolean = false, includeBorder: boolean = false, includeMargin: boolean = false): number {
        const target = typeof element === 'string' ? this.get(element) : element;
        if (!target) return 0;
        let height = target.offsetHeight;
        if (includePadding || includeBorder || includeMargin) {
            const style = window.getComputedStyle(target);
            if (!includePadding) {
                height -= parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
            }
            if (!includeBorder) {
                height -= parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
            }
            if (includeMargin) {
                height += parseFloat(style.marginTop) + parseFloat(style.marginBottom);
            }
        }
        return height;
    }

    /**
     * Gets the position of an element relative to the document.
     * @param element The target element or selector.
     * @returns An object with top, left, width, and height properties.
     */
    public static offset(element: HTMLElement | string): { top: number; left: number; width: number; height: number } {
        const target = typeof element === 'string' ? this.get(element) : element;
        if (!target) return { top: 0, left: 0, width: 0, height: 0 };
        const rect = target.getBoundingClientRect();
        return {
            top: rect.top + window.scrollY,
            left: rect.left + window.scrollX,
            width: rect.width,
            height: rect.height
        };
    }

    /**
     * Gets the position of an element relative to its offset parent.
     * @param element The target element or selector.
     * @returns An object with top and left properties.
     */
    public static position(element: HTMLElement | string): { top: number; left: number } {
        const target = typeof element === 'string' ? this.get(element) : element;
        if (!target) return { top: 0, left: 0 };
        return {
            top: target.offsetTop,
            left: target.offsetLeft
        };
    }

    /**
     * Clones an element.
     * @param element The target element or selector.
     * @param deep Optional. True to clone all descendants, false otherwise. Defaults to true.
     * @returns The cloned element or null.
     */
    public static clone(element: HTMLElement | string, deep: boolean = true): HTMLElement | null {
        const target = typeof element === 'string' ? this.get(element) : element;
        return target ? target.cloneNode(deep) as HTMLElement : null;
    }

    /**
     * Sets focus on an element.
     * @param element The target element or selector.
     * @returns The DOM class for chaining.
     */
    public static focus(element: HTMLElement | string): DOM {
        const target = typeof element === 'string' ? this.get(element) : element;
        if (target instanceof HTMLElement) {
            target.focus();
        }
        return this;
    }

    /**
     * Scrolls the element into the visible area of the browser window.
     * @param element The target element or selector.
     * @param options Optional. An object that configures the scrolling behavior.
     * @returns The DOM class for chaining.
     */
    public static scrollIntoView(element: HTMLElement | string, options?: ScrollIntoViewOptions): DOM {
        const target = typeof element === 'string' ? this.get(element) : element;
        if (target) {
            target.scrollIntoView(options);
        }
        return this;
    }

    /**
     * Creates a DocumentFragment from an array of HTMLElements.
     * Useful for efficient appending of multiple elements to the DOM.
     * @param elements The elements to include in the fragment.
     * @returns A DocumentFragment containing the elements.
     */
    public static createFragment(...elements: HTMLElement[]): DocumentFragment {
        const fragment = document.createDocumentFragment();
        elements.forEach(el => fragment.appendChild(el));
        return fragment;
    }

    /**
     * Performs multiple DOM operations within a single requestAnimationFrame callback
     * to optimize performance and minimize reflows/repaints.
     * @param callback The function containing DOM operations.
     * @returns A Promise that resolves when the batch operation is complete.
     */
    public static batch(callback: () => void): Promise<void> {
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                callback();
                resolve();
            });
        });
    }

    /**
     * Dispatches a custom event on an element.
     * @param element The target element or selector.
     * @param eventName The name of the custom event.
     * @param detail Optional. Data to pass with the event.
     * @returns The DOM class for chaining.
     */
    public static trigger(element: HTMLElement | string, eventName: string, detail?: any): DOM {
        const target = typeof element === 'string' ? this.get(element) : element;
        if (target) {
            const event = new CustomEvent(eventName, { detail, bubbles: true, cancelable: true });
            target.dispatchEvent(event);
        }
        return this;
    }

    /**
     * A simple string interpolation for basic templating.
     * Replaces {{key}} placeholders in a string with corresponding data values.
     * @param htmlString The HTML string with placeholders.
     * @param data The data object to populate the placeholders.
     * @returns The interpolated HTML string.
     */
    public static template(htmlString: string, data: { [key: string]: any }): string {
        return htmlString.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return data[key] !== undefined ? String(data[key]) : match;
        });
    }

    /**
     * Attaches an event listener to a parent element and delegates it to child elements matching a selector.
     * @param parent The parent element or selector to attach the listener to.
     * @param event The event name to listen for.
     * @param selector The CSS selector for the child elements to delegate to.
     * @param handler The function to execute when the event occurs on a matching child.
     * @param options Optional. Event listener options.
     * @returns A function to remove the delegated event listener.
     */
    public static delegate<K extends keyof HTMLElementEventMap>(
        parent: HTMLElement | string,
        event: K,
        selector: string,
        handler: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
        options?: boolean | AddEventListenerOptions
    ): () => void {
        const parentEl = typeof parent === 'string' ? this.get(parent) : parent;
        if (!parentEl) {
            console.warn(`mate.DOM.delegate: Parent element not found for selector or element provided: "${parent}"`);
            return () => {};
        }

        const delegatedHandler = function (this: HTMLElement, ev: HTMLElementEventMap[K]) {
            const target = ev.target as HTMLElement;
            if (target && target.closest(selector)) {
                handler.call(target, ev);
            }
        };

        parentEl.addEventListener(event, delegatedHandler as EventListener, options);

        return () => parentEl.removeEventListener(event, delegatedHandler as EventListener, options);
    }

    /**
     * Attaches a one-time event listener to an element.
     * @param element The target element or selector.
     * @param event The event name to listen for.
     * @param handler The function to execute when the event occurs.
     * @returns A function to remove the event listener (though it will remove itself after one execution).
     */
    public static once<K extends keyof HTMLElementEventMap>(
        element: HTMLElement | string,
        event: K,
        handler: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
        options?: boolean | AddEventListenerOptions
    ): () => void {
        const targetElement = typeof element === 'string' ? this.get(element) : element;
        if (!targetElement) {
            console.warn(`mate.DOM.once: Element not found for selector or element provided: "${element}"`);
            return () => {};
        }

        const wrappedHandler = (ev: HTMLElementEventMap[K]) => {
            handler.call(targetElement, ev);
            targetElement.removeEventListener(event, wrappedHandler as EventListener, options);
        };

        targetElement.addEventListener(event, wrappedHandler as EventListener, options);

        return () => targetElement.removeEventListener(event, wrappedHandler as EventListener, options);
    }
}