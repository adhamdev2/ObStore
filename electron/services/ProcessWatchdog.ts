import { ChildProcess, execFile, spawn } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export type WatchdogOptions = {
    executablePath: string;
    args?: string[];
    pollIntervalMs?: number;
    onExit?: (reason: "exit" | "crash" | "stopped") => void;
};

export class ProcessWatchdog {
    private child: ChildProcess | null = null;
    private timer: NodeJS.Timeout | null = null;
    private stopping = false;
    private exitNotified = false;

    async isRunning(): Promise<boolean> {
        const pid = this.child?.pid;
        return Boolean(pid && await isProcessRunning(pid));
    }

    async launch(options: WatchdogOptions): Promise<number> {
        if (this.child) throw new Error("FiveM is already running");
        this.stopping = false;
        this.exitNotified = false;
        this.child = spawn(options.executablePath, options.args ?? [], { detached: false, windowsHide: true, stdio: "ignore" });
        const child = this.child;
        const notifyExit = (reason: "exit" | "crash" | "stopped") => {
            if (this.exitNotified) return;
            this.exitNotified = true;
            options.onExit?.(reason);
        };
        child.once("error", () => notifyExit("crash"));
        child.once("exit", (_code, signal) => {
            this.stopPolling();
            this.child = null;
            notifyExit(this.stopping ? "stopped" : signal === null ? "exit" : "crash");
        });
        this.startPolling(options.pollIntervalMs ?? 1000, notifyExit);
        return await new Promise<number>((resolve, reject) => {
            child.once("spawn", () => resolve(child.pid ?? 0));
            child.once("error", reject);
        });
    }

    async stop(): Promise<void> {
        this.stopping = true;
        this.stopPolling();
        if (!this.child?.pid) return;
        this.child.kill();
        this.child = null;
    }

    private startPolling(intervalMs: number, onExit?: (reason: "exit" | "crash" | "stopped") => void): void {
        this.stopPolling();
        this.timer = setInterval(async () => {
            if (!this.child?.pid) return;
            if (!(await isProcessRunning(this.child.pid))) {
                this.stopPolling();
                this.child = null;
                onExit?.("crash");
            }
        }, intervalMs);
        this.timer.unref();
    }

    private stopPolling(): void {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    }
}

async function isProcessRunning(pid: number): Promise<boolean> {
    if (process.platform !== "win32") {
        try { process.kill(pid, 0); return true; } catch { return false; }
    }

    try {
        const { stdout } = await execFileAsync("tasklist.exe", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"]);
        return stdout.includes(`"${pid}"`);
    } catch {
        return false;
    }
}
