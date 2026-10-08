export {};

declare global {
    interface Window {
        electron: {
            version: string;
            selectFolder: (defaultPath?: string) => Promise<string | null>;
            selectFile: (options?: { extensions?: string[] }) => Promise<string | null>;
            selectFiveMExe: () => Promise<{ path: string } | { error: string } | null>;
            getAutoFiveMPath: () => Promise<string | null>;
            pathExists: (targetPath: string) => Promise<boolean>;
            getHwid: () => Promise<string>;
            saveModStub: (payload: { modId: string; licenseKey: string; version: string; type?: string }) => Promise<{ path: string }>;
            readModStub: (modId: string, type?: string) => Promise<{ mod_id: string; license_key: string; version: string; type?: string }>;
            downloadModArchive: (payload: {
                url?: string;
                archivePath?: string;
                targetPath: string;
                modName?: string;
                modId?: string;
                type?: string;
                installDirectories: string[];
                skipDeletion?: boolean;
                totalSize?: number;
                downloadId?: string;
            }) => Promise<{ fileName: string; destinationPath: string; modName: string; installedFiles: string[] }>;
            downloadRpfFiles: (payload: {
                files: { url: string; fileName: string; size: number }[];
                targetPath: string;
                modId?: string;
                modName?: string;
                type?: string;
                targetSubDir?: string;
                downloadId?: string;
            }) => Promise<{ modName: string; installedFiles: string[] }>;
            launchFiveMFlow: (payload: { fivemPath: string; toolPath: string; input: string }) => Promise<boolean>;
            launchSecureFiveM: (payload: {
                executablePath: string;
                targetRoot: string;
                sessionId?: string;
                authToken?: string;
                toolPath?: string;
                input?: string;
                args?: string[];
                keyBase64: string;
                files: { relativePath: string; ciphertextBase64: string; ivBase64: string; authTagBase64: string; aadBase64?: string }[];
            }) => Promise<{ started: boolean; temporaryRoot: string }>;
            Reshade: (payload: { fivemPath: string }) => Promise<string>;
            deleteModFolders: (payload: { fivemPath: string }) => Promise<boolean>;
            getInstalledMods: (payload: { fivemPath?: string }) => Promise<any[]>;
            uninstallMod: (payload: { id: string; files?: string[]; fivemPath?: string }) => Promise<boolean>;
            installLocalMod: (payload: { sourcePath: string; targetFivemPath: string }) => Promise<{ modId: string; fileName: string; destinationPath: string; installedFiles: string[] }>;
            onDownloadProgress: (callback: (data: {
                downloadId: string;
                progress: number;
                modName: string;
                downloadedBytes: number;
                totalBytes: number;
                speed: number;
                status: string;
                chunks?: number;
                _clear?: boolean;
            }) => void) => () => void;
            onAuthSuccess: (callback: (token: string) => void) => () => void;
            minimizeWindow: () => void;
            maximizeWindow: () => void;
            closeWindow: () => void;
            getActiveDownloads: () => Promise<any[]>;
            cancelDownload: (downloadId?: string) => Promise<boolean>;
            getDiskSpace: (targetPath: string) => Promise<{ free: number; total: number }>;
            onUpdateStatus: (callback: (status: any) => void) => () => void;
            onUpdateAvailable: (callback: (data: any) => void) => () => void;
            onUpdateNotAvailable: (callback: (data: any) => void) => () => void;
            onUpdateDownloaded: (callback: (data: any) => void) => () => void;
            onForceUpdate: (callback: (data: any) => void) => () => void;
            checkForUpdates: () => Promise<any>;
            downloadUpdate: () => Promise<void>;
            installUpdate: () => Promise<void>;
            getUpdateStatus: () => Promise<any>;
            canDownloadMods: () => Promise<boolean>;
            getAppVersion: () => Promise<{ version: string; build: number }>;
        };
    }
}