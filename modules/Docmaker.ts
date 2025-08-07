/*

    Instruction Usage:

    1. Create a new TypeScript file for your documentation (e.g., `MyComponent.docs.ts`).

    2. In this file, export a const string named `docs` containing your documentation in Markdown format.

    3. **Important:** To avoid TypeScript errors, the string must be a single line and all special characters
       (like backticks, newlines, and quotes) must be escaped. The easiest way to do this is to write your
       documentation in a separate text editor and then use an online tool to convert it to a single-line,
       escaped string.

       A properly formatted documentation string will look like this:

       ```typescript
       // MyComponent.docs.ts
       export const docs = '# My Component\n\nThis is some documentation for my component.\nIt can include \`code\` snippets and other markdown features.\n';
       ```

    4. In your component file, import the `docs` variable and the `Docmaker` from MATE.

       ```typescript
       // MyComponent.re.ts
       import * as RE from 'rogue-engine';
       import MATE from 'Assets/matelib/mate';
       import { docs } from './MyComponent.docs';

       @RE.registerComponent()
       export default class MyComponent extends RE.Component {
           @RE.props.button() showDocs() { MATE.docmaker.open(docs); }
           showDocsLabel = "📖 Documentation"
       }
       ```
*/

class DocmakerUIManager {
    private docContainer: HTMLDivElement | null = null;
    private overlay: HTMLDivElement | null = null;

    public async createDocUI(content: string, headerColor: string) {
        if (this.docContainer) {
            console.warn("Doc UI already exists.");
            return;
        }

        this.injectStyles();

        // Create a semi-transparent overlay to block the background
        const overlay = document.createElement('div');
        this.overlay = overlay;
        Object.assign(overlay.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            zIndex: '1000',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            opacity: '0',
            transition: 'opacity 0.3s ease-in-out',
        });

        const docContainer = document.createElement('div');
        this.docContainer = docContainer;
        docContainer.id = 'rogue-doc-viewer';
        docContainer.setAttribute('role', 'dialog');
        docContainer.setAttribute('aria-modal', 'true');
        docContainer.setAttribute('aria-labelledby', 'rogue-doc-title');

        Object.assign(docContainer.style, {
            position: 'relative', // Positioned relative to the overlay
            width: '80vw',
            maxWidth: '1200px',
            height: '80vh',
            maxHeight: '800px',
            backgroundColor: '#20232a', // A deep, professional dark blue
            border: '1px solid #3c424a',
            borderRadius: '16px',
            boxShadow: '0 15px 35px rgba(0, 0, 0, 0.5)',
            zIndex: '1001',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            color: '#dcdcdc',
            resize: 'both',
            minWidth: '500px',
            minHeight: '300px',
            transform: 'scale(0.95)',
            transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        });

        const header = document.createElement('div');
        Object.assign(header.style, {
            padding: '16px 24px',
            backgroundColor: '#282c34',
            borderBottom: '1px solid #3c424a',
            cursor: 'grab',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
        });

        const title = document.createElement('span');
        title.textContent = "";
        title.id = 'rogue-doc-title';
        Object.assign(title.style, {
            fontWeight: '700',
            fontSize: '20px',
            color: '#e2e2e2',
        });

        const closeButton = document.createElement('button');
        closeButton.textContent = '✕';
        closeButton.title = 'Close Documentation (Esc)';
        Object.assign(closeButton.style, {
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: '#9ba4b5',
            lineHeight: '1',
            padding: '4px',
            transition: 'color 0.2s ease, transform 0.2s ease',
        });
        closeButton.onmouseover = () => {
            closeButton.style.color = '#fff';
            closeButton.style.transform = 'rotate(90deg)';
        };
        closeButton.onmouseout = () => {
            closeButton.style.color = '#9ba4b5';
            closeButton.style.transform = 'rotate(0deg)';
        };
        closeButton.onclick = () => this.closeDocUI();

        header.appendChild(title);
        header.appendChild(closeButton);
        docContainer.appendChild(header);

        const contentArea = document.createElement('div');
        Object.assign(contentArea.style, {
            flexGrow: '1',
            overflowY: 'auto',
            padding: '24px',
            lineHeight: '1.7',
            fontSize: '16px',
            background: 'linear-gradient(to bottom, #20232a, #1a1d22)',
            color: '#c0c0c0',
        });
        docContainer.appendChild(contentArea);

        overlay.appendChild(docContainer);
        document.body.appendChild(overlay);

        // Animate the appearance
        setTimeout(() => {
            overlay.style.opacity = '1';
            docContainer.style.transform = 'scale(1)';
        }, 10);
        
        contentArea.innerHTML = this.markdownToHtml(content, headerColor);
        
        // Add keyboard event listener for accessibility
        document.addEventListener('keydown', this.handleKeyDown);

        this.makeDraggable(docContainer, header);
    }
    
    private handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            this.closeDocUI();
        }
    };
    
    private makeDraggable(element: HTMLElement, handle: HTMLElement) {
        let isDragging = false;
        let offset = { x: 0, y: 0 };
        const overlay = this.overlay!;

        handle.addEventListener('mousedown', (e) => {
            isDragging = true;
            offset.x = e.clientX - element.getBoundingClientRect().left;
            offset.y = e.clientY - element.getBoundingClientRect().top;
            handle.style.cursor = 'grabbing';
            overlay.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const x = e.clientX - offset.x;
            const y = e.clientY - offset.y;
            element.style.left = `${x}px`;
            element.style.top = `${y}px`;
            element.style.transform = 'none';
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            handle.style.cursor = 'grab';
            overlay.style.cursor = 'default';
        });
    }

    private markdownToHtml(markdown: string, headerColor: string): string {
        let html = markdown
            .replace(/^### (.*$)/gim, `<h3 style="margin: 24px 0 12px; color: ${headerColor}; font-weight: 600;">$1</h3>`)
            .replace(/^## (.*$)/gim, `<h2 style="margin: 30px 0 15px; color: ${headerColor}; border-bottom: 1px solid #3c424a; padding-bottom: 8px;">$1</h2>`)
            .replace(/^# (.*$)/gim, `<h1 style="margin: 36px 0 20px; color: ${headerColor};">$1</h1>`)
            .replace(/^> (.*$)/gim, '<blockquote style="border-left: 4px solid #5a5f6e; padding-left: 20px; margin: 20px 0; color: #a0a0a0; font-style: italic;">$1</blockquote>')
            .replace(/\*\*(.*)\*\*/gim, '<strong style="color: #e2e2e2;">$1</strong>')
            .replace(/\*(.*)\*/gim, '<em style="color: #dcdcdc;">$1</em>')
            .replace(/`([^`]+)`/gim, '<code style="background-color: #3b3f46; padding: 4px 8px; border-radius: 6px; font-family: monospace; font-size: 0.9em; color: #ffeb95;">$1</code>')
            .replace(/\n\n/gim, '</p><p>')
            .replace(/\n/gim, '<br>');

        return `<p>${html}</p>`;
    }
    
    private injectStyles() {
        const styleId = 'rogue-doc-viewer-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
            #rogue-doc-viewer::-webkit-scrollbar { width: 12px; }
            #rogue-doc-viewer::-webkit-scrollbar-track { background: #1a1d22; }
            #rogue-doc-viewer::-webkit-scrollbar-thumb { background-color: #3b3f46; border-radius: 6px; border: 3px solid #1a1d22; }
            #rogue-doc-viewer::-webkit-scrollbar-thumb:hover { background-color: #5a5f6e; }
        `;
        document.head.appendChild(style);
    }

    public closeDocUI() {
        if (this.docContainer && this.overlay) {
            // Animate the closing
            this.overlay.style.opacity = '0';
            this.docContainer.style.transform = 'scale(0.95)';
            this.docContainer.style.transition = 'transform 0.3s cubic-bezier(0.6, -0.28, 0.735, 0.045)';

            setTimeout(() => {
                this.overlay?.remove();
                this.docContainer = null;
                this.overlay = null;
            }, 300); // Match this timeout with the transition duration
            
            document.removeEventListener('keydown', this.handleKeyDown);
        }
    }

    public isDocOpen(): boolean {
        return this.docContainer !== null;
    }
}

export default class Docmaker {
    private static uiManager = new DocmakerUIManager();

    public static async open(content: string, headerColor: string = "#ffffff") {
        if (!this.uiManager.isDocOpen()) {
            await this.uiManager.createDocUI(content, headerColor);
        } else {
            console.warn("Documentation is already open.");
        }
    }
}