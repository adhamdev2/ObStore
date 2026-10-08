import crypto from "crypto";
import fs from "fs";
import path from "path";
import { mkdir, open, rm, writeFile } from "fs/promises";
import os from "os";
import { promisify } from "util";
import { execFile } from "child_process";

const execFileAsync = promisify(execFile);
const activeSessions = new Set<string>();
const activeHandles = new Set<fs.promises.FileHandle>();
const activeJunctions = new Set<string>();

export type AesGcmEnvelope = {
    ciphertext: Buffer;
    iv: Buffer;
    authTag: Buffer;
};

export type SecureSession = {
    root: string;
    files: Set<string>;
};

function assertKey(key: Buffer): void {
    if (key.length !== 32) throw new Error("AES-256-GCM requires a 32-byte key");
}

function safeChild(root: string, relativePath: string): string {
    const resolvedRoot = path.resolve(root);
    const resolvedFile = path.resolve(root, relativePath);
    if (resolvedFile !== resolvedRoot && !resolvedFile.startsWith(`${resolvedRoot}${path.sep}`)) {
        throw new Error("Refusing path traversal outside secure session");
    }
    return resolvedFile;
}

export function decryptAes256Gcm(envelope: AesGcmEnvelope, key: Buffer, aad?: Buffer): Buffer {
    assertKey(key);
    if (envelope.iv.length !== 12) throw new Error("AES-GCM IV must be 12 bytes");
    if (envelope.authTag.length !== 16) throw new Error("AES-GCM auth tag must be 16 bytes");

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, envelope.iv);
    if (aad) decipher.setAAD(aad);
    decipher.setAuthTag(envelope.authTag);
    return Buffer.concat([decipher.update(envelope.ciphertext), decipher.final()]);
}

export async function createSecureSession(prefix = "ob1_sec_"): Promise<SecureSession> {
    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), prefix));
    activeSessions.add(root);
    await hideDirectory(root);
    return { root, files: new Set<string>() };
}

export async function writeSecureFile(session: SecureSession, relativePath: string, data: Buffer): Promise<string> {
    const target = safeChild(session.root, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data, { flag: "wx" });
    session.files.add(target);
    await hideFile(target);
    return target;
}

export async function writeRuntimeFile(session: SecureSession, targetRoot: string, relativePath: string, data: Buffer): Promise<string> {
    const target = safeChild(targetRoot, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    try {
        await fs.promises.access(target);
        throw new Error(`Refusing to overwrite existing runtime file: ${relativePath}`);
    } catch (error: any) {
        if (error?.code !== "ENOENT") throw error;
    }
    await writeFile(target, data, { flag: "wx" });
    session.files.add(target);
    await hideFile(target);
    return target;
}

export async function createJunction(source: string, junctionPath: string): Promise<void> {
    if (process.platform !== "win32") throw new Error("Junction staging is supported on Windows only");
    await mkdir(path.dirname(junctionPath), { recursive: true });
    await execFileAsync("cmd.exe", ["/d", "/c", "mklink", "/J", junctionPath, source]);
    activeJunctions.add(junctionPath);
}

export async function removeJunction(junctionPath: string): Promise<void> {
    try {
        if (process.platform === "win32") await execFileAsync("cmd.exe", ["/d", "/c", "rmdir", junctionPath], { windowsHide: true });
    } catch { }
    activeJunctions.delete(junctionPath);
}

export async function holdExclusiveReadHandle(filePath: string): Promise<fs.promises.FileHandle> {
    const handle = await open(filePath, "r");
    activeHandles.add(handle);
    return handle;
}

export async function cleanupSecureSession(session: SecureSession): Promise<void> {
    activeSessions.delete(session.root);
    for (const handle of activeHandles) {
        await handle.close().catch(() => undefined);
        activeHandles.delete(handle);
    }
    for (const filePath of session.files) {
        try {
            const handle = await open(filePath, "r+");
            await handle.close();
        } catch { }
    }
    await rm(session.root, { recursive: true, force: true }).catch(() => undefined);
}

export async function cleanupAllSecureSessions(): Promise<void> {
    await Promise.all([...activeJunctions].map(removeJunction));
    for (const handle of activeHandles) {
        await handle.close().catch(() => undefined);
        activeHandles.delete(handle);
    }
    await Promise.all([...activeSessions].map(root => rm(root, { recursive: true, force: true }).catch(() => undefined)));
    activeSessions.clear();
}

async function hideDirectory(directory: string): Promise<void> {
    if (process.platform !== "win32") return;
    await execFileAsync("attrib.exe", ["+h", directory]).catch(() => undefined);
}

async function hideFile(filePath: string): Promise<void> {
    if (process.platform !== "win32") return;
    await execFileAsync("attrib.exe", ["+h", filePath]).catch(() => undefined);
}

export function createCleanupHandlers(): void {
    const cleanup = () => { void cleanupAllSecureSessions(); };
    process.once("SIGINT", cleanup);
    process.once("SIGTERM", cleanup);
    process.once("exit", () => { for (const root of activeSessions) fs.rmSync(root, { recursive: true, force: true }); });
    process.on("uncaughtException", error => { console.error("[SecurityManager] Uncaught exception:", error); cleanup(); });
    process.on("unhandledRejection", reason => { console.error("[SecurityManager] Unhandled rejection:", reason); cleanup(); });
}

/**
 * Secure deletion cannot be guaranteed on SSDs, journaled filesystems, snapshots,
 * or after an abrupt power loss. This only removes the live directory entries.
 */

