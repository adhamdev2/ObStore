const fs = require('fs');
let c = fs.readFileSync('app/lib/DownloadContext.tsx', 'utf8');
if (c.includes('force-refresh-mods')) {
    console.log('Already patched!');
} else {
    c = c.replace(
        /status: 'finished', progress: 100 \}\r?\n\s*\}\)\);/g,
        `status: 'finished', progress: 100 }
            }));
            window.dispatchEvent(new Event("force-refresh-mods"));`
    );
    fs.writeFileSync('app/lib/DownloadContext.tsx', c);
    console.log('Patched DownloadContext');
}
