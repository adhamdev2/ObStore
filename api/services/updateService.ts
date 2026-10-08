import fs from "fs";
import path from "path";
import { getDataPath } from "../lib/paths";
import { config } from "../lib/config";

export interface UpdateInfo {
    version: string;
    build: number;
    releaseDate: string;
    changelog?: string;
    mandatory: boolean;
    fileSize: number;
    sha256?: string;
    sha512?: string;
}

export interface UpdateManifest {
    current: UpdateInfo | null;
    history: UpdateInfo[];
}

export interface SquirrelReleaseFiles {
    releases: string;
    packages: Array<{
        packageName: string;
        packageBuffer: Buffer;
    }>;
}

const UPDATE_DIR = getDataPath("updates");
const MANIFEST_FILE = path.join(UPDATE_DIR, "manifest.json");
const CURRENT_FILE = path.join(UPDATE_DIR, "app.exe");
const SQUIRREL_DIR = path.join(UPDATE_DIR, "win32");
const SQUIRREL_RELEASES_FILE = path.join(SQUIRREL_DIR, "RELEASES");

function ensureUpdateDir(): void {
    if (!fs.existsSync(UPDATE_DIR)) {
        fs.mkdirSync(UPDATE_DIR, { recursive: true });
    }
}

function loadManifest(): UpdateManifest {
    ensureUpdateDir();
    if (fs.existsSync(MANIFEST_FILE)) {
        try {
            const data = fs.readFileSync(MANIFEST_FILE, "utf-8");
            return JSON.parse(data);
        } catch {
            return { current: null, history: [] };
        }
    }
    return { current: null, history: [] };
}

function saveManifest(manifest: UpdateManifest): void {
    ensureUpdateDir();
    fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2), "utf-8");
}

function extractBuild(version: string): number {
    const parts = version.split(".");
    return parseInt(parts[parts.length - 1]) || 0;
}

function compareVersions(left: string, right: string): number | null {
    const versionPattern = /^(\d+)\.(\d+)\.(\d+)$/;
    const leftMatch = versionPattern.exec(left);
    const rightMatch = versionPattern.exec(right);
    if (!leftMatch || !rightMatch) return null;

    for (let index = 1; index <= 3; index++) {
        const difference = Number(leftMatch[index]) - Number(rightMatch[index]);
        if (difference !== 0) return difference > 0 ? 1 : -1;
    }
    return 0;
}

function computeSha256(filePath: string): Promise<string> {
    const crypto = require("crypto");
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    return new Promise<string>((resolve, reject) => {
        stream.on("data", (chunk: Buffer | string) => {
            const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            hash.update(data);
        });
        stream.on("end", () => resolve(hash.digest("hex")));
        stream.on("error", (err) => {
            stream.destroy();
            reject(err);
        });
    });
}

export const updateService = {
    async saveUpdate(
        fileBuffer: Buffer,
        version: string,
        squirrelFiles: SquirrelReleaseFiles,
        changelog?: string,
    ): Promise<UpdateInfo> {
        ensureUpdateDir();

        const manifest = loadManifest();
        const publishedVersions = [manifest.current?.version, ...(manifest.history || []).map((release) => release.version)]
            .filter((releaseVersion): releaseVersion is string => typeof releaseVersion === "string");
        let highestPublishedVersion: string | null = null;
        for (const releaseVersion of publishedVersions) {
            if (!highestPublishedVersion || compareVersions(releaseVersion, highestPublishedVersion) === 1) {
                highestPublishedVersion = releaseVersion;
            }
        }

        const versionComparison = highestPublishedVersion ? compareVersions(version, highestPublishedVersion) : 1;
        if (versionComparison !== 1) {
            throw new Error(`Release version ${version} must be greater than the highest published version ${highestPublishedVersion}`);
        }

        const releaseEntries = squirrelFiles.releases
            .split(/\r?\n/)
            .map((line) => line.trim().split(/\s+/))
            .filter((parts) => parts.length >= 3 && parts[1].endsWith(".nupkg"));
        if (releaseEntries.length === 0) {
            throw new Error("The RELEASES file does not contain any Squirrel packages");
        }

        const packageByName = new Map(squirrelFiles.packages.map((item) => [item.packageName, item.packageBuffer]));
        if (packageByName.size !== releaseEntries.length) {
            throw new Error("Every package referenced by RELEASES must be uploaded");
        }

        for (const [expectedSha1, packageName, sizeValue] of releaseEntries) {
            if (!/^[A-Za-z0-9_.-]+\.nupkg$/.test(packageName)) {
                throw new Error("Invalid Squirrel package filename in RELEASES");
            }

            const packageBuffer = packageByName.get(packageName);
            if (!packageBuffer) {
                throw new Error(`Squirrel package referenced by RELEASES was not uploaded: ${packageName}`);
            }

            const packageSha1 = require("crypto").createHash("sha1").update(packageBuffer).digest("hex");
            const expectedSize = Number.parseInt(sizeValue, 10);
            if (expectedSha1.toLowerCase() !== packageSha1 || expectedSize !== packageBuffer.length) {
                throw new Error(`Uploaded Squirrel package does not match RELEASES checksum or size: ${packageName}`);
            }
        }

        fs.mkdirSync(SQUIRREL_DIR, { recursive: true });
        for (const [packageName, packageBuffer] of packageByName) {
            fs.writeFileSync(path.join(SQUIRREL_DIR, packageName), packageBuffer);
        }
        fs.writeFileSync(SQUIRREL_RELEASES_FILE, squirrelFiles.releases, "utf-8");
        
        const build = extractBuild(version);
        const releaseDate = new Date().toISOString();
        const fileSize = fileBuffer.length;
        const sha256 = require("crypto").createHash("sha256").update(fileBuffer).digest("hex");
        const sha512 = require("crypto").createHash("sha512").update(fileBuffer).digest("base64");
        
        const mandatory = build >= 3; // Will be compared with client's build
        
        const updateInfo: UpdateInfo = {
            version,
            build,
            releaseDate,
            changelog,
            mandatory: false, // Will be determined per-client
            fileSize,
            sha256,
            sha512,
        };
        
        // Write file
        fs.writeFileSync(CURRENT_FILE, fileBuffer);
        
        // Update manifest
        manifest.current = updateInfo;
        manifest.history.unshift(updateInfo);
        // Keep last 20 versions
        manifest.history = manifest.history.slice(0, 20);
        saveManifest(manifest);
        
        return updateInfo;
    },
    
    getCurrent(): UpdateInfo | null {
        const manifest = loadManifest();
        return manifest.current;
    },
    
    getManifest(): UpdateManifest {
        return loadManifest();
    },
    
    getFilePath(): string {
        return CURRENT_FILE;
    },

    getSquirrelFeedFile(fileName: string): string | null {
        if (path.basename(fileName) !== fileName) return null;

        if (fileName === "RELEASES") {
            return fs.existsSync(SQUIRREL_RELEASES_FILE) ? SQUIRREL_RELEASES_FILE : null;
        }

        if (!/^[A-Za-z0-9_.-]+\.nupkg$/.test(fileName) || !fs.existsSync(SQUIRREL_RELEASES_FILE)) {
            return null;
        }

        try {
            const releases = fs.readFileSync(SQUIRREL_RELEASES_FILE, "utf-8");
            const packageIsPublished = releases
                .split(/\r?\n/)
                .some((line) => line.trim().split(/\s+/)[1] === fileName);
            const packagePath = path.join(SQUIRREL_DIR, fileName);
            return packageIsPublished && fs.existsSync(packagePath) ? packagePath : null;
        } catch {
            return null;
        }
    },
    
    fileExists(): boolean {
        return fs.existsSync(CURRENT_FILE);
    },
    
    getFileStats(): { size: number; modified: Date } | null {
        if (!fs.existsSync(CURRENT_FILE)) return null;
        const stats = fs.statSync(CURRENT_FILE);
        return { size: stats.size, modified: stats.mtime };
    },
    
    isMandatoryForClient(clientBuild: number): boolean {
        const current = this.getCurrent();
        if (!current) return false;
        return current.build - clientBuild >= 3;
    },
    
    getUpdateForClient(clientVersion: string, clientBuild: number): { hasUpdate: boolean; update: UpdateInfo | null; mandatory: boolean } {
        const current = this.getCurrent();
        if (!current) return { hasUpdate: false, update: null, mandatory: false };
        
        const versionComparison = compareVersions(current.version, clientVersion);
        const hasUpdate = versionComparison === null
            ? current.build > clientBuild
            : versionComparison > 0;
        const mandatory = current.build - clientBuild >= 3;
        
        return {
            hasUpdate,
            update: hasUpdate ? current : null,
            mandatory,
        };
    },
};

export default updateService;
