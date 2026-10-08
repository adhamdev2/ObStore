import { apiFetch } from "@/lib/api";

type ModLicenseStub = {
    mod_id: string;
    license_key: string;
    version: string;
    type?: string;
};

function isMatchingStub(value: unknown, modId: string, type?: string): value is ModLicenseStub {
    if (!value || typeof value !== "object") return false;
    const stub = value as Partial<ModLicenseStub>;
    return stub.mod_id === modId
        && typeof stub.license_key === "string"
        && /^OB1-LICENSE-[A-Z0-9]+$/.test(stub.license_key)
        && typeof stub.version === "string"
        && (!type || !stub.type || stub.type === type);
}

/** Read a saved stub, or issue and verify one when this install has no local copy. */
export async function getOrCreateModStub(modId: string, type?: string): Promise<ModLicenseStub> {
    const electron = window.electron;
    if (!electron?.readModStub || !electron.saveModStub) {
        throw new Error("Electron license storage is unavailable. Restart or update the desktop launcher.");
    }

    try {
        const saved = await electron.readModStub(modId, type);
        if (isMatchingStub(saved, modId, type)) return saved;
    } catch (error) {
        console.warn("No usable local mod license was found; requesting a replacement.", error);
    }

    const typeQuery = type ? `?type=${encodeURIComponent(type)}` : "";
    const issued = await apiFetch<ModLicenseStub>(
        `/mods/${encodeURIComponent(modId)}/license-stub${typeQuery}`,
        { method: "POST" }
    );
    if (!isMatchingStub(issued, modId, type)) {
        throw new Error("The server returned a license for a different mod.");
    }

    await electron.saveModStub({
        modId: issued.mod_id,
        licenseKey: issued.license_key,
        version: issued.version,
        type: issued.type
    });
    const verified = await electron.readModStub(modId, type);
    if (!isMatchingStub(verified, modId, type)) {
        throw new Error("The mod license was issued but could not be verified on disk.");
    }
    return verified;
}
