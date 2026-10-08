const fs = require('fs');
const file = 'd:/AW-PROJECTS/fivemModes/electron/ipc/index.ts';
let content = fs.readFileSync(file, 'utf8');

const regex = /event\.sender\.send\("download-progress", \{[\s\S]*?status: "extracting"\s*\}\);/;
const repl = `event.sender.send("download-progress", {
            downloadId,
            progress: 100,
            modName: payload?.modName,
            downloadedBytes: totalBytes,
            totalBytes: totalBytes,
            speed: 0,
            status: "extracting"
        });`;

content = content.replace(regex, repl);
fs.writeFileSync(file, content);
console.log('Done');
