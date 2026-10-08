import fs from "fs/promises";
import path from "path";
import { getDataPath } from "./paths";

export class JsonDatabase<T extends Record<string, any>, K extends keyof T> {
    private readonly filePath: string;
    private readonly idField: K;
    private memoryMap: Map<string, T> = new Map();
    private isInitialized = false;
    private isDirty = false;

    constructor(filename: string, idField: K) {
        this.filePath = getDataPath(filename);
        this.idField = idField;

        // Auto-save loop to guarantee high disk performance without blocking the main event thread
        setInterval(() => {
            if (this.isDirty) {
                this.saveToDisk().catch(e => console.error("DB Flush Error:", e));
            }
        }, 3000); // Flush every 3 seconds if changes occurred
    }

    async init(): Promise<void> {
        if (this.isInitialized) return;

        try {
            const dir = path.dirname(this.filePath);
            await fs.mkdir(dir, { recursive: true });

            try {
                const fileContent = await fs.readFile(this.filePath, "utf-8");
                const data = JSON.parse(fileContent) as T[];
                for (const item of data) {
                    this.memoryMap.set(String(item[this.idField]), item);
                }
            } catch (err: any) {
                if (err.code !== "ENOENT") throw err;
                // If it doesn't exist, we start with a clean map
            }
            this.isInitialized = true;
        } catch (error) {
            console.error(`Failed to initialize Fast JSON DB at ${this.filePath}`, error);
            throw error;
        }
    }

    private async saveToDisk() {
        this.isDirty = false; // reset immediately to prevent race conditions tracking new edits
        const dataArr = Array.from(this.memoryMap.values());
        try {
            // Write to a temporary file then rename to avoid corruption if the process crashes midway
            const tempFile = `${this.filePath}.tmp`;
            await fs.writeFile(tempFile, JSON.stringify(dataArr, null, 4), "utf-8");
            await fs.rename(tempFile, this.filePath);
        } catch (e) {
            this.isDirty = true; // Retry next cycle
            throw e;
        }
    }

    async findAll(): Promise<T[]> {
        await this.init();
        return Array.from(this.memoryMap.values());
    }

    async findOne(predicate: (item: T) => boolean): Promise<T | null> {
        await this.init();
        for (const item of this.memoryMap.values()) {
            if (predicate(item)) return item;
        }
        return null;
    }

    async findById(idValue: T[K]): Promise<T | null> {
        await this.init();
        return this.memoryMap.get(String(idValue)) || null;
    }

    async insert(item: T): Promise<T> {
        await this.init();
        const idStr = String(item[this.idField]);

        if (this.memoryMap.has(idStr)) {
            throw new Error(`Item with ${String(this.idField)} '${idStr}' already exists.`);
        }

        this.memoryMap.set(idStr, item);
        this.isDirty = true;
        return item;
    }

    async update(idValue: T[K], updates: Partial<T>): Promise<T | null> {
        await this.init();
        const idStr = String(idValue);
        
        const existing = this.memoryMap.get(idStr);
        if (!existing) return null;

        const updated = { ...existing, ...updates };
        this.memoryMap.set(idStr, updated);
        this.isDirty = true;
        return updated;
    }

    async delete(idValue: T[K]): Promise<boolean> {
        await this.init();
        const idStr = String(idValue);
        
        if (this.memoryMap.has(idStr)) {
            this.memoryMap.delete(idStr);
            this.isDirty = true;
            return true;
        }
        return false;
    }
}
