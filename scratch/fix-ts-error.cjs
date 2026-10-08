const fs = require('fs');
let c = fs.readFileSync('api/routes/modDownloads.ts', 'utf8');

c = c.replace(/archive\.on\("error", \(err\) => \{/g, 'archive.on("error", (err: any) => {');
c = c.replace(/output\.on\("error", \(err\) => \{/g, 'output.on("error", (err: any) => {');
c = c.replace(/\.catch\(\(err\) => \{/g, '.catch((err: any) => {');

fs.writeFileSync('api/routes/modDownloads.ts', c);
