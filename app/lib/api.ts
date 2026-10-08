/**
 * Custom Error class for API responses
 */
export class ApiError extends Error {
    constructor(public status: number, public statusText: string, public data: any) {
        super(`API Error ${status}: ${statusText}`);
        this.name = "ApiError";
    }
}

/**
 * Reusable fetch wrapper for API requests
 * 
 * @param endpoint - The API endpoint (e.g., "/mods")
 * @param options - Standard RequestInit options (method, headers, body, etc.)
 * @returns The parsed JSON response
 * 
 * @example
 * const data = await apiFetch<User[]>("/users");
 */
function normalizeBaseUrl(baseUrl: string) {
    return baseUrl.trim().replace(/\/+$/, "");
}

export function getApiBaseUrl() {
    const configuredBaseUrl = "https://api.ob1.store";

    if (!configuredBaseUrl?.trim()) {
        throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
    }

    return normalizeBaseUrl(configuredBaseUrl);
}

export function buildApiUrl(endpoint: string) {
    let baseUrl = getApiBaseUrl();

    // If the base URL is relative (starts with /), and we're in a browser, 
    // prepend the window origin to make it absolute for Electron/Node fetch.
    if (baseUrl.startsWith("/") && typeof window !== "undefined") {
        baseUrl = `${window.location.origin}${baseUrl}`;
    }

    // Standardize: ensure baseUrl doesn't end with / and endpoint doesn't start with /
    const cleanBaseUrl = baseUrl.replace(/\/+$/, "");
    const cleanEndpoint = endpoint.replace(/^\/+/, "");

    // Logic for avoiding duplication: 
    // If baseUrl ends in /api AND endpoint starts with api/, remove api/ from endpoint.
    const finalEndpoint = (cleanBaseUrl.endsWith("/api") && cleanEndpoint.startsWith("api/"))
        ? cleanEndpoint.substring(4)
        : cleanEndpoint;

    return `${cleanBaseUrl}/${finalEndpoint}`;
}

export function buildAssetUrl(assetPath: string) {
    if (/^https?:\/\//i.test(assetPath)) {
        return assetPath;
    }

    return new URL(assetPath, `${getApiBaseUrl()}/`).toString();
}

// Module-level HWID cache — computed once per app launch / hard refresh,
// never re-run on client-side navigation between pages.
let _cachedHwid: string | null = null;
let _hwidFetchPromise: Promise<string | null> | null = null;

async function getCachedHwid(): Promise<string | null> {
    if (_cachedHwid !== null) return _cachedHwid;
    if (typeof window === "undefined" || !window.electron?.getHwid) return null;

    // Deduplicate concurrent calls — only one PowerShell query runs at a time
    if (!_hwidFetchPromise) {
        _hwidFetchPromise = window.electron.getHwid()
            .then((id: string) => {
                _cachedHwid = id;
                return id;
            })
            .catch((e: unknown) => {
                console.warn("Failed to get HWID:", e);
                _hwidFetchPromise = null; // allow retry on next request
                return null;
            });
    }
    return _hwidFetchPromise;
}

export async function apiFetch<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const url = buildApiUrl(endpoint);

    let token = typeof window !== 'undefined' ? window.localStorage.getItem('auth_session') : null;

    // HWID is now cached — only runs PowerShell once per app session
    const hwid = await getCachedHwid();

    if (typeof window !== 'undefined') {
        if (!token) {
            console.log(`[apiFetch] 📭 No token found in localStorage for: ${endpoint}`);
        } else {
            console.log(`[apiFetch] 🔐 Token found for: ${endpoint} | Starts with: ${token.substring(0, 15)}...`);
            
            // 🛡️ SANITIZATION: If we somehow have an old express-session string in LocalStorage, kill it.
            if (token.startsWith('s:') || token.startsWith('s%3A')) {
                console.warn("[Auth] 🛑 Detected legacy session token in LocalStorage. Purging...");
                window.localStorage.removeItem('auth_session');
                token = null;
            }
        }
    }

    const config: RequestInit = {
        ...options,
        credentials: "include", 
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
            ...(hwid ? { "X-Device-HWID": hwid } : {}),
            ...options.headers,
        },
    };

    const response = await fetch(url, config);

    if (!response.ok) {
        if (response.status === 401 && typeof window !== 'undefined') {
            console.log("[apiFetch] 401 Detected. Clearing auth_session from LocalStorage.");
            window.localStorage.removeItem('auth_session');
        }
        let errorData = null;
        try { errorData = await response.json(); } catch { }
        
        // Handle HWID-specific errors
        if (response.status === 403 && errorData?.code) {
            const hwidMessages: Record<string, string> = {
                "HWID_MISMATCH": "This device is linked to a different account. You cannot access this content.",
                "HWID_UNAUTHORIZED": "This device is not authorized for your account.",
                "HWID_CONFLICT": "This device is already linked to another account.",
                "HWID_REQUIRED": "Device verification required. Please restart the app."
            };
            if (hwidMessages[errorData.code]) {
                if (typeof window !== 'undefined') {
                    alert(hwidMessages[errorData.code]);
                }
            }
        }
        
        throw new ApiError(response.status, response.statusText, errorData);
    }

    if (response.status === 204) return {} as T;
    return response.json() as Promise<T>;
}
