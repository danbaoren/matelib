import * as RE from 'rogue-engine';
import { Logger } from '../../modules/Logger';
import * as MATE from '../../mate';

@RE.registerComponent
export default class injector extends RE.Component {

    static isEditorComponent = true;

    private menuElement: HTMLDivElement | null = null;
    private contentArea: HTMLDivElement | null = null;
    private buttons: { label: string; onClick: () => void }[] = [];

    private isDragging = false;
    private offsetX = 0;
    private offsetY = 0;

    awake() {
       // this.defineButtons();
       // this.createCustomMenu();
    }

    onAfterUnload() {
        if (this.menuElement) {
            // Simply re-define the button actions and update the UI
            this.defineButtons();
            this.updateButtons();
        } else {
            this.defineButtons();
            this.createCustomMenu();
        }
    }

    private defineButtons() {
        // This is a single, centralized list of buttons.
        // Changing the logic here automatically updates the UI.
        this.buttons = [
            { label: "Download RE.App", onClick: () => this.doSomething() },
            { label: "Log Editor State", onClick: () => this.logEditorState() },
            { label: "Perform Another Action", onClick: () => this.anotherCustomMethod() },
        ];
    }
    
    private createCustomMenu(x: string = '5vw', y: string = '5vh') {
        if (RE.Runtime.isRunning) { return; }

        this.injectStyles();

        const menu = document.createElement('div');
        this.menuElement = menu;
        menu.id = 'injector-custom-ui-menu';

        Object.assign(menu.style, {
            position: 'absolute', top: y, left: x, width: '320px',
            backgroundColor: 'rgba(30, 30, 30, 0.85)',
            border: '1px solid #666', borderRadius: '10px',
            boxShadow: '0 8px 16px rgba(0, 0, 0, 0.3)',
            zIndex: '1001', display: 'flex', flexDirection: 'column',
            fontFamily: 'Inter, sans-serif', color: '#EAEAEA',
        });

        const menuHeader = document.createElement('div');
        Object.assign(menuHeader.style, {
            padding: '10px 15px', backgroundColor: '#3a3a3a',
            cursor: 'grab', display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', borderTopLeftRadius: '10px', borderTopRightRadius: '10px',
        });

        const titleSpan = document.createElement('span');
        titleSpan.textContent = "Injector Control Panel";
        titleSpan.style.fontWeight = 'bold';

        const actionButtonsContainer = document.createElement('div');
        Object.assign(actionButtonsContainer.style, { display: 'flex', gap: '5px' });

        const refreshButton = document.createElement('button');
        refreshButton.textContent = "⟳";
        refreshButton.title = 'Refresh Buttons';
        Object.assign(refreshButton.style, {
            background: 'none', border: 'none', fontSize: '18px',
            cursor: 'pointer', color: '#EAEAEA', lineHeight: '1', padding: '0',
        });
        refreshButton.onclick = () => {
            this.defineButtons();
            this.updateButtons();
        };

        const closeButton = document.createElement('button');
        closeButton.textContent = "✕";
        closeButton.title = 'Close Panel';
        Object.assign(closeButton.style, {
            background: 'none', border: 'none', fontSize: '18px',
            cursor: 'pointer', color: '#EAEAEA', lineHeight: '1', padding: '0',
        });
        closeButton.onclick = () => this.closeMenu();

        actionButtonsContainer.appendChild(refreshButton);
        actionButtonsContainer.appendChild(closeButton);

        menuHeader.appendChild(titleSpan);
        menuHeader.appendChild(actionButtonsContainer);
        menu.appendChild(menuHeader);

        this.contentArea = document.createElement('div');
        Object.assign(this.contentArea.style, {
            padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px',
        });
        menu.appendChild(this.contentArea);

        // Initial creation of buttons
        this.buttons.forEach(buttonInfo => {
            if (this.contentArea) {
                this.contentArea.appendChild(this.createButton(buttonInfo.label, buttonInfo.onClick));
            }
        });

        document.body.appendChild(menu);

        menuHeader.onmousedown = (e) => this.onMouseDown(e);
        document.addEventListener('mouseup', () => this.onMouseUp());
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
    }

    private updateButtons() {
        if (!this.contentArea) return;
        const buttonElements = Array.from(this.contentArea.children) as HTMLButtonElement[];
        if (buttonElements.length !== this.buttons.length) {
            // Fallback: if button count has changed, fully recreate
            this.contentArea.innerHTML = '';
            this.buttons.forEach(buttonInfo => {
                this.contentArea?.appendChild(this.createButton(buttonInfo.label, buttonInfo.onClick));
            });
            return;
        }
        
        buttonElements.forEach((buttonElement, index) => {
            const newHandler = this.buttons[index].onClick;
            buttonElement.onclick = newHandler;
            buttonElement.textContent = this.buttons[index].label; // Also update label if needed
        });
    }

    private createButton(label: string, onClick: () => void): HTMLButtonElement {
        const button = document.createElement('button');
        button.textContent = label;
        button.onclick = onClick;
        Object.assign(button.style, {
            padding: '10px 15px', border: '1px solid #555',
            backgroundColor: '#4a4a4a', borderRadius: '6px',
            color: '#EAEAEA', cursor: 'pointer',
            transition: 'background-color 0.2s, transform 0.1s',
        });
        button.onmouseenter = () => button.style.backgroundColor = '#5a5a5a';
        button.onmouseleave = () => button.style.backgroundColor = '#4a4a4a';
        button.onmousedown = () => button.style.transform = 'scale(0.98)';
        button.onmouseup = () => button.style.transform = 'scale(1)';
        return button;
    }

    // ... (Dragging and other utility methods as before) ...
    private onMouseDown(e: MouseEvent) {
        if (this.menuElement) {
            this.isDragging = true;
            const header = this.menuElement.querySelector('div');
            if (header) header.style.cursor = 'grabbing';
            this.offsetX = e.clientX - this.menuElement.getBoundingClientRect().left;
            this.offsetY = e.clientY - this.menuElement.getBoundingClientRect().top;
        }
    }

    private onMouseUp() {
        this.isDragging = false;
        if (this.menuElement) {
            const header = this.menuElement.querySelector('div');
            if (header) header.style.cursor = 'grab';
        }
    }

    private onMouseMove(e: MouseEvent) {
        if (!this.isDragging || !this.menuElement) return;
        let newX = e.clientX - this.offsetX;
        let newY = e.clientY - this.offsetY;
        this.menuElement.style.left = `${newX}px`;
        this.menuElement.style.top = `${newY}px`;
    }

    private closeMenu() {
        if (this.menuElement) {
            this.menuElement.remove();
            this.menuElement = null;
        }
    }

    private injectStyles() {
        const styleId = 'injector-custom-ui-styles';
        if (document.getElementById(styleId)) return;
        const style = document.createElement('style');
        style.id = styleId;
        document.head.appendChild(style);
    }
    
    doSomething = () => {
        MATE.default.assets.download(RE.App, "re-app-class");
        Logger.log("doSomething called from custom UI button.");
    };

    logEditorState = () => {
        Logger.log("1");
    };

    anotherCustomMethod = () => {
        Logger.log("Executing 'anotherCustomMethod'...");
    };
}