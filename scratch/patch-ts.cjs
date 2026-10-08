const fs = require('fs');

let c = fs.readFileSync('electron/ipc/index.ts', 'utf8');

c = c.replace(
    /payload: \{ files: \{ url: string; fileName: string; size: number \}\[\]; targetPath: string; modId\?: string; modName\?: string; type\?: "version" \| "modpack"; targetSubDir\?: string \}\) => \{/,
    'payload: { files: { url: string; fileName: string; size: number }[]; targetPath: string; modId?: string; modName?: string; type?: "version" | "modpack"; targetSubDir?: string; downloadId?: string }) => {'
);

fs.writeFileSync('electron/ipc/index.ts', c, 'utf8');
console.log('Patched TS error');
