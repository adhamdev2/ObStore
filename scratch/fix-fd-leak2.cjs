const fs = require('fs');
let c = fs.readFileSync('api/routes/modDownloads.ts', 'utf8');

c = c.replace(/await new Promise<void>\(\(resolve, reject\) => \{[\s\S]*?const archive = archiver[\s\S]*?archive\.pipe\(output\);[\s\S]*?archive\.on\("error", reject\);[\s\S]*?output\.on\("error", reject\);[\s\S]*?output\.on\("close", resolve\);[\s\S]*?void addFilesToArchive\(archive, archiveInfo\)\.catch\(reject\);[\s\S]*?\}\);/m, `await new Promise<void>((resolve, reject) => {
            const archive = archiver("zip", { zlib: { level: 0 }, statConcurrency: 4 });
            const output = fsSync.createWriteStream(tmpPath);
            archive.pipe(output);
            
            const cleanup = () => {
                if (!output.closed && !output.destroyed) {
                    output.destroy();
                }
            };

            archive.on("error", (err) => { cleanup(); reject(err); });
            output.on("error", (err) => { cleanup(); reject(err); });
            output.on("close", resolve);
            
            void addFilesToArchive(archive, archiveInfo).catch((err) => {
                cleanup();
                reject(err);
            });
        });`);

fs.writeFileSync('api/routes/modDownloads.ts', c);
