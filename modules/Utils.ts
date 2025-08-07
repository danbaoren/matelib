
import * as RE from 'rogue-engine';
import { DataTexture, RedFormat, UnsignedByteType, RepeatWrapping } from 'three';
import * as THREE from 'three';

export class Utils {
    public static wait(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    public static debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
        let timeout: number | undefined;
        return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
            const context = this;
            clearTimeout(timeout);
            timeout = window.setTimeout(() => func.apply(context, args), wait);
        };
    }

    public static random(min: number, max: number): number {
        return Math.random() * (max - min) + min;
    }

    public static randomInt(min: number, max: number): number {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    public static randomFrom<T>(arr: T[]): T | undefined {
        if (arr.length === 0) return undefined;
        return arr[this.randomInt(0, arr.length - 1)];
    }

    public static formatNumber(num: number, separator: string = ","): string {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, separator);
    }

    public static compoundInterest(principal: number, rate: number, time: number, n: number = 1): number {
        return principal * Math.pow(1 + rate / n, n * time);
    }

    public static loanPayment(principal: number, rate: number, time: number, n: number = 12): number {
        const monthlyRate = rate / n;
        const numPayments = time * n;
        return principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
    }

    public static clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }

    public static map(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
        return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
    }

    public static easeInOutCubic(t: number): number {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    public static createNoiseTexture(size: number = 256): DataTexture {
        const data = new Uint8Array(size * size);
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.random() * 255;
        }

        const texture = new DataTexture(data, size, size, RedFormat, UnsignedByteType);
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        texture.needsUpdate = true;

        return texture;
    }

    public static shuffle<T>(array: T[]): T[] {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    public static groupBy<T>(array: T[], key: keyof T): { [key: string]: T[] } {
        return array.reduce((result, currentValue) => {
            ((result[currentValue[key] as any] = result[currentValue[key] as any] || []) as T[]).push(currentValue);
            return result;
        }, {} as { [key: string]: T[] });
    }

    public static unique<T>(array: T[]): T[] {
        return [...new Set(array)];
    }

    public static capitalize(string: string): string {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    public static kebabCase(string: string): string {
        return string.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
    }

    public static snakeCase(string: string): string {
        return string.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1_$2').toLowerCase();
    }

    public static camelCase(string: string): string {
        return string.replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
    }

    public static uuid(): string {
        return crypto.randomUUID();
    }

    public static async hash(data: string): Promise<string> {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    public static async encrypt(data: string, secret: string): Promise<string> {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await this.createKey(secret);
        const encodedData = new TextEncoder().encode(data);
        const encryptedData = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encodedData);
        return this.bufferToBase64(iv) + '.' + this.bufferToBase64(new Uint8Array(encryptedData));
    }

    public static async decrypt(encryptedData: string, secret: string): Promise<string> {
        const [iv_b64, data_b64] = encryptedData.split('.');
        const iv = this.base64ToBuffer(iv_b64);
        const key = await this.createKey(secret);
        const data = this.base64ToBuffer(data_b64);
        const decryptedData = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
        return new TextDecoder().decode(decryptedData);
    }

    private static async createKey(secret: string): Promise<CryptoKey> {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secret);
        const keyHash = await crypto.subtle.digest('SHA-256', keyData);
        return await crypto.subtle.importKey('raw', keyHash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    }

    private static bufferToBase64(buffer: Uint8Array): string {
        return btoa(String.fromCharCode.apply(null, Array.from(buffer)));
    }

    private static base64ToBuffer(base64: string): Uint8Array {
        return new Uint8Array(atob(base64).split('').map(c => c.charCodeAt(0)));
    }

    public static async copyToClipboard(text: string): Promise<void> {
        await navigator.clipboard.writeText(text);
    }

    public static setFullscreen(enable: boolean): void {
        if (enable) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    private static blockDevTools = (e: KeyboardEvent) => {
        if (e.key === 'F12') {
            e.preventDefault();
        }
    };

    public static sblockDevTools(block: boolean): void {
        if (block) {
            window.addEventListener('keydown', this.blockDevTools);
        } else {
            window.removeEventListener('keydown', this.blockDevTools);
        }
    }

    private static blockContextMenu = (e: MouseEvent) => {
        e.preventDefault();
    };

    public static setBlockContextMenu(block: boolean): void {
        if (block) {
            document.addEventListener('contextmenu', this.blockContextMenu);
        } else {
            document.removeEventListener('contextmenu', this.blockContextMenu);
        }
    }

    public static nuke(): void {
        console.warn("NUKE INITIATED: Clearing scene and removing all custom event listeners.");
        RE.Debug.log("NUKE INITIATED: Clearing scene and removing all custom event listeners.");

        // 1. Dispose of all objects in the scene
        const scene = RE.Runtime.scene;
        const objectsToRemove: THREE.Object3D[] = [];

        scene.traverse(object => {
            objectsToRemove.push(object);
        });

        objectsToRemove.forEach(object => {
            if (object.parent) {
                object.parent.remove(object);
            }

            const mesh = object as THREE.Mesh;
            if (mesh.geometry) {
                mesh.geometry.dispose();
            }

            if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach(material => material.dispose());
                } else {
                    (mesh.material as THREE.Material).dispose();
                }
            }
        });
        
        // 2. Remove all children from the scene
        while(scene.children.length > 0){ 
            scene.remove(scene.children[0]); 
        }

        // 3. Clear the renderer
        if (RE.Runtime.renderer) {
            RE.Runtime.renderer.clear();
        }


        // TODO: make so it will ignore all rogue ui elements and event listeners inside them, delete only "undetected object"
        // 4. Remove all custom event listeners
        //const allElements = document.querySelectorAll('*');
        //allElements.forEach(element => {
        //    const newElement = element.cloneNode(true);
        //    element.parentNode?.replaceChild(newElement, element);
        //});

        console.log("Nuke complete. Engine state reset to pre-runtime.");
        RE.Debug.log("Nuke complete. Engine state reset to pre-runtime.");
    }
}
