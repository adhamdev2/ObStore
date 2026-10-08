import crypto from "crypto"
import os from "os"
import { execFile } from "child_process"
import { promisify } from "util"

const execFileAsync = promisify(execFile)

type HardwareSnapshot = {
    boardUuid?: string
    boardSerial?: string
    cpuId?: string
    cpuDescription?: string
    diskSerial?: string
    diskPnpId?: string
    machineGuid?: string
}

const PLACEHOLDERS = new Set([
    "unknown", "none", "null", "defaultstring", "systemserialnumber",
    "tobefilledbyo.e.m.", "tobefilledbyoem", "notspecified", "notavailable",
    "00000000", "0000000000000000", "ffffffff", "ffffffffffffffff", "0123456789abcdef",
])

function normalize(value: unknown): string {
    if (typeof value !== "string") return ""
    const compact = value.trim().replace(/\s+/g, "").toLowerCase()
    const comparable = value.trim().replace(/[\s_-]+/g, "").toLowerCase()
    if (!compact || PLACEHOLDERS.has(comparable) || /^(0+|f+)$/.test(compact)) return ""
    return compact
}

async function readWindowsSnapshot(): Promise<HardwareSnapshot> {
    // One PowerShell query is more reliable than several WMIC calls; WMIC is absent
    // on recent Windows installs. Failed WMI fields are returned as empty strings.
    const script = [
        "$ErrorActionPreference='SilentlyContinue'",
        "$cs=Get-CimInstance Win32_ComputerSystemProduct | Select-Object -First 1",
        "$bb=Get-CimInstance Win32_BaseBoard | Select-Object -First 1",
        "$cpu=Get-CimInstance Win32_Processor | Select-Object -First 1",
        "$disk=Get-CimInstance Win32_DiskDrive | Where-Object {$_.Index -eq 0} | Select-Object -First 1",
        "$guid=(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Cryptography' -Name MachineGuid).MachineGuid",
        "[pscustomobject]@{boardUuid=[string]$cs.UUID;boardSerial=[string]$bb.SerialNumber;cpuId=[string]$cpu.ProcessorId;cpuDescription=([string]$cpu.Manufacturer+' '+[string]$cpu.Name+' '+[string]$cpu.Family+' '+[string]$cpu.Stepping+' '+[string]$cpu.Revision);diskSerial=[string]$disk.SerialNumber;diskPnpId=[string]$disk.PNPDeviceID;machineGuid=[string]$guid} | ConvertTo-Json -Compress",
    ].join("; ")
    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], {
        windowsHide: true,
        timeout: 15000,
        maxBuffer: 1024 * 1024,
    })
    return JSON.parse(stdout.trim()) as HardwareSnapshot
}

async function readSnapshot(): Promise<HardwareSnapshot> {
    if (process.platform === "win32") return readWindowsSnapshot()
    // Keep development and non-Windows builds usable. Windows uses the fuller
    // WMI-backed identity above; these fields are stable OS machine identifiers.
    return { machineGuid: `${os.platform()}|${os.arch()}|${os.hostname()}` }
}

/**
 * Return a SHA-256 device fingerprint for license binding.
 * When all three legacy WMI identifiers are available, retain the exact previous
 * fingerprint format so existing device bindings continue to validate.
 */
export async function getStableHwid(): Promise<string> {
    let snapshot: HardwareSnapshot
    try {
        snapshot = await readSnapshot()
    } catch {
        throw new Error("Unable to read hardware identifiers. Check Windows Management Instrumentation (WMI) and try again.")
    }

    const board = normalize(snapshot.boardUuid)
    const cpu = normalize(snapshot.cpuId)
    const disk = normalize(snapshot.diskSerial)
    if (board && cpu && disk) {
        return crypto.createHash("sha256").update(`${board}|${cpu}|${disk}`).digest("hex")
    }

    const components: string[] = []
    const boardFallback = normalize(snapshot.boardSerial)
    const cpuFallback = normalize(snapshot.cpuDescription)
    const diskFallback = normalize(snapshot.diskPnpId)
    const genericDiskPnpId = (snapshot.diskPnpId || "").replace(/[^a-z0-9]/gi, "").toLowerCase()
    if (board || boardFallback) components.push(`board=${board || boardFallback}`)
    if (cpu || cpuFallback) components.push(`cpu=${cpu || cpuFallback}`)
    // Reject generic PNP ids that do not distinguish physical disks.
    if (disk || (diskFallback && !/^(physicaldrive\d+|ide\d+|scsi\d+)$/.test(genericDiskPnpId))) {
        components.push(`disk=${disk || diskFallback}`)
    }

    const machineGuid = normalize(snapshot.machineGuid)
    // At least two hardware signals are required, or one hardware signal plus the
    // Windows machine GUID. Never issue the same fingerprint for every PC.
    if (components.length < 2 && !(components.length === 1 && machineGuid)) {
        throw new Error("Unable to read enough unique hardware identifiers. Check that WMI is enabled and a disk is connected.")
    }

    const identity = [`ob1-hwid-v2`, ...components.sort(), ...(machineGuid ? [`machine=${machineGuid}`] : [])].join("|")
    return crypto.createHash("sha256").update(identity).digest("hex")
}
