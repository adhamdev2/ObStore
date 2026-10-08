const fs = require('fs');
let c = fs.readFileSync('api/routes/modDownloads.ts', 'utf8');

c = c.replace(/const stream = fsSync\.createReadStream\(archivePath, \{ start, end \}\);\n\s*stream\.pipe\(res\);/g, `const stream = fsSync.createReadStream(archivePath, { start, end });
            stream.on("error", (err) => {
                console.error("[Download] stream error:", err);
                if (!res.headersSent) res.status(500).end();
            });
            stream.pipe(res);`);

c = c.replace(/const stream = fsSync\.createReadStream\(archivePath\);\n\s*stream\.pipe\(res\);/g, `const stream = fsSync.createReadStream(archivePath);
        stream.on("error", (err) => {
            console.error("[Download] stream error:", err);
            if (!res.headersSent) res.status(500).end();
        });
        stream.pipe(res);`);

fs.writeFileSync('api/routes/modDownloads.ts', c);
