import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("splashBridge", {
    onProgress: (cb: (data: { progress: number; message: string; version?: string }) => void) => {
        const handler = (_: any, data: any) => cb(data);
        ipcRenderer.on("splash-progress", handler);
        return () => ipcRenderer.removeListener("splash-progress", handler);
    }
});
