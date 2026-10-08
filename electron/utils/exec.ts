import { execFile } from "child_process"
import { promisify } from "util"

const execFileAsync = promisify(execFile)

export async function runHiddenExecutable(executable: string, args: string[]): Promise<void> {
    await execFileAsync(executable, args, {
        windowsHide: true,
    })
}
