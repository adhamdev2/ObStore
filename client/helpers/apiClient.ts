import path from "path";
import dotenv from "dotenv";

// Ensure env vars are loaded
const apiDir = path.resolve(process.cwd(), "..", "api");
dotenv.config({ path: path.join(apiDir, ".env") });

function getApiUrl(): string {
    return process.env.API_URL || "http://localhost:3004";
}

function getBotApiKey(): string {
    return process.env.BOT_API_KEY || "";
}

function getHeaders(): Record<string, string> {
    return {
        "Content-Type": "application/json",
        "x-bot-api-key": getBotApiKey(),
    };
}

class ApiError extends Error {
    constructor(
        message: string,
        public status: number,
        public body: any
    ) {
        super(message);
        this.name = "ApiError";
    }
}

async function request<T = any>(
    method: string,
    endpoint: string,
    body?: any
): Promise<T> {
    const url = `${getApiUrl()}/api/bot${endpoint}`;

    const options: RequestInit = {
        method,
        headers: getHeaders(),
    };

    if (body && method !== "GET") {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    let data: any;
    try {
        data = await response.json();
    } catch {
        throw new ApiError(
            `Invalid JSON response from API`,
            response.status,
            null
        );
    }

    if (!response.ok) {
        const errorMsg = data?.error || data?.message || `HTTP ${response.status}`;
        throw new ApiError(errorMsg, response.status, data);
    }

    return data as T;
}

export async function botApiGet<T = any>(endpoint: string): Promise<T> {
    return request<T>("GET", endpoint);
}

export async function botApiPost<T = any>(endpoint: string, body: any): Promise<T> {
    return request<T>("POST", endpoint, body);
}

export async function botApiPut<T = any>(endpoint: string, body: any): Promise<T> {
    return request<T>("PUT", endpoint, body);
}

export async function botApiDelete<T = any>(endpoint: string, body: any): Promise<T> {
    return request<T>("DELETE", endpoint, body);
}

export { ApiError };
