const fs = require('fs');
let c = fs.readFileSync('api/routes/updates.ts', 'utf8');

c = c.replace(/const file = require\("fs"\)\.createReadStream\(filePath, \{ start, end \}\);\n\s*file\.pipe\(res\);/g, `const file = require("fs").createReadStream(filePath, { start, end });
            file.on("error", (err) => {
                console.error("[Update] stream error:", err);
                if (!res.headersSent) res.status(500).end();
            });
            file.pipe(res);`);

c = c.replace(/const file = require\("fs"\)\.createReadStream\(filePath\);\n\s*file\.pipe\(res\);/g, `const file = require("fs").createReadStream(filePath);
            file.on("error", (err) => {
                console.error("[Update] stream error:", err);
                if (!res.headersSent) res.status(500).end();
            });
            file.pipe(res);`);

fs.writeFileSync('api/routes/updates.ts', c);
