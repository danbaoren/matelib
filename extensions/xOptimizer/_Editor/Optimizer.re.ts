import * as RE from 'rogue-engine';
import MATE from '../../../mate';
import { rogueEditorAPI } from '../../../modules/RogueEditorAPI';
import { DOM } from '../../../modules/DOM'

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
        this.window = new MATE.ui.Window({
            title: "Multimedia Optimizer",
            initialSize: { width: "450px", height: "600px" },
            onClose: () => { 
                            this.window = null; } 
        });

        this.dropArea = new MATE.ui.DropArea({
            parent: this.window.content,
            onDrop: this.handleFileDrop.bind(this),
            style: {
                width: '100%',
                height: '300px',
                margin: '10px 0',
                flexShrink: '0'
            }
        });

        this.previewCanvas = new MATE.ui.Canvas({
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

        const controlsContainer = new MATE.ui.Container({ parent: this.window.content });

        const qualityRow = new MATE.ui.Container({ parent: controlsContainer.element, style: { display: 'flex', alignItems: 'center' } });
        new MATE.ui.Label({ parent: qualityRow.element, text: "Quality:", style: { marginRight: '10px' } });
        this.debouncedUpdatePreview = this.debounce(this.updatePreview, 300); // 300ms debounce delay
        this.qualitySlider = new MATE.ui.Slider({
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
        this.qualityValueLabel = new MATE.ui.Label({ parent: qualityRow.element, text: `${this.quality}%`, style: { minWidth: '40px', textAlign: 'right' } });

        this.autoSaveCheckbox = new MATE.ui.Checkbox({
            parent: controlsContainer.element,
            label: "Auto-save on drop",
            checked: false,
            style: { marginTop: '10px', justifyContent: 'center' }
        });

        this.fileInfoElement = new MATE.ui.Panel({
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

        this.fileInfoTable = new MATE.ui.Container({ // Use Container instead of Table
            parent: this.fileInfoElement.element,
            style: {
                width: '100%',
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                gap: '4px 10px', // Row gap, column gap
                alignItems: 'center',
            }
        });

        this.progressBar = new MATE.ui.ProgressBar({
            parent: controlsContainer.element,
        });

        this.progressLabel = new MATE.ui.Label({
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

        this.convertButton = new MATE.ui.Button({
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
            MATE.ui.Notify.show('Unsupported file type.', { backgroundColor: "#ff6b6b" });
            // Reset UI or hide elements not applicable
            this.dropArea.showHint(true);
            this.previewCanvas.hide();
            this.fileInfoElement.hide();
            DOM.setStyle(this.convertButton.element, { opacity: '0.5' });
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

                this.previewCanvas.show();
                this.dropArea.showHint(false);
                DOM.setStyle(this.convertButton.element, { opacity: '1' });
                this.fileInfoElement.show();
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
        MATE.ui.Notify.show(`Audio file dropped: ${file.name}. Audio conversion not yet implemented.`, { backgroundColor: "#ffeb3b" });
        this.previewCanvas.hide(); // Hide canvas for audio
        this.fileInfoElement.show();
        DOM.setStyle(this.convertButton.element, { opacity: '1' });
        this.dropArea.showHint(false);

        const tableData = [
            { label: 'File:', value: file.name, valueTitle: file.name },
            { label: 'Size:', value: this.formatBytes(file.size) },
            { label: 'Status:', value: 'Ready (Audio)' }
        ];
        this.updateFileInfoTable(tableData);

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

        const tableData = [
            { label: 'Original:', value: this.formatBytes(this.originalFileSize) },
            { label: 'Potential Output:', value: this.formatBytes(newSize) },
            { label: 'Storage Saved:', value: `${savedPercentage.toFixed(1)}%`, valueColor: savedColor },
            { label: 'Output Path:', value: potentialNewFilePath, valueTitle: potentialNewFilePath }
        ];
        this.updateFileInfoTable(tableData);
    }

    private async convertAndSave() {
        if (!this.originalFileName || !this.originalFilePath) {
            MATE.ui.Notify.show("No file loaded or file path not determined.", { backgroundColor: "#ff6b6b" });
            return;
        }

        this.progressBar.show();
        this.progressLabel.show();
        this.progressBar.setProgress(0);
        this.progressLabel.setText('Starting conversion...');
        await MATE.utils.wait(50); // Allow UI to update

        let dataToSave: string | ArrayBuffer;
        let newFilePath: string;
        let targetExtension: string;

        switch (this.currentMediaType) {
            case MediaType.Image:
                if (!this.originalImage) {
                    MATE.ui.Notify.show("No image loaded for conversion.", { backgroundColor: "#ff6b6b" });
                    this.progressBar.hide();
                    return;
                }
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = this.originalImage.naturalWidth;
                tempCanvas.height = this.originalImage.naturalHeight;
                const tempCtx = tempCanvas.getContext('2d');

                if (!tempCtx) {
                    MATE.ui.Notify.show("Could not create canvas context for image conversion.", { backgroundColor: "#ff6b6b" });
                    this.progressBar.hide();
                    return;
                }
                tempCtx.drawImage(this.originalImage, 0, 0);

                this.progressBar.setProgress(50);
                this.progressLabel.element.textContent = 'Encoding image...';
                await MATE.utils.wait(50); // Allow UI to update

                dataToSave = tempCanvas.toDataURL('image/webp', this.quality / 100);
                if (!dataToSave.startsWith('data:image/webp')) {
                    MATE.ui.Notify.show("Failed to convert to WebP. Browser may not support it.", { backgroundColor: "#ff6b6b" });
                    this.progressBar.hide();
                    return;
                }
                targetExtension = '.webp';
                break;
            case MediaType.Audio:
                MATE.ui.Notify.show("Audio conversion to Ogg is not yet implemented.", { backgroundColor: "#ffeb3b" });
                this.progressBar.hide();
                return; // Exit for now, as audio conversion is not implemented
            default:
                MATE.ui.Notify.show("Unsupported media type for conversion.", { backgroundColor: "#ff6b6b" });
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
            MATE.ui.Notify.show(`Successfully saved to:\n${newFilePath}`, {backgroundColor: "#64ce69ff"});
        } catch (error) {
            MATE.log(`File write failed: ${error}`);
            MATE.ui.Notify.show(`File write failed. See console for details. Path: ${newFilePath}`, { backgroundColor: "#ff6b6b" });
            this.progressLabel.element.textContent = 'Error!';
        } finally {
            // Hide the progress bar and label after a short delay
            setTimeout(() => {
                this.progressBar.hide();
                this.progressLabel.element.style.display = 'none';
            }, 2000);
        }
    }

    private updateFileInfoTable(data: Array<{ label: string; value: string; valueTitle?: string; valueColor?: string }>) {
        // Clear existing content
        while (this.fileInfoTable.element.firstChild) {
            this.fileInfoTable.element.removeChild(this.fileInfoTable.element.firstChild);
        }

        data.forEach(item => {
            new MATE.ui.Label({
                parent: this.fileInfoTable.element,
                text: item.label,
                style: { paddingRight: '10px', whiteSpace: 'nowrap' }
            });
            new MATE.ui.Label({
                parent: this.fileInfoTable.element,
                text: item.value,
                style: {
                    textAlign: 'right',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: item.valueColor || 'inherit'
                }
            });
        });
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

    
    //start() {
    //    if (this.uiManager) { return; }
//
    //    this.uiManager = new OptimizerUIManager();
    //}    



 
}