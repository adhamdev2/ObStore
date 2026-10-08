import path from "path"
import { rm } from "fs/promises"
import { runHiddenExecutable } from "../utils/exec.js"
import { pathExists, findDirectoryByName, copyDirectoryContents, hideWindowsPath } from "../utils/fs.js"

const MOD_DIRECTORIES = ["mods", "plugins", "citizen"] as const

export async function extractArchiveWindows(archiveFilePath: string, destinationPath: string): Promise<void> {
    const archiveExtension = path.extname(archiveFilePath).toLowerCase()
    const powershellPath = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe")

    if (archiveExtension === ".zip") {
        await runHiddenExecutable(powershellPath, [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            `Expand-Archive -LiteralPath '${archiveFilePath.replace(/'/g, "''")}' -DestinationPath '${destinationPath.replace(/'/g, "''")}' -Force`
        ])
        return
    }

    const extractorCandidates = [
        {
            executable: path.join(process.env.ProgramFiles || "C:\\Program Files", "7-Zip", "7z.exe"),
            args: ["x", archiveFilePath, `-o${destinationPath}`, "-y"]
        },
        {
            executable: path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "7-Zip", "7z.exe"),
            args: ["x", archiveFilePath, `-o${destinationPath}`, "-y"]
        },
        {
            executable: path.join(process.env.ProgramFiles || "C:\\Program Files", "WinRAR", "WinRAR.exe"),
            args: ["x", "-o+", archiveFilePath, `${destinationPath}\\`]
        },
        {
            executable: path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "WinRAR", "WinRAR.exe"),
            args: ["x", "-o+", archiveFilePath, `${destinationPath}\\`]
        }
    ]

    for (const candidate of extractorCandidates) {
        if (!(await pathExists(candidate.executable))) {
            continue
        }

        await runHiddenExecutable(candidate.executable, candidate.args)
        return
    }

    throw new Error(`Unsupported archive format "${archiveExtension}". Install 7-Zip/WinRAR or provide a .zip archive.`)
}

export async function installExtractedModDirectories(extractedRootPath: string, installDirectories: string[], skipDeletion: boolean = false): Promise<string[]> {
    console.log(`[Archive Service] Starting installation from: ${extractedRootPath}`);
    console.log(`[Archive Service] Target directories:`, installDirectories);

    if (installDirectories.length === 0) {
        console.warn("[Archive Service] No install directories provided!");
        return [];
    }

    let allCopiedFiles: string[] = [];
    let foundAnyDir = false;
 
    for (const [index, folderName] of MOD_DIRECTORIES.entries()) {
        const sourceDirectory = await findDirectoryByName(extractedRootPath, folderName)
        const destinationDirectory = installDirectories[index]
 
        if (!sourceDirectory || !destinationDirectory) {
            console.log(`[Archive Service] Skipping ${folderName}: ${!sourceDirectory ? "not found in archive" : "no target path provided"}`);
            continue;
        }
        
        console.log(`[Archive Service] Found ${folderName} at ${sourceDirectory}. Installing to ${destinationDirectory}`);
        foundAnyDir = true;
 
        if (!skipDeletion) {
            console.log(`[Archive Service] Cleaning destination: ${destinationDirectory}`);
            await rm(destinationDirectory, { recursive: true, force: true })
        }
 
        const copied = await copyDirectoryContents(sourceDirectory, destinationDirectory)
        console.log(`[Archive Service] Copied ${copied.length} files to ${destinationDirectory}`);
        allCopiedFiles = allCopiedFiles.concat(copied);
        await hideWindowsPath(destinationDirectory)
    }

    if (!foundAnyDir) {
        console.log("[Archive Service] No standard folders (mods/plugins/citizen) found. Triggering fallback to primary mods directory.");
        // If the archive doesn't have mods/plugins/citizen folders, copy its contents directly into the mods directory
        const modsDestination = installDirectories[0];
        if (modsDestination) {
            console.log(`[Archive Service] Copying all contents directly to: ${modsDestination}`);
            const copied = await copyDirectoryContents(extractedRootPath, modsDestination);
            console.log(`[Archive Service] Fallback copied ${copied.length} files.`);
            allCopiedFiles = allCopiedFiles.concat(copied);
        } else {
            console.error("[Archive Service] Fallback failed: No primary mods destination provided.");
        }
    }

    console.log(`[Archive Service] Installation finished. Total files: ${allCopiedFiles.length}`);
    return allCopiedFiles;
}

