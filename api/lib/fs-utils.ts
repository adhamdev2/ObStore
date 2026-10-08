import fs from "fs/promises";
import path from "path";

export async function getDirectorySize(
    dirPath: string, 
    excludePatterns: string[] = []
): Promise<number> {
    let size = 0;
    const files = await fs.readdir(dirPath, { withFileTypes: true });

    for (const file of files) {
        const isExcluded = excludePatterns.some(pattern => 
            file.name.toLowerCase().includes(pattern.toLowerCase())
        );
        
        if (isExcluded) continue;

        const filePath = path.join(dirPath, file.name);
        if (file.isDirectory()) {
            size += await getDirectorySize(filePath, excludePatterns);
        } else {
            const stats = await fs.stat(filePath);
            size += stats.size;
        }
    }
    return size;
}

export async function findRpfFiles(
    dirPath: string,
    basePath: string = dirPath
): Promise<{ relativePath: string; fileName: string; size: number }[]> {
    let rpfFiles: { relativePath: string; fileName: string; size: number }[] = [];
    const files = await fs.readdir(dirPath, { withFileTypes: true });

    for (const file of files) {
        const filePath = path.join(dirPath, file.name);
        
        if (file.isDirectory()) {
            rpfFiles = rpfFiles.concat(await findRpfFiles(filePath, basePath));
        } else if (file.name.toLowerCase().endsWith(".rpf") || file.name.toLowerCase().endsWith(".addon")) {
            const stats = await fs.stat(filePath);
            rpfFiles.push({
                relativePath: path.relative(basePath, filePath).replace(/\\/g, "/"),
                fileName: file.name,
                size: stats.size
            });
        }
    }
    
    return rpfFiles;
}
