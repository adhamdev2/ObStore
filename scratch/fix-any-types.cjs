const fs = require('fs');
let c = fs.readFileSync('api/routes/updates.ts', 'utf8');

c = c.replace(/\.on\("error", \(err\) =>/g, '.on("error", (err: any) =>');

fs.writeFileSync('api/routes/updates.ts', c);

let c2 = fs.readFileSync('api/routes/modDownloads.ts', 'utf8');
c2 = c2.replace(/\.on\("error", \(err\) =>/g, '.on("error", (err: any) =>');
fs.writeFileSync('api/routes/modDownloads.ts', c2);
