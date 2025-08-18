import * as RE from 'rogue-engine';
import MATE from '../../../mate';
import { rogueEditorAPI } from '../../../modules/RogueEditorAPI';
import { UI, Window } from '../../../modules/UI';

enum MediaType {
    Image,
    Audio,
    Unknown
}

class OptimizerUIManager {
    private window: any;
    private previewCanvas: any;
    private dropArea: any;
    private convertButton: any;
    private qualitySlider: any;
    private qualityValueLabel: any;
    private fileInfoElement: any;
    private autoSaveCheckbox: any;
    private fileInfoTable: any;
    private progressBar: any;
    private progressLabel: any;

    private originalImage: HTMLImageElement | null = null;
    private originalFileName: string | null = null;
    private originalFilePath: string | null = null;
    private originalFileSize: number | null = null;

    private quality: number = 75;
    private debouncedUpdatePreview: Function;
    private currentMediaType: MediaType = MediaType.Unknown;

    constructor() {
        this.window = new UI.Window({
            title: "Multimedia Optimizer",
            initialSize: { width: "450px", height: "600px" },
            onClose: () => { 
                            this.window = null; } 
        });

        this.dropArea = new UI.DropArea({
            parent: this.window.content,
            onDrop: this.handleFileDrop.bind(this),
            style: {
                width: '100%',
                height: '300px',
                margin: '10px 0',
                flexShrink: '0'
            }
        });

        this.previewCanvas = new UI.Canvas({
            parent: this.dropArea.element,
            style: {
                display: 'none',
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                maxWidth: '100%',
                maxHeight: '100%',
            }
        });

        const controlsContainer = new UI.Container({ parent: this.window.content });

        const qualityRow = new UI.Container({ parent: controlsContainer.element, style: { display: 'flex', alignItems: 'center' } });
        new UI.Label({ parent: qualityRow.element, text: "Quality:", style: { marginRight: '10px' } });
        this.debouncedUpdatePreview = this.debounce(this.updatePreview, 300); // 300ms debounce delay
        this.qualitySlider = new UI.Slider({
            parent: qualityRow.element,
            min: 0,
            max: 100,
            value: this.quality,
            onChange: (value) => {
                this.quality = value;
                this.qualityValueLabel.element.textContent = `${this.quality}%`;
                this.debouncedUpdatePreview();
            }
        });
        this.qualityValueLabel = new UI.Label({ parent: qualityRow.element, text: `${this.quality}%`, style: { minWidth: '40px', textAlign: 'right' } });

        this.autoSaveCheckbox = new UI.Checkbox({
            parent: controlsContainer.element,
            label: "Auto-save on drop",
            checked: false,
            style: { marginTop: '10px', justifyContent: 'center' }
        });

        this.fileInfoElement = new UI.Panel({
            parent: controlsContainer.element,
            style: {
                background: '#3a3a3a',
                borderRadius: '4px',
                padding: '10px',
                fontSize: '14px',
                lineHeight: '1.6',
                display: 'none'
            }
        });

        this.fileInfoTable = new UI.Table({
            parent: this.fileInfoElement.element,
            style: {
                width: '100%',
                borderSpacing: '0 4px'
            }
        });

        this.progressBar = new UI.ProgressBar({
            parent: controlsContainer.element,
        });

        this.progressLabel = new UI.Label({
            parent: controlsContainer.element,
            text: 'Ready',
            style: {
                textAlign: 'center',
                fontSize: '12px',
                color: '#b9bbbe',
                marginTop: '-8px',
                marginBottom: '8px',
                display: 'none'
            }
        });

        this.convertButton = new UI.Button({
            parent: controlsContainer.element,
            text: "Convert & Save to Project",
            onClick: () => this.convertAndSave(),
            style: {
                opacity: '0.5',
            }
        });
    }

    private handleFileDrop(e: DragEvent) {
        if (!e.dataTransfer || e.dataTransfer.files.length === 0) return;
        const file = e.dataTransfer.files[0];

        this.originalFileName = file.name;
        this.originalFileSize = file.size;

        const data = e.dataTransfer.getData("text/uri-list");
        if (data && data.includes('/Assets/')) {
            const encodedPath = data.substring(data.indexOf('/Assets/'));
            try {
                this.originalFilePath = decodeURIComponent(encodedPath);
            } catch (e) {
                MATE.log(`Could not decode file path URI, using as is. ${e}`);
                this.originalFilePath = encodedPath;
            }
        } else {
            this.originalFilePath = null;
        }

        if (file.type.startsWith('image/')) {
            this.currentMediaType = MediaType.Image;
            this.handleImageFile(file);
        } else if (file.type.startsWith('audio/')) {
            this.currentMediaType = MediaType.Audio;
            this.handleAudioFile(file);
        } else {
            this.currentMediaType = MediaType.Unknown;
            UI.notify('Unsupported file type.', { backgroundColor: "#ff6b6b" });
            // Reset UI or hide elements not applicable
            this.dropArea.showHint(true);
            this.previewCanvas.element.style.display = 'none';
            this.fileInfoElement.element.style.display = 'none';
            this.convertButton.element.style.opacity = '0.5';
            return;
        }
    }

    private handleImageFile(file: File) {
        const reader = new FileReader();
        reader.onload = (event) => {
            this.originalImage = new Image();
            this.originalImage.onload = () => {
                const canvas = this.previewCanvas.canvasElement;
                const ctx = canvas.getContext('2d');
                const container = this.dropArea.element;

                if (!ctx || !container || !this.originalImage) return;

                const imgWidth = this.originalImage.naturalWidth;
                const imgHeight = this.originalImage.naturalHeight;
                const imgAspectRatio = imgWidth / imgHeight;

                const containerWidth = container.clientWidth;
                const containerHeight = container.clientHeight;
                const containerAspectRatio = containerWidth / containerHeight;

                let drawWidth = containerWidth;
                let drawHeight = drawWidth / imgAspectRatio;

                if (drawHeight > containerHeight) {
                    drawHeight = containerHeight;
                    drawWidth = drawHeight * imgAspectRatio;
                }

                canvas.width = drawWidth;
                canvas.height = drawHeight;
                ctx.drawImage(this.originalImage, 0, 0, drawWidth, drawHeight);

                this.previewCanvas.element.style.display = 'block';
                this.dropArea.showHint(false);
                this.convertButton.element.style.opacity = '1';
                this.fileInfoElement.element.style.display = 'block';
                this.updatePreview();
                if (this.autoSaveCheckbox.getChecked()) {
                    this.convertAndSave();
                }
            };
            this.originalImage.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    }

    private handleAudioFile(file: File) {
        // Placeholder for audio file handling
        UI.notify(`Audio file dropped: ${file.name}. Audio conversion not yet implemented.`, { backgroundColor: "#ffeb3b" });
        this.previewCanvas.element.style.display = 'none'; // Hide canvas for audio
        this.fileInfoElement.element.style.display = 'block';
        this.convertButton.element.style.opacity = '1';
        this.dropArea.showHint(false);

        this.fileInfoTable.clearBody();
        const cellStyles: (Partial<CSSStyleDeclaration> | null)[] = [
            { paddingRight: '10px', whiteSpace: 'nowrap' },
            { textAlign: 'right' }
        ];
        const cellStylesWithEllipsis: (Partial<CSSStyleDeclaration> | null)[] = [
            { paddingRight: '10px', whiteSpace: 'nowrap' },
            { textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis' }
        ];

        const fileNameHTML = `<b title="${file.name}">${file.name}</b>`;
        this.fileInfoTable.addRow(['File:', fileNameHTML], cellStylesWithEllipsis);
        this.fileInfoTable.addRow(['Size:', `<b>${this.formatBytes(file.size)}</b>`], cellStyles);
        this.fileInfoTable.addRow(['Status:', '<b>Ready (Audio)</b>'], cellStyles);

        if (this.autoSaveCheckbox.getChecked()) {
            this.convertAndSave();
        }
    }

    private formatBytes(bytes: number, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    private dataURLtoBlob(dataurl: string): Blob {
        const arr = dataurl.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        if (!mimeMatch) {
            throw new Error("Invalid data URL");
        }
        const mime = mimeMatch[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while(n--){
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], {type:mime});
    }

    private updatePreview() {
        if (!this.originalFileSize || !this.fileInfoElement) return;

        let newSize: number;
        let potentialNewFilePath: string = "N/A";
        let targetExtension: string = "";

        switch (this.currentMediaType) {
            case MediaType.Image:
                if (!this.originalImage) return;
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = this.originalImage.naturalWidth;
                tempCanvas.height = this.originalImage.naturalHeight;
                const tempCtx = tempCanvas.getContext('2d');
                if (!tempCtx) return;

                tempCtx.drawImage(this.originalImage, 0, 0);
                const dataUrl = tempCanvas.toDataURL('image/webp', this.quality / 100);
                
                const blob = this.dataURLtoBlob(dataUrl);
                newSize = blob.size;
                targetExtension = '.webp';
                break;
            case MediaType.Audio:
                // For audio, we don't have a direct "preview" size change without conversion.
                // We'll just show the original size and a placeholder for potential new size.
                newSize = this.originalFileSize; // Placeholder, actual size will be known after conversion
                targetExtension = '.ogg'; // Assuming Ogg as target for audio
                break;
            default:
                return; // Should not happen if file type is handled
        }

        if (this.originalFilePath) {
            potentialNewFilePath = this.originalFilePath.substring(0, this.originalFilePath.lastIndexOf('.')) + targetExtension;
        }

        const savedPercentage = 100 - (newSize / this.originalFileSize * 100);
        const savedColor = savedPercentage > 0 ? '#64ce69' : '#ff6b6b';

        this.fileInfoTable.clearBody();
        const cellStyles: (Partial<CSSStyleDeclaration> | null)[] = [
            { paddingRight: '10px', whiteSpace: 'nowrap' },
            { textAlign: 'right' }
        ];
        const cellStylesWithEllipsis: (Partial<CSSStyleDeclaration> | null)[] = [
            { paddingRight: '10px', whiteSpace: 'nowrap' },
            { textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis' }
        ];

        const savedHTML = `<b style="color: ${savedColor};">${savedPercentage.toFixed(1)}%</b>`;
        const pathHTML = `<b title="${potentialNewFilePath}">${potentialNewFilePath}</b>`;

        this.fileInfoTable.addRow(['Original:', `<b>${this.formatBytes(this.originalFileSize)}</b>`], cellStyles);
        this.fileInfoTable.addRow(['Potential Output:', `<b>${this.formatBytes(newSize)}</b>`], cellStyles);
        this.fileInfoTable.addRow(['Storage Saved:', savedHTML], cellStyles);
        this.fileInfoTable.addRow(['Output Path:', pathHTML], cellStylesWithEllipsis);
    }

    private async convertAndSave() {
        if (!this.originalFileName || !this.originalFilePath) {
            UI.notify("No file loaded or file path not determined.", { backgroundColor: "#ff6b6b" });
            return;
        }

        this.progressBar.show();
        this.progressLabel.element.style.display = 'block';
        this.progressBar.setProgress(0);
        this.progressLabel.element.textContent = 'Starting conversion...';
        await MATE.utils.wait(50); // Allow UI to update

        let dataToSave: string | ArrayBuffer;
        let newFilePath: string;
        let targetExtension: string;

        switch (this.currentMediaType) {
            case MediaType.Image:
                if (!this.originalImage) {
                    UI.notify("No image loaded for conversion.", { backgroundColor: "#ff6b6b" });
                    this.progressBar.hide();
                    return;
                }
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = this.originalImage.naturalWidth;
                tempCanvas.height = this.originalImage.naturalHeight;
                const tempCtx = tempCanvas.getContext('2d');

                if (!tempCtx) {
                    UI.notify("Could not create canvas context for image conversion.", { backgroundColor: "#ff6b6b" });
                    this.progressBar.hide();
                    return;
                }
                tempCtx.drawImage(this.originalImage, 0, 0);

                this.progressBar.setProgress(50);
                this.progressLabel.element.textContent = 'Encoding image...';
                await MATE.utils.wait(50); // Allow UI to update

                dataToSave = tempCanvas.toDataURL('image/webp', this.quality / 100);
                if (!dataToSave.startsWith('data:image/webp')) {
                    UI.notify("Failed to convert to WebP. Browser may not support it.", { backgroundColor: "#ff6b6b" });
                    this.progressBar.hide();
                    return;
                }
                targetExtension = '.webp';
                break;
            case MediaType.Audio:
                UI.notify("Audio conversion to Ogg is not yet implemented.", { backgroundColor: "#ffeb3b" });
                this.progressBar.hide();
                return; // Exit for now, as audio conversion is not implemented
            default:
                UI.notify("Unsupported media type for conversion.", { backgroundColor: "#ff6b6b" });
                this.progressBar.hide();
                return;
        }

        newFilePath = this.originalFilePath.substring(0, this.originalFilePath.lastIndexOf('.')) + targetExtension;

        this.progressBar.setProgress(75);
        this.progressLabel.element.textContent = 'Saving file...';
        await MATE.utils.wait(50); // Allow UI to update

        try {
            await rogueEditorAPI.writeBinaryFile(newFilePath, dataToSave);
            this.progressBar.setProgress(100);
            this.progressLabel.element.textContent = 'Complete!';
            UI.notify(`Successfully saved to:\n${newFilePath}`, {backgroundColor: "#64ce69ff"});
        } catch (error) {
            MATE.log(`File write failed: ${error}`);
            UI.notify(`File write failed. See console for details. Path: ${newFilePath}`, { backgroundColor: "#ff6b6b" });
            this.progressLabel.element.textContent = 'Error!';
        } finally {
            // Hide the progress bar and label after a short delay
            setTimeout(() => {
                this.progressBar.hide();
                this.progressLabel.element.style.display = 'none';
            }, 2000);
        }
    }

    private debounce(func: Function, delay: number) {
        let timeout: ReturnType<typeof setTimeout>;
        return function(this: any, ...args: any[]) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }

}

@RE.registerComponent
export default class xOptimizer extends RE.Component {
    public uiManager: OptimizerUIManager | null = null;

    static isEditorComponent = true;

    //@RE.props.button() openOptimizer = () => {{this.uiManager = new OptimizerUIManager();}}
    //openOptimizerLabel = "🛠️ Open Multimedia Optimizer";
    //@RE.props.button() openOptimizer2 = () => {{this.uiManager = new OptimizerUIManager();}
    //openOptimizer2Label = "🛠️ Open Multimedia Optimizer";

    /*
    start() {
        if (this.uiManager) { return; }

        UI.addButton('div#toolbar-center', {
            text: '🛠️',
            title: 'Asset Optimizer & Converter',
            style: {
                backgroundColor: '#d10000ff',
                color: 'white',
                padding: '10px',
                borderRadius: '115px',
            },
            onClick: () => {
                this.uiManager = new OptimizerUIManager();
            },
            });
    }
            */



 
}