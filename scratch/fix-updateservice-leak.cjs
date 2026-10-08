const fs = require('fs');
let c = fs.readFileSync('api/services/updateService.ts', 'utf8');

c = c.replace(/stream\.on\("error", reject\);/g, `stream.on("error", (err) => {
            stream.destroy();
            reject(err);
        });`);

fs.writeFileSync('api/services/updateService.ts', c);
