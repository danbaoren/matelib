
import { Component } from './Component';
import { ComponentProps } from './types';
import { DOM } from '../DOM';

/**
 * Props for the Grid component.
 */
export interface GridProps extends ComponentProps {
    /** The number of columns in the grid. */
    columns?: number;
    /** The number of rows in the grid. */
    rows?: number;
    /** The gap between grid cells. */
    gap?: string;
    /** A template for grid areas. */
    templateAreas?: string[];
    /** Justify content property for the grid. */
    justifyContent?: 'start' | 'end' | 'center' | 'stretch' | 'space-around' | 'space-between' | 'space-evenly';
    /** Align items property for the grid. */
    alignItems?: 'start' | 'end' | 'center' | 'stretch';
}

/**
 * A declarative component for creating CSS grid layouts.
 */
export class Grid extends Component<GridProps> {
    constructor(props: GridProps) {
        // Define default grid styles
        const gridStyle: Partial<CSSStyleDeclaration> = {
            display: 'grid',
            gridTemplateColumns: props.columns ? `repeat(${props.columns}, 1fr)` : 'none',
            gridTemplateRows: props.rows ? `repeat(${props.rows}, 1fr)` : 'none',
            gap: props.gap || '0',
            gridTemplateAreas: props.templateAreas ? props.templateAreas.map(area => `'${area}'`).join(' ') : 'none',
            justifyContent: props.justifyContent || 'stretch',
            alignItems: props.alignItems || 'stretch',
        };

        // Merge with user-provided styles
        const finalProps = {
            ...props,
            style: { ...gridStyle, ...props.style },
        };

        super('div', finalProps);
    }

    /**
     * Updates the grid layout properties.
     * @param props The new grid properties to apply.
     */
    public setGrid(props: Partial<GridProps>): void {
        const newStyle: Partial<CSSStyleDeclaration> = {};
        if (props.columns) newStyle.gridTemplateColumns = `repeat(${props.columns}, 1fr)`;
        if (props.rows) newStyle.gridTemplateRows = `repeat(${props.rows}, 1fr)`;
        if (props.gap) newStyle.gap = props.gap;
        if (props.templateAreas) newStyle.gridTemplateAreas = props.templateAreas.map(area => `'${area}'`).join(' ');
        if (props.justifyContent) newStyle.justifyContent = props.justifyContent;
        if (props.alignItems) newStyle.alignItems = props.alignItems;

        DOM.setStyle(this.element, newStyle);
    }
}
