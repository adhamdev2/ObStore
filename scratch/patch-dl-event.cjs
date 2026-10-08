const fs = require('fs');
let c = fs.readFileSync('app/lib/DownloadContext.tsx', 'utf8');
c = c.replace(
    /\[downloadId\]: \{ \.\.\.prev\[downloadId\], status: 'finished', progress: 100 \}\r?\n\s+\}\)\);\r?\n\s+setTimeout/g,
    `[downloadId]: { ...prev[downloadId], status: 'finished', progress: 100 }
            }));
            window.dispatchEvent(new Event("force-refresh-mods"));
            setTimeout`
);
fs.writeFileSync('app/lib/DownloadContext.tsx', c);
console.log('Patched DownloadContext finished event');
