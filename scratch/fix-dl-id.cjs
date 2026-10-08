const fs = require('fs');
let c = fs.readFileSync('app/lib/DownloadContext.tsx', 'utf8');
c = c.replace(
    /id: downloadId,\s+modId,\s+modName,\s+progress: 0,/g,
    'id: downloadId,\ndownloadId: downloadId,\nmodId,\nmodName,\nprogress: 0,'
);
fs.writeFileSync('app/lib/DownloadContext.tsx', c);
console.log('Patched DownloadContext initial state');
