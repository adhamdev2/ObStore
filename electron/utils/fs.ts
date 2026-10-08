import path from "path"
import { access, copyFile, mkdir, readdir, stat } from "fs/promises"
import { runHiddenExecutable } from "./exec.js"

export function normalizeWindowsPath(targetPath: string): string {
    const trimmedPath = targetPath.trim().replace(/^["']+|["']+$/g, "")
    if (!trimmedPath) return ""
    return path.normalize(trimmedPath)
}

export async function pathExists(targetPath: string): Promise<boolean> {
    try {
        await access(targetPath)
        return true
    } catch {
        return false
    }
}

export async function resolveExistingPath(targetPath: string): Promise<string | null> {
    const normalizedPath = normalizeWindowsPath(targetPath)
    if (!normalizedPath) return null

    const candidatePaths = new Set<string>([normalizedPath])

    if (path.extname(normalizedPath)) {
        candidatePaths.add(path.dirname(normalizedPath))
    } else {
        candidatePaths.add(path.join(normalizedPath, "FiveM.exe"))
    }

    for (const candidatePath of candidatePaths) {
        if (await pathExists(candidatePath)) {
            return candidatePath
        }
    }

    return null
}

export async function hideWindowsPath(targetPath: string): Promise<void> {
    const attribPath = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "attrib.exe")
    await runHiddenExecutable(attribPath, ["+h", targetPath])
}

export async function copyDirectoryContents(sourceDirectory: string, destinationDirectory: string, copiedFiles: string[] = []): Promise<string[]> {
    console.log(`[FS Utils] Copying from ${sourceDirectory} to ${destinationDirectory}`);
    await mkdir(destinationDirectory, { recursive: true })
    const entries = await readdir(sourceDirectory)

    for (const entry of entries) {
        const sourceEntryPath = path.join(sourceDirectory, entry)
        const destinationEntryPath = path.join(destinationDirectory, entry)
        const sourceStats = await stat(sourceEntryPath)

        if (sourceStats.isDirectory()) {
            await copyDirectoryContents(sourceEntryPath, destinationEntryPath, copiedFiles)
            continue
        }

        await mkdir(path.dirname(destinationEntryPath), { recursive: true })
        await copyFile(sourceEntryPath, destinationEntryPath)
        copiedFiles.push(destinationEntryPath)
    }
    return copiedFiles;
}


export async function findDirectoryByName(rootPath: string, directoryName: string): Promise<string | null> {
    const directMatch = path.join(rootPath, directoryName)
    if (await pathExists(directMatch)) {
        console.log(`[FS Utils] Direct match found: ${directMatch}`);
        return directMatch
    }

    const entries = await readdir(rootPath)

    for (const entry of entries) {
        const entryPath = path.join(rootPath, entry)
        const entryStats = await stat(entryPath)

        if (!entryStats.isDirectory()) {
            continue
        }

        const nestedMatch = await findDirectoryByName(entryPath, directoryName)
        if (nestedMatch) {
            return nestedMatch
        }
    }
    return null
}

