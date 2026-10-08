const fs = require('fs');
let c = fs.readFileSync('api/routes/modDownloads.ts', 'utf8');

const t1 = `        await new Promise<void>((resolve, reject) => {
            const archive = archiver("zip", { zlib: { level: 0 }, statConcurrency: 4 });
            const output = fsSync.createWriteStream(tmpPath);
            archive.pipe(output);
            archive.on("error", reject);
            output.on("error", reject);
            output.on("close", resolve);
            void addFilesToArchive(archive, archiveInfo).catch(reject);
        });`;

const r1 = `        await new Promise<void>((resolve, reject) => {
            const archive = archiver("zip", { zlib: { level: 0 }, statConcurrency: 4 });
            const output = fsSync.createWriteStream(tmpPath);
            archive.pipe(output);
            
            const cleanup = () => {
                if (!output.closed) output.destroy();
            };

            archive.on("error", (err) => { cleanup(); reject(err); });
            output.on("error", (err) => { cleanup(); reject(err); });
            output.on("close", resolve);
            
            void addFilesToArchive(archive, archiveInfo).catch((err) => {
                cleanup();
                reject(err);
            });
        });`;

if(c.includes(t1)) {
    c = c.replace(t1, r1);
} else {
    console.log("Could not find t1 in modDownloads.ts");
}

const t2 = `const stream = fsSync.createReadStream(archivePath, { start, end });
            stream.pipe(res);`;

// Wait, the current code is `fsSync.createReadStream(archivePath, { start, end }).pipe(res);`
c = c.replace(/fsSync\.createReadStream\(archivePath, \{ start, end \}\)\.pipe\(res\);/g, `const stream = fsSync.createReadStream(archivePath, { start, end });
            stream.pipe(res);
            req.on("close", () => {
                if (!stream.destroyed) stream.destroy();
            });`);

c = c.replace(/fsSync\.createReadStream\(archivePath\)\.pipe\(res\);/g, `const stream = fsSync.createReadStream(archivePath);
        stream.pipe(res);
        req.on("close", () => {
            if (!stream.destroyed) stream.destroy();
        });`);

fs.writeFileSync('api/routes/modDownloads.ts', c);
