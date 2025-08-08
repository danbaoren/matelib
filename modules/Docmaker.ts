/*
    Instruction Usage:

    1. Create a new text variable:
            public docs = "";

            public docs = "# Instructions: \n\n 1. tralalelo-tralala"


    2. **Important:** To avoid TypeScript errors, the string must be a single line and all special characters
       (like backticks, newlines, and quotes) must be escaped. The easiest way to do this is to write your
       documentation in a separate text editor and then use an online tool to convert it to a single-line,
       escaped string.

       A properly formatted documentation string will look like this:

            public docs = '# My Component\n\nThis is some documentation for my component.\nIt can include \`code\` snippets and other markdown features.\n';

    3. In your component file add Documentation button to open doc UI:

       // MyComponent.re.ts
       import * as RE from 'rogue-engine';
       import MATE from 'Assets/matelib/mate';

       @RE.registerComponent()
       export default class MyComponent extends RE.Component {
            publics docs = ""
           @RE.props.button() showDocs() { MATE.docmaker.open(docs); }
           showDocsLabel = "📖 Documentation"
       }
*/

class DocmakerUIManager {
    private docContainer: HTMLDivElement | null = null;
    private overlay: HTMLDivElement | null = null;
    private fileContent: string = "";
    private headerColor: string = "#ffffff";
    private isPreviewVisible: boolean = false; // Controls visibility of preview in editor

    public async createDocUI(content: string, headerColor: string) {
        this.fileContent = content;
        this.headerColor = headerColor;
        if (this.docContainer) {
            console.warn("Doc UI already exists.");
            return;
        }

        this.injectStyles();

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
        document.body.appendChild(overlay);

        // Start in viewer mode
        this.createViewerUI(content);

        setTimeout(() => {
            overlay.style.opacity = '1';
            if (this.docContainer) this.docContainer.style.transform = 'scale(1)';
        }, 10);

        document.addEventListener('keydown', this.handleKeyDown);
    }

    private switchMode(mode: 'viewer' | 'editor', content: string) {
        if (this.docContainer) {
            this.docContainer.remove();
            this.docContainer = null;
        }

        if (mode === 'viewer') {
            this.createViewerUI(content);
        } else {
            this.createEditorUI(content);
        }
    }

    private createViewerUI(content: string) {
        if (!this.overlay) return;

        const viewerContainer = document.createElement('div');
        this.docContainer = viewerContainer;
        viewerContainer.id = 'rogue-doc-viewer';
        viewerContainer.setAttribute('role', 'dialog');
        viewerContainer.setAttribute('aria-modal', 'true');
        viewerContainer.setAttribute('aria-labelledby', 'rogue-doc-title');

        Object.assign(viewerContainer.style, {
            position: 'relative',
            width: '80vw',
            maxWidth: '1200px',
            height: '80vh',
            maxHeight: '800px',
            backgroundColor: '#20232a',
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
        title.textContent = "Documentation Viewer";
        title.id = 'rogue-doc-title';
        Object.assign(title.style, {
            fontWeight: '700',
            fontSize: '20px',
            color: '#e2e2e2',
        });

        const headerActions = document.createElement('div');
        Object.assign(headerActions.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
        });

        const openEditorButton = this.createActionButton('📝 Open Editor', 'Open Editor Mode', () => this.switchMode('editor', this.fileContent));
        Object.assign(openEditorButton.style, {
            backgroundColor: '#3b82f6',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: '8px',
            fontWeight: 'bold',
        });
        openEditorButton.onmouseover = () => { openEditorButton.style.backgroundColor = '#2563eb'; };
        openEditorButton.onmouseout = () => { openEditorButton.style.backgroundColor = '#3b82f6'; };
        headerActions.appendChild(openEditorButton);

        const closeButton = this.createActionButton('✕', 'Close Documentation (Esc)', () => this.closeUI());
        headerActions.appendChild(closeButton);

        header.appendChild(title);
        header.appendChild(headerActions);
        viewerContainer.appendChild(header);

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
        viewerContainer.appendChild(contentArea);

        this.overlay.appendChild(viewerContainer);

        contentArea.innerHTML = this.markdownToHtml(content, this.headerColor);
    }

    private createEditorUI(content: string) {
        if (!this.overlay) return;

        const editorContainer = document.createElement('div');
        this.docContainer = editorContainer;
        editorContainer.id = 'rogue-doc-editor';
        editorContainer.setAttribute('role', 'dialog');
        editorContainer.setAttribute('aria-modal', 'true');
        editorContainer.setAttribute('aria-labelledby', 'rogue-editor-title');

        Object.assign(editorContainer.style, {
            position: 'relative',
            width: '80vw',
            maxWidth: '1200px',
            height: '80vh',
            maxHeight: '800px',
            backgroundColor: '#20232a',
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
        title.textContent = "Documentation Editor";
        title.id = 'rogue-editor-title';
        Object.assign(title.style, {
            fontWeight: '700',
            fontSize: '20px',
            color: '#e2e2e2',
        });

        const headerActions = document.createElement('div');
        Object.assign(headerActions.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
        });

        const closeButton = this.createActionButton('✕', 'Close Editor (Esc)', () => this.closeUI());
        headerActions.appendChild(closeButton);

        header.appendChild(title);
        header.appendChild(headerActions);
        editorContainer.appendChild(header);

        const contentArea = document.createElement('div');
        Object.assign(contentArea.style, {
            flexGrow: '1',
            display: 'grid',
            gridTemplateColumns: this.isPreviewVisible ? '1fr 1fr' : '1fr',
            gap: '16px',
            padding: '24px',
            background: 'linear-gradient(to bottom, #20232a, #1a1d22)',
            overflow: 'hidden',
        });
        editorContainer.appendChild(contentArea);

        const editorSection = document.createElement('div');
        Object.assign(editorSection.style, {
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
        });
        contentArea.appendChild(editorSection);

        // --- CUSTOM FORMATTERS SECTION ---
        const formattersContainer = document.createElement('div');
        Object.assign(formattersContainer.style, {
            display: 'flex',
            gap: '8px',
            marginBottom: '10px',
            flexWrap: 'wrap'
        });

        const textArea = document.createElement('textarea');
        Object.assign(textArea.style, {
            flexGrow: '1',
            width: '100%',
            height: '100%',
            border: '1px solid #3c424a',
            borderRadius: '8px',
            backgroundColor: '#282c34',
            color: '#e2e2e2',
            padding: '16px',
            fontSize: '16px',
            lineHeight: '1.5',
            fontFamily: 'monospace',
            boxSizing: 'border-box',
            resize: 'none',
        });
        textArea.value = this.unescapeString(content);

        const createFormatterButton = (text: string, markdown: string, previewText: string, previewStyle: Partial<CSSStyleDeclaration> = {}) => {
            const button = document.createElement('button');
            button.textContent = text;
            Object.assign(button.style, {
                padding: '6px 12px',
                fontSize: '14px',
                backgroundColor: '#3c424a',
                color: '#fff',
                border: '1px solid #5a5f6e',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                position: 'relative'
            });
            button.onmouseover = () => { button.style.backgroundColor = '#5a5f6e'; };
            button.onmouseout = () => { button.style.backgroundColor = '#3c424a'; };

            // Tooltip preview
            const tooltip = document.createElement('div');
            tooltip.className = 'markdown-tooltip';
            tooltip.textContent = previewText;
            Object.assign(tooltip.style, {
                position: 'absolute',
                bottom: 'calc(100% + 8px)',
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '8px 12px',
                backgroundColor: '#282c34',
                border: '1px solid #5a5f6e',
                borderRadius: '6px',
                color: '#fff',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                opacity: '0',
                transition: 'opacity 0.2s',
                zIndex: '10',
                ...previewStyle,
            });
            
            button.addEventListener('mouseover', () => { tooltip.style.opacity = '1'; });
            button.addEventListener('mouseout', () => { tooltip.style.opacity = '0'; });
            button.appendChild(tooltip);

            button.onclick = () => {
                this.insertAtCursor(textArea, markdown);
                this.fileContent = textArea.value; // Update fileContent
                previewSection.innerHTML = this.markdownToHtml(textArea.value, this.headerColor);
                textArea.focus();
            };

            return button;
        };
        
        formattersContainer.appendChild(createFormatterButton('H1', '# ', 'Heading 1', { fontSize: '1.5em', fontWeight: 'bold' }));
        formattersContainer.appendChild(createFormatterButton('H2', '## ', 'Heading 2', { fontSize: '1.2em', fontWeight: 'bold' }));
        formattersContainer.appendChild(createFormatterButton('H3', '### ', 'Heading 3', { fontSize: '1em', fontWeight: 'bold' }));
        formattersContainer.appendChild(createFormatterButton('**Bold**', '**Bold Text**', 'Bold Text', { fontWeight: 'bold' }));
        formattersContainer.appendChild(createFormatterButton('*Italic*', '*Italic Text*', 'Italic Text', { fontStyle: 'italic' }));
        formattersContainer.appendChild(createFormatterButton('`Code`', '`Code`', 'Code', { backgroundColor: '#3b3f46', fontFamily: 'monospace', color: '#ffeb95' }));
        formattersContainer.appendChild(createFormatterButton('```Block```', '```\nCode Block\n```', 'Code Block', { backgroundColor: '#3b3f46', fontFamily: 'monospace', color: '#ffeb95' }));
        editorSection.appendChild(formattersContainer);
        // --- END CUSTOM FORMATTERS SECTION ---

        editorSection.appendChild(textArea);

        const previewSection = document.createElement('div');
        Object.assign(previewSection.style, {
            flexGrow: '1',
            overflowY: 'auto',
            padding: '16px',
            border: '1px solid #3c424a',
            borderRadius: '8px',
            backgroundColor: '#282c34',
            display: this.isPreviewVisible ? 'block' : 'none',
        });
        previewSection.innerHTML = this.markdownToHtml(textArea.value, this.headerColor);
        contentArea.appendChild(previewSection);

        textArea.addEventListener('input', () => {
            previewSection.innerHTML = this.markdownToHtml(textArea.value, this.headerColor);
            this.fileContent = textArea.value; // Update fileContent on input
        });

        const buttonContainer = document.createElement('div');
        Object.assign(buttonContainer.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '16px',
            width: '100%',
        });
        editorSection.appendChild(buttonContainer);

        const leftButtons = document.createElement('div');
        Object.assign(leftButtons.style, {
            display: 'flex',
            gap: '10px'
        });

        const rightButtons = document.createElement('div');
        Object.assign(rightButtons.style, {
            display: 'flex',
            gap: '10px'
        });

        const newButton = this.createStyledButton('New', '#6b7280', () => {
            textArea.value = '';
            previewSection.innerHTML = '';
            this.fileContent = ''; // Clear fileContent
        });

        const previewButton = this.createStyledButton(this.isPreviewVisible ? 'Hide Preview' : 'Preview', '#3b82f6', () => {
            this.isPreviewVisible = !this.isPreviewVisible;
            contentArea.style.gridTemplateColumns = this.isPreviewVisible ? '1fr 1fr' : '1fr';
            previewSection.style.display = this.isPreviewVisible ? 'block' : 'none';
            previewButton.textContent = this.isPreviewVisible ? 'Hide Preview' : 'Preview';
        });

        const copyDocsButton = this.createStyledButton('Copy Docs', '#3b82f6', () => {
            this.copyContentToClipboard(textArea.value, 'docsOnly');
        });

        const copyBoilerplateButton = this.createStyledButton('Copy Boilerplate', '#10b981', () => {
            this.copyContentToClipboard(textArea.value, 'boilerplate');
        });

        leftButtons.appendChild(newButton);
        leftButtons.appendChild(previewButton);
        rightButtons.appendChild(copyDocsButton);
        rightButtons.appendChild(copyBoilerplateButton);

        buttonContainer.appendChild(leftButtons);
        buttonContainer.appendChild(rightButtons);

        this.overlay.appendChild(editorContainer);
    }

    private insertAtCursor(textarea: HTMLTextAreaElement, markdown: string) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;

        if (start === undefined || end === undefined) {
            textarea.value += markdown;
            return;
        }
        
        let newText;
        if (start === end) {
            newText = value.substring(0, start) + markdown + value.substring(end);
        } else {
            const selection = value.substring(start, end);
            const placeholderRegex = /(#+ )|(\* )|(- )|(`)|(\*\*)/g; // Common Markdown syntax
            const placeholderText = markdown.replace(placeholderRegex, '');
            newText = value.substring(0, start) + markdown.replace(placeholderText, selection) + value.substring(end);
        }
        
        textarea.value = newText;
        textarea.focus();
        textarea.setSelectionRange(start + markdown.length, start + markdown.length);
    }

    private createStyledButton(text: string, color: string, onClick: () => void): HTMLButtonElement {
        const button = document.createElement('button');
        button.textContent = text;
        Object.assign(button.style, {
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#fff',
            backgroundColor: color,
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'background-color 0.2s ease',
        });
        button.onmouseover = () => { button.style.backgroundColor = this.darkenColor(color, 20); };
        button.onmouseout = () => { button.style.backgroundColor = color; };
        button.onclick = onClick;
        return button;
    }

    private darkenColor(hex: string, percent: number): string {
        let r = parseInt(hex.slice(1, 3), 16);
        let g = parseInt(hex.slice(3, 5), 16);
        let b = parseInt(hex.slice(5, 7), 16);
        r = Math.max(0, r - (r * percent) / 100);
        g = Math.max(0, g - (g * percent) / 100);
        b = Math.max(0, b - (b * percent) / 100);
        const toHex = (c: number) => Math.round(c).toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    private createActionButton(text: string, title: string, onClick: () => void): HTMLButtonElement {
        const button = document.createElement('button');
        button.textContent = text;
        button.title = title;
        Object.assign(button.style, {
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: '#9ba4b5',
            lineHeight: '1',
            padding: '4px',
            transition: 'color 0.2s ease, transform 0.2s ease',
        });
        button.onmouseover = () => {
            button.style.color = '#fff';
            button.style.transform = 'scale(1.1)';
        };
        button.onmouseout = () => {
            button.style.color = '#9ba4b5';
            button.style.transform = 'scale(1)';
        };
        button.onclick = onClick;
        return button;
    }

    private copyContentToClipboard(content: string, copyMode: 'docsOnly' | 'boilerplate') {
        let textToCopy = '';
        const escapedContent = this.escapeString(content);

        if (copyMode === 'boilerplate') {
            textToCopy = `public docs = '${escapedContent}';\n@RE.props.button() showDocs() { MATE.docmaker.open(this.docs); }\nshowDocsLabel = "📖 Documentation"`;
        } else {
            textToCopy = escapedContent;
        }

        navigator.clipboard.writeText(textToCopy).then(() => {
            console.log("Content copied to clipboard.");
            const alertText = copyMode === 'boilerplate' ? 'Boilerplate copied! ✅' : 'Docs copied! ✅';
            const alert = document.createElement('div');
            alert.textContent = alertText;
            Object.assign(alert.style, {
                position: 'absolute',
                bottom: '20px',
                right: '20px',
                padding: '10px 20px',
                backgroundColor: '#4caf50',
                color: 'white',
                borderRadius: '8px',
                zIndex: '1002',
                opacity: '0',
                transition: 'opacity 0.5s ease',
            });
            if (this.docContainer) this.docContainer.appendChild(alert);

            setTimeout(() => { alert.style.opacity = '1'; }, 10);
            setTimeout(() => {
                alert.style.opacity = '0';
                setTimeout(() => alert.remove(), 500);
            }, 2000);
        }).catch(err => {
            console.error("Failed to copy content: ", err);
        });
    }

    private handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            this.closeUI();
        }
    };

    private markdownToHtml(markdown: string, headerColor: string): string {
        markdown = markdown.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        let html = '';
        const lines = markdown.split('\n');
        let inCodeBlock = false;
        let inList = false;
        let inParagraph = false;
        let listType = 'ul';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();

            if (trimmedLine.startsWith('```')) {
                if (inCodeBlock) {
                    html += '</code></pre>';
                    inCodeBlock = false;
                } else {
                    if (inList) { html += `</${listType}>`; inList = false; }
                    if (inParagraph) { html += '</p>'; inParagraph = false; }
                    html += `<pre style="background-color: #282c34; padding: 16px; border-radius: 8px; overflow-x: auto; color: #abb2bf; font-family: monospace; font-size: 14px; margin-bottom: 16px;"><code>`;
                    inCodeBlock = true;
                }
                continue;
            }

            if (inCodeBlock) {
                html += line.replace(/&lt;/g, '<').replace(/&gt;/g, '>') + '\n';
                continue;
            }

            if (trimmedLine === '---' || trimmedLine === '***') {
                if (inList) { html += `</${listType}>`; inList = false; }
                if (inParagraph) { html += '</p>'; inParagraph = false; }
                html += '<hr style="border: 0; height: 1px; background: #3c424a; margin: 24px 0;">';
                continue;
            }

            if (trimmedLine.startsWith('### ')) {
                if (inList) { html += `</${listType}>`; inList = false; }
                if (inParagraph) { html += '</p>'; inParagraph = false; }
                html += `<h3 style="margin: 24px 0 12px; color: ${headerColor}; font-weight: 600;">${this.inlineMarkdownToHtml(trimmedLine.substring(4))}</h3>`;
                continue;
            } else if (trimmedLine.startsWith('## ')) {
                if (inList) { html += `</${listType}>`; inList = false; }
                if (inParagraph) { html += '</p>'; inParagraph = false; }
                html += `<h2 style="margin: 30px 0 15px; color: ${headerColor}; border-bottom: 1px solid #3c424a; padding-bottom: 8px;">${this.inlineMarkdownToHtml(trimmedLine.substring(3))}</h2>`;
                continue;
            } else if (trimmedLine.startsWith('# ')) {
                if (inList) { html += `</${listType}>`; inList = false; }
                if (inParagraph) { html += '</p>'; inParagraph = false; }
                html += `<h1 style="margin: 36px 0 20px; color: ${headerColor};">${this.inlineMarkdownToHtml(trimmedLine.substring(2))}</h1>`;
                continue;
            }

            const listItemMatch = trimmedLine.match(/^(\s*)(-|\d+\.)\s+(.*)/);
            if (listItemMatch) {
                if (inParagraph) { html += '</p>'; inParagraph = false; }

                const currentListType = listItemMatch[2] === '-' ? 'ul' : 'ol';
                if (!inList || listType !== currentListType) {
                    if (inList) { html += `</${listType}>`; }
                    html += `<${currentListType} style="padding-left: 20px; margin: 10px 0;">`;
                    inList = true;
                    listType = currentListType;
                }

                const listItemContent = this.inlineMarkdownToHtml(listItemMatch[3]);
                html += `<li style="margin-bottom: 5px;">${listItemContent}</li>`;
                continue;
            } else if (inList) {
                html += `</${listType}>`;
                inList = false;
            }

            if (trimmedLine.startsWith('> ')) {
                if (inParagraph) { html += '</p>'; inParagraph = false; }
                html += `<blockquote style="border-left: 4px solid #5a5f6e; padding-left: 20px; margin: 20px 0; color: #a0a0a0; font-style: italic;">${this.inlineMarkdownToHtml(trimmedLine.substring(2))}</blockquote>`;
                continue;
            }

            if (trimmedLine === '') {
                if (inParagraph) {
                    html += '</p>';
                    inParagraph = false;
                }
            } else {
                if (!inParagraph) {
                    html += '<p style="margin: 0 0 16px;">';
                    inParagraph = true;
                }
                html += this.inlineMarkdownToHtml(trimmedLine);
                if (i < lines.length - 1 && lines[i + 1].trim() !== '') {
                    html += '<br>';
                }
            }
        }

        if (inList) { html += `</${listType}>`; }
        if (inParagraph) { html += '</p>'; }

        return html;
    }

    private inlineMarkdownToHtml(line: string): string {
        return line
            .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #e2e2e2;">$1</strong>')
            .replace(/\*(.*?)\*/g, '<em style="color: #dcdcdc;">$1</em>')
            .replace(/`(.*?)`/g, '<code style="background-color: #3b3f46; padding: 4px 8px; border-radius: 6px; font-family: monospace; font-size: 0.9em; color: #ffeb95;">$1</code>');
    }

    private escapeString(text: string): string {
        return text
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/`/g, '\\`')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '');
    }

    private unescapeString(text: string): string {
        return text
            .replace(/\\n/g, '\n')
            .replace(/\\'/g, "'")
            .replace(/\\`/g, '`')
            .replace(/\\\\/g, '\\');
    }

    private injectStyles() {
        const styleId = 'rogue-doc-viewer-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
            #rogue-doc-viewer::-webkit-scrollbar, #rogue-doc-editor::-webkit-scrollbar, textarea::-webkit-scrollbar, pre::-webkit-scrollbar { width: 12px; height: 12px; }
            #rogue-doc-viewer::-webkit-scrollbar-track, #rogue-doc-editor::-webkit-scrollbar-track, textarea::-webkit-scrollbar-track, pre::-webkit-scrollbar-track { background: #1a1d22; }
            #rogue-doc-viewer::-webkit-scrollbar-thumb, #rogue-doc-editor::-webkit-scrollbar-thumb, textarea::-webkit-scrollbar-thumb, pre::-webkit-scrollbar-thumb { background-color: #3b3f46; border-radius: 6px; border: 3px solid #1a1d22; }
            #rogue-doc-viewer::-webkit-scrollbar-thumb:hover, #rogue-doc-editor::-webkit-scrollbar-thumb:hover, textarea::-webkit-scrollbar-thumb:hover, pre::-webkit-scrollbar-thumb:hover { background-color: #5a5f6e; }
        `;
        document.head.appendChild(style);
    }

    public closeUI() {
        if (this.docContainer) {
            if (this.overlay) this.overlay.style.opacity = '0';
            this.docContainer.style.transform = 'scale(0.95)';
            this.docContainer.style.transition = 'transform 0.3s cubic-bezier(0.6, -0.28, 0.735, 0.045)';

            setTimeout(() => {
                this.overlay?.remove();
                this.docContainer = null;
                this.fileContent = "";
                this.overlay = null;
            }, 300);

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
            await this.uiManager.createDocUI(content.toString(), headerColor);
        } else {
            console.warn("Documentation is already open.");
        }
    }
}