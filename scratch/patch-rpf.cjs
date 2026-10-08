const fs = require('fs');

let c = fs.readFileSync('electron/ipc/index.ts', 'utf8');

c = c.replace(
    /const \{ files, targetPath, modName, targetSubDir = "mods" \} = payload;/,
    'const { files, targetPath, modName, targetSubDir = "mods", downloadId } = payload;'
);

c = c.replace(
    /event\.sender\.send\("download-progress", \{\r?\n\s+progress,\r?\n\s+modName: modName \|\| file\.fileName,\r?\n\s+downloadedBytes,\r?\n\s+totalBytes,\r?\n\s+speed\r?\n\s+\}\);/,
    `event.sender.send("download-progress", {
                            downloadId,
                            progress,
                            modName: modName || file.fileName,
                            downloadedBytes,
                            totalBytes,
                            speed,
                            chunks: 1,
                            status: "downloading"
                        });`
);

fs.writeFileSync('electron/ipc/index.ts', c, 'utf8');
console.log('Patched');
