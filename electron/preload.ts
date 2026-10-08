import { contextBridge, ipcRenderer } from "electron"

contextBridge.exposeInMainWorld("electron", {
    version: process.versions.electron,
    selectFolder: (defaultPath?: string) => ipcRenderer.invoke("select-folder", defaultPath),
    selectFile: (options?: { extensions?: string[] }) => ipcRenderer.invoke("select-file", options),
    selectFiveMExe: () => ipcRenderer.invoke("select-fivem-exe"),
    getAutoFiveMPath: () => ipcRenderer.invoke("get-auto-fivem-path"),
    pathExists: (targetPath: string) => ipcRenderer.invoke("path-exists", targetPath),
    getHwid: () => ipcRenderer.invoke("get-hwid"),
    saveModStub: (payload: { modId: string; licenseKey: string; version: string; type?: string }) => ipcRenderer.invoke("save-mod-stub", payload),
    readModStub: (modId: string, type?: string) => ipcRenderer.invoke("read-mod-stub", modId, type),
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
        downloadId?: string 
    }) => ipcRenderer.invoke("download-mod-archive", payload),
    downloadRpfFiles: (payload: { 
        files: { url: string; fileName: string; size: number }[]; 
        targetPath: string; 
        modId?: string;
        modName?: string; 
        type?: string;
        targetSubDir?: string;
        downloadId?: string 
    }) => ipcRenderer.invoke("download-rpf-files", payload),
    launchFiveMFlow: (payload: { fivemPath: string; toolPath: string; input: string }) =>
        ipcRenderer.invoke("launch-fivem-flow", payload),
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
    }) => ipcRenderer.invoke("launch-secure-fivem", payload),
    Reshade: (payload: { fivemPath: string }) =>
        ipcRenderer.invoke("Reshade", payload),
    changeReshadeKey: (payload: { fivemPath: string; keyCode: number }) =>
        ipcRenderer.invoke("change-reshade-key", payload),
    deleteModFolders: (payload: { fivemPath: string }) =>
        ipcRenderer.invoke("delete-mod-folders", payload),
    writeFile: (payload: { path: string; data: number[] }) =>
        ipcRenderer.invoke("write-file", payload),
    installDroppedFile: (payload: { fileName: string; data: number[]; targetFivemPath: string }) =>
        ipcRenderer.invoke("install-dropped-file", payload),
    getInstalledMods: (payload: { fivemPath?: string }) =>
        ipcRenderer.invoke("get-installed-mods", payload),
    exploreModFiles: (payload: { fivemPath: string }) =>
        ipcRenderer.invoke("explore-mod-files", payload),
    deleteModFile: (payload: { fivemPath: string; filePath: string }) =>
        ipcRenderer.invoke("delete-mod-file", payload),
    uninstallMod: (payload: { id: string; files?: string[]; fivemPath?: string }) =>
        ipcRenderer.invoke("uninstall-mod", payload),
    installLocalMod: (payload: { sourcePath: string; targetFivemPath: string }) =>
        ipcRenderer.invoke("install-local-mod", payload),
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
    }) => void) => {
        const listener = (_event: any, data: any) => callback(data);
        ipcRenderer.on("download-progress", listener);
        return () => ipcRenderer.removeListener("download-progress", listener);
    },
    onAuthSuccess: (callback: (token: string) => void) => {
        const listener = (_event: any, token: string) => callback(token);
        ipcRenderer.on("auth-success", listener);
        return () => ipcRenderer.removeListener("auth-success", listener);
    },
    minimizeWindow: () => ipcRenderer.send("window-minimize"),
    maximizeWindow: () => ipcRenderer.send("window-maximize"),
    closeWindow: () => ipcRenderer.send("window-close"),
    getActiveDownloads: () => ipcRenderer.invoke("get-active-downloads"),
    cancelDownload: (downloadId?: string) => ipcRenderer.invoke("cancel-download", downloadId),
    getDiskSpace: (targetPath: string) => ipcRenderer.invoke("get-disk-space", targetPath),
    onUpdateStatus: (callback: (status: any) => void) => {
        const listener = (_event: any, status: any) => callback(status);
        ipcRenderer.on("update-status", listener);
        return () => ipcRenderer.removeListener("update-status", listener);
    },
    onUpdateAvailable: (callback: (data: any) => void) => {
        const listener = (_event: any, data: any) => callback(data);
        ipcRenderer.on("update-update-available", listener);
        return () => ipcRenderer.removeListener("update-update-available", listener);
    },
    onUpdateNotAvailable: (callback: (data: any) => void) => {
        const listener = (_event: any, data: any) => callback(data);
        ipcRenderer.on("update-update-not-available", listener);
        return () => ipcRenderer.removeListener("update-update-not-available", listener);
    },
    onUpdateDownloaded: (callback: (data: any) => void) => {
        const listener = (_event: any, data: any) => callback(data);
        ipcRenderer.on("update-update-downloaded", listener);
        return () => ipcRenderer.removeListener("update-update-downloaded", listener);
    },
    onForceUpdate: (callback: (data: any) => void) => {
        const listener = (_event: any, data: any) => callback(data);
        ipcRenderer.on("update-force-update", listener);
        return () => ipcRenderer.removeListener("update-force-update", listener);
    },
    checkForUpdates: () => ipcRenderer.invoke("update:check"),
    downloadUpdate: () => {
        console.log("[Preload] downloadUpdate called");
        return ipcRenderer.invoke("update:download");
    },
    installUpdate: () => ipcRenderer.invoke("update:install"),
    getUpdateStatus: () => ipcRenderer.invoke("update:get-status"),
    canDownloadMods: () => ipcRenderer.invoke("update:can-download-mods"),
    getAppVersion: () => ipcRenderer.invoke("update:get-version"),
})
