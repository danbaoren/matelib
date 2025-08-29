import * as RE from 'rogue-engine';
import { Window, TextInput, Button, Container, Checkbox, WindowProps } from '../../modules/UI';
import { rogueEditorAPI } from '../../modules/RogueEditorAPI';
import { DOM } from '../../modules/DOM';

declare global {
    interface Window {
        __MATE_TODOLIST_INITIALIZED__?: boolean;
    }
}

// The TodoList logic, encapsulated in its own class.
class TodoListManager {
    private todos: { [tab: string]: Todo[] } = { 'General': [] };
    private activeTab: string = 'General';
    private todoListContainer: Container;
    private tabsContainer: Container;
    private input: TextInput;
    private window: TodoWindow;
    private newTabInput: TextInput; // New property

    constructor() {
        this.initUI();
    }

    private async initUI() {
        this.tabsContainer = new Container({
            style: { display: 'flex', flexWrap: 'wrap', padding: '5px', borderBottom: '1px solid #555', flexGrow: '1' },
        });

        const addTabButton = new Button({
            text: 'Add Tab',
            onClick: () => this.addTab(),
            style: { padding: '5px 10px', margin: '5px', backgroundColor: '#4a4a4a', border: 'none', borderRadius: '3px', cursor: 'pointer' }
        });

        const deleteTabButton = new Button({
            text: 'Delete Tab',
            onClick: () => this.deleteTab(),
            style: { padding: '5px 10px', margin: '5px', backgroundColor: '#a44a4a', border: 'none', borderRadius: '3px', cursor: 'pointer' }
        });

        // NEW: Input for new tab name
        this.newTabInput = new TextInput({
            placeholder: 'New tab name...',
            style: { width: '120px', marginRight: '8px', padding: '5px' }, // Changed width
        });
        DOM.on(this.newTabInput.inputElement, 'keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter') this.addTab();
        });

        const tabControlsContainer = new Container({
            style: { display: 'flex', alignItems: 'center', padding: '5px', borderBottom: '1px solid #555' },
            children: [this.newTabInput, addTabButton, deleteTabButton]
        });

        const tabsAndButtonContainer = new Container({
            style: { display: 'flex', flexDirection: 'column', width: '100%' },
            children: [this.tabsContainer, tabControlsContainer] // Combined tab UI
        });

        this.todoListContainer = new Container({
            style: { flexGrow: '1', overflowY: 'auto', overflowX: 'hidden', padding: '10px', width: '100%' },
        });

        this.input = new TextInput({
            placeholder: 'Add a new task...',
            style: { flexGrow: '1', marginRight: '8px' },
        });
        DOM.on(this.input.inputElement, 'keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter') this.addTodo();
        });

        const addButton = new Button({
            text: 'Add',
            onClick: () => this.addTodo(),
            style: { padding: '8px 12px', backgroundColor: '#4a4a4a' }
        });

        const inputAreaContainer = new Container({
            style: { display: 'flex', padding: '10px', borderTop: '1px solid #555', width: '100%' },
            children: [this.input, addButton]
        });

        const mainContainer = new Container({
            style: { display: 'flex', flexDirection: 'column', height: '100%' },
            children: [tabsAndButtonContainer, this.todoListContainer, inputAreaContainer]
        });

        this.window = new TodoWindow({
            windowId: 'matelib-todo-list-window',
            title: 'TODO',
            initialSize: { width: '450px', height: '450px' },
            initialPosition: { top: '0.0%', left: '53%' },
            children: [mainContainer.element],
            resizable: true,
            hoverable: true,
            onClose: () => {
                window.__MATE_TODOLIST_INITIALIZED__ = false;
            }
        });

        await this.loadTodos();
    }

    private renderTabs() {
        if (!this.tabsContainer) return;
        this.tabsContainer.element.innerHTML = '';
        Object.keys(this.todos).forEach(tabName => {
            const tabButton = new Button({
                text: tabName,
                onClick: () => {
                    this.activeTab = tabName;
                    this.renderTabs();
                    this.renderTodos();
                },
                style: {
                    padding: '5px 10px',
                    margin: '5px',
                    backgroundColor: this.activeTab === tabName ? '#6a6a6a' : '#3a3a3a',
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer',
                    borderRadius: '3px'
                }
            });

            // Add double-click listener for renaming
            DOM.on(tabButton.element, 'dblclick', () => {
                this.renameTab(tabName, tabButton.element);
            });

            DOM.append(this.tabsContainer.element, tabButton.element);
        });
    }

    // MODIFIED: Reads from the newTabInput field
    private async addTab() {
        const tabName = this.newTabInput.getValue().trim(); // Read from the new input field
        if (tabName && tabName !== '') {
            if (!this.todos[tabName]) {
                this.todos[tabName] = [];
                this.activeTab = tabName;
                await this.saveTodos();
                this.renderTabs();
                this.renderTodos();
                this.newTabInput.setValue(''); // Clear the input field after adding
            } else {
                alert('Tab already exists.');
            }
        }
    }

    private async deleteTab() {
        if (Object.keys(this.todos).length <= 1) {
            alert("Cannot delete the last tab.");
            return;
        }

        if (confirm(`Are you sure you want to delete the tab "${this.activeTab}"?`)) {
            delete this.todos[this.activeTab];
            this.activeTab = Object.keys(this.todos)[0];
            await this.saveTodos();
            this.renderTabs();
            this.renderTodos();
        }
    }

    private async loadTodos() {
        if (!this.todoListContainer) return;
        
        let parsedData: any;
        try {
            const todoData = await rogueEditorAPI.readStaticFile('todo.json');
            if (todoData) {
                parsedData = JSON.parse(todoData);
            }
        } catch (e) {
            console.error("Error parsing todo.json:", e);
        }

        if (parsedData && typeof parsedData === 'object' && !Array.isArray(parsedData) && Object.keys(parsedData).length > 0) {
            this.todos = parsedData;
        } else if (Array.isArray(parsedData)) {
            this.todos = { 'General': parsedData };
        } else {
            this.todos = { 'General': [] };
        }

        this.activeTab = Object.keys(this.todos)[0] || 'General';
        if (!this.todos[this.activeTab]) {
            this.todos[this.activeTab] = [];
        }

        this.renderTabs();
        this.renderTodos();
    }

    private async saveTodos() {
        await rogueEditorAPI.writeFile('/Static/todo.json', JSON.stringify(this.todos, null, 2));
        this.updateProgress();
    }

    private async addTodo() {
        const text = this.input.getValue().trim();
        if (text) {
            if (!this.todos[this.activeTab]) {
                this.todos[this.activeTab] = [];
            }
            this.todos[this.activeTab].push({ id: Date.now().toString(), text, completed: false });
            this.input.setValue('');
            await this.saveTodos();
            this.renderTodos();
        }
    }

    private renderTodos() {
        if (!this.todoListContainer) return;
        this.todoListContainer.element.innerHTML = '';
        const activeTodos = this.todos[this.activeTab] || [];
        activeTodos.forEach(todo => {
            const todoItem = this.createTodoItemComponent(todo);
            DOM.append(this.todoListContainer.element, todoItem.element);
        });
        this.updateProgress();
    }

    private createTodoItemComponent(todo: Todo): Container {
        const checkbox = new Checkbox({
            checked: todo.completed,
            onChange: async (checked) => {
                todo.completed = checked;
                await this.saveTodos();
                this.renderTodos();
            }
        });

        const textSpan = new Container({
            style: {
                flexGrow: '1',
                flexShrink: '1',
                flexBasis: '0', // Added to ensure proper flex behavior
                minWidth: '0', // Added
                textDecoration: todo.completed ? 'line-through' : 'none',
                color: todo.completed ? '#8BC34A' : '#fff',
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                overflow: 'hidden', // Added to prevent overflow from shifting UI
            }
        });
        textSpan.element.textContent = todo.text;

        const deleteButton = new Button({
            text: '🗑️',
            onClick: async () => {
                this.todos[this.activeTab] = this.todos[this.activeTab].filter(t => t.id !== todo.id);
                await this.saveTodos();
                this.renderTodos();
            },
            style: { background: 'none', border: 'none', fontSize: '16px', padding: '0', marginLeft: '10px' }
        });

        return new Container({
            style: {
                padding: '8px',
                borderBottom: '1px solid #444',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                backgroundColor: 'transparent',
                flexWrap: 'nowrap' // Added to prevent wrapping
            },
            children: [checkbox, textSpan, deleteButton]
        });
    }

    private updateProgress() {
        if (!this.window || !this.window.taskCountSpan || !this.window.progressBarFill) return;
        const activeTodos = this.todos[this.activeTab] || [];
        const total = activeTodos.length;
        const done = activeTodos.filter(t => t.completed).length;
        this.window.taskCountSpan.element.textContent = `(${done}/${total})`;
        const percentage = total > 0 ? (done / total) * 100 : 0;
        this.window.progressBarFill.element.style.width = `${percentage}%`;
    }

    private renameTab(oldTabName: string, tabButtonElement: HTMLElement) {
        const originalText = tabButtonElement.textContent;
        
        // Use a plain HTML input element instead of TextInput component
        const inputElement = document.createElement('input');
        inputElement.type = 'text';
        inputElement.value = oldTabName;
        inputElement.style.width = '100px';
        inputElement.style.padding = '3px';
        inputElement.style.border = '1px solid #555';
        inputElement.style.background = '#333';
        inputElement.style.color = '#fff';

        // Replace button content with input field
        tabButtonElement.innerHTML = '';
        tabButtonElement.appendChild(inputElement);
        inputElement.focus();

        const saveRename = async () => {
            const newTabName = inputElement.value.trim(); // Read from plain input
            if (newTabName === oldTabName || newTabName === '') {
                // No change or empty name, revert to original text
                tabButtonElement.innerHTML = originalText;
                return;
            }

            if (this.todos[newTabName]) {
                alert('A tab with this name already exists.');
                tabButtonElement.innerHTML = originalText; // Revert
                return;
            }

            // Perform rename
            const tabContent = this.todos[oldTabName];
            delete this.todos[oldTabName];
            this.todos[newTabName] = tabContent;

            if (this.activeTab === oldTabName) {
                this.activeTab = newTabName;
            }

            await this.saveTodos();
            this.renderTabs(); // Re-render all tabs to reflect change
            this.renderTodos(); // Re-render todos if active tab changed
        };

        // Save on blur or Enter key
        inputElement.addEventListener('blur', saveRename);
        inputElement.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                inputElement.blur(); // Trigger blur to save
            }
        });
    }
}

// Helper classes and interfaces
interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

class TodoWindow extends Window<WindowProps> {
    public taskCountSpan: Container;
    public progressBarFill: Container;

    constructor(props: WindowProps) {
        super(props);
    }

    protected addCustomHeaderElements(controlsContainer: HTMLElement) {
        const customElementsContainer = new Container({
            style: {
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginRight: '10px'
            }
        });

        this.taskCountSpan = new Container({ style: { color: '#AAA', fontSize: '12px', fontWeight: 'normal' } });

        this.progressBarFill = new Container({
            style: { height: '100%', width: '0%', backgroundColor: '#8BC34A', borderRadius: '3px', transition: 'width 0.3s ease-in-out' }
        });
        const progressBarContainer = new Container({
            style: { width: '100px', height: '6px', backgroundColor: '#2c2c2c', borderRadius: '3px', overflow: 'hidden' },
            children: [this.progressBarFill]
        });

        customElementsContainer.element.appendChild(this.taskCountSpan.element);
        customElementsContainer.element.appendChild(progressBarContainer.element);

        controlsContainer.prepend(customElementsContainer.element);
    }
}

// The Rogue Engine Component
@RE.registerComponent
export default class TodoListComponent extends RE.Component {
    static isEditorComponent = true;

    start() {
        if (RE.Runtime.isRunning) return;

        if (window.__MATE_TODOLIST_INITIALIZED__) {
            return;
        }
        window.__MATE_TODOLIST_INITIALIZED__ = true;
        new TodoListManager();
    }
}