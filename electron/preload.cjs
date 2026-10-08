const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  version: process.versions.electron,
  selectFolder: () => ipcRenderer.invoke("select-folder"),
  selectFile: (options) => ipcRenderer.invoke("select-file", options),
  selectFiveMExe: () => ipcRenderer.invoke("select-fivem-exe"),
  getAutoFiveMPath: () => ipcRenderer.invoke("get-auto-fivem-path"),
  pathExists: (targetPath) => ipcRenderer.invoke("path-exists", targetPath),
  getHwid: () => ipcRenderer.invoke("get-hwid"),
  saveModStub: (payload) => ipcRenderer.invoke("save-mod-stub", payload),
  readModStub: (modId, type) => ipcRenderer.invoke("read-mod-stub", modId, type),
    downloadModArchive: (payload) => ipcRenderer.invoke("download-mod-archive", payload),
    downloadRpfFiles: (payload) => ipcRenderer.invoke("download-rpf-files", payload),
    launchFiveMFlow: (payload) => ipcRenderer.invoke("launch-fivem-flow", payload),
    launchSecureFiveM: (payload) => ipcRenderer.invoke("launch-secure-fivem", payload),
    Reshade: (payload) => ipcRenderer.invoke("Reshade", payload),
    deleteModFolders: (payload) => ipcRenderer.invoke("delete-mod-folders", payload),
    getInstalledMods: (payload) => ipcRenderer.invoke("get-installed-mods", payload),
    uninstallMod: (payload) => ipcRenderer.invoke("uninstall-mod", payload),
    installLocalMod: (payload) => ipcRenderer.invoke("install-local-mod", payload),
    onDownloadProgress: (callback) => {
        const listener = (_event, data) => callback(data);
        ipcRenderer.on("download-progress", listener);
        return () => ipcRenderer.removeListener("download-progress", listener);
    },
    onAuthSuccess: (callback) => {
        const listener = (_event, token) => callback(token);
        ipcRenderer.on("auth-success", listener);
        return () => ipcRenderer.removeListener("auth-success", listener);
    },
    minimizeWindow: () => ipcRenderer.send("window-minimize"),
    maximizeWindow: () => ipcRenderer.send("window-maximize"),
    closeWindow: () => ipcRenderer.send("window-close"),
    getActiveDownloads: () => ipcRenderer.invoke("get-active-downloads"),
    cancelDownload: (downloadId) => ipcRenderer.invoke("cancel-download", downloadId),
    getDiskSpace: (targetPath) => ipcRenderer.invoke("get-disk-space", targetPath)
});
