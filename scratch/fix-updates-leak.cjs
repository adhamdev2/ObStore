const fs = require('fs');
let c = fs.readFileSync('api/routes/updates.ts', 'utf8');

c = c.replace(/file\.pipe\(res\);/g, `file.pipe(res);
            req.on("close", () => {
                if (!file.destroyed) file.destroy();
            });`);

c = c.replace(/require\("fs"\)\.createReadStream\(filePath, \{ start, end \}\)\.pipe\(res\);/g, `const file = require("fs").createReadStream(filePath, { start, end });
            file.pipe(res);
            req.on("close", () => {
                if (!file.destroyed) file.destroy();
            });`);

c = c.replace(/require\("fs"\)\.createReadStream\(filePath\)\.pipe\(res\);/g, `const file = require("fs").createReadStream(filePath);
            file.pipe(res);
            req.on("close", () => {
                if (!file.destroyed) file.destroy();
            });`);

fs.writeFileSync('api/routes/updates.ts', c);
