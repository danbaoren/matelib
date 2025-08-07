export interface RequestOptions {
    headers?: { [key: string]: string };
    queryParams?: { [key: string]: string | number | boolean };
    retries?: number;
    retryDelayMs?: number;
    timeoutMs?: number;
    body?: any; // For POST, PUT, DELETE
    responseType?: 'json' | 'text' | 'blob' | 'arraybuffer';
}

export class Networking {

    private static async fetchWithRetry(
        url: string,
        method: string,
        options: RequestOptions = {}
    ): Promise<any> {
        const {
            headers = {},
            queryParams = {},
            retries = 0,
            retryDelayMs = 1000,
            timeoutMs,
            body,
            responseType = 'json'
        } = options;

        const fullUrl = Networking.buildUrl(url, queryParams);
        const fetchOptions: RequestInit = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers,
            },
        };

        if (body) {
            fetchOptions.body = JSON.stringify(body);
        }

        for (let i = 0; i <= retries; i++) {
            try {
                const controller = new AbortController();
                const id = setTimeout(() => controller.abort(), timeoutMs || 30000); // Default 30s timeout
                fetchOptions.signal = controller.signal;

                const response = await fetch(fullUrl, fetchOptions);
                clearTimeout(id);

                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`);
                }

                switch (responseType) {
                    case 'json':
                        return await response.json();
                    case 'text':
                        return await response.text();
                    case 'blob':
                        return await response.blob();
                    case 'arraybuffer':
                        return await response.arrayBuffer();
                    default:
                        return await response.json(); // Default to json
                }
            } catch (error: any) {
                if (i < retries && error.name !== 'AbortError') {
                    console.warn(`mate.Networking: Request failed (${method} ${fullUrl}). Retrying in ${retryDelayMs * Math.pow(2, i)}ms...`, error);
                    await new Promise(resolve => setTimeout(resolve, retryDelayMs * Math.pow(2, i)));
                } else {
                    console.error(`mate.Networking: Final attempt failed for ${method} ${fullUrl}.`, error);
                    throw error;
                }
            }
        }
    }

    private static buildUrl(url: string, queryParams: { [key: string]: string | number | boolean }): string {
        const params = new URLSearchParams();
        for (const key in queryParams) {
            if (queryParams.hasOwnProperty(key)) {
                params.append(key, String(queryParams[key]));
            }
        }
        return params.toString() ? `${url}?${params.toString()}` : url;
    }

    /**
     * Performs an HTTP GET request.
     * @param url The URL to send the request to.
     * @param options Request options including headers, query parameters, and retry logic.
     * @returns A Promise that resolves with the response data.
     */
    public static async get(url: string, options?: RequestOptions): Promise<any> {
        return this.fetchWithRetry(url, 'GET', options);
    }

    /**
     * Performs an HTTP POST request.
     * @param url The URL to send the request to.
     * @param data The data to send in the request body.
     * @param options Request options including headers, query parameters, and retry logic.
     * @returns A Promise that resolves with the response data.
     */
    public static async post(url: string, data: any, options?: RequestOptions): Promise<any> {
        return this.fetchWithRetry(url, 'POST', { ...options, body: data });
    }

    /**
     * Performs an HTTP PUT request.
     * @param url The URL to send the request to.
     * @param data The data to send in the request body.
     * @param options Request options including headers, query parameters, and retry logic.
     * @returns A Promise that resolves with the response data.
     */
    public static async put(url: string, data: any, options?: RequestOptions): Promise<any> {
        return this.fetchWithRetry(url, 'PUT', { ...options, body: data });
    }

    /**
     * Performs an HTTP DELETE request.
     * @param url The URL to send the request to.
     * @param options Request options including headers, query parameters, and retry logic.
     * @returns A Promise that resolves with the response data.
     */
    public static async delete(url: string, options?: RequestOptions): Promise<any> {
        return this.fetchWithRetry(url, 'DELETE', options);
    }

    /**
     * Creates a new WebSocket connection.
     * @param url The WebSocket URL.
     * @returns A new WebSocket instance.
     */
    public static createWebSocket(url: string): WebSocket {
        return new WebSocket(url);
    }
}