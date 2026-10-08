import { Router } from "express";
import fs from "fs";
import { getDataPath } from "../lib/paths";
import { UserDB } from "../models/User";

const router = Router();

interface CodeClaim {
    code: string;
    version: string;
    addedBy: string;
    addedAt: string;
    claimedBy: string | null;
    claimedAt: string | null;
}

function readCodesJson(): Record<string, string[]> {
    const codesPath = getDataPath("codes.json");
    return JSON.parse(fs.readFileSync(codesPath, "utf-8"));
}

function writeCodesJson(data: Record<string, string[]>) {
    const codesPath = getDataPath("codes.json");
    fs.writeFileSync(codesPath, JSON.stringify(data, null, 4), "utf-8");
}

function readClaims(): CodeClaim[] {
    const claimsPath = getDataPath("code_claims.json");
    const data = JSON.parse(fs.readFileSync(claimsPath, "utf-8"));
    return data.claims || [];
}

function writeClaims(claims: CodeClaim[]) {
    const claimsPath = getDataPath("code_claims.json");
    fs.writeFileSync(claimsPath, JSON.stringify({ claims }, null, 4), "utf-8");
}

function findClaim(code: string): CodeClaim | undefined {
    return readClaims().find(c => c.code === code);
}

// GET /api/bot/codes - Get all codes or search for a specific code
router.get("/codes", (req, res) => {
    try {
        const { search } = req.query;
        const codesData = readCodesJson();
        const claims = readClaims();

        if (search && typeof search === "string") {
            const code = search.trim();
            // Check if code exists in codes.json (available)
            for (const [version, codesArray] of Object.entries(codesData)) {
                if (Array.isArray(codesArray) && codesArray.includes(code)) {
                    const claim = findClaim(code);
                    return res.json({
                        found: true,
                        available: true,
                        code,
                        version,
                        addedBy: claim?.addedBy || null,
                        addedAt: claim?.addedAt || null,
                        claimedBy: claim?.claimedBy || null,
                        claimedAt: claim?.claimedAt || null,
                    });
                }
            }
            // Check claims for consumed codes
            const claim = claims.find(c => c.code === code);
            if (claim) {
                return res.json({
                    found: true,
                    available: false,
                    code: claim.code,
                    version: claim.version,
                    addedBy: claim.addedBy,
                    addedAt: claim.addedAt,
                    claimedBy: claim.claimedBy,
                    claimedAt: claim.claimedAt,
                });
            }
            return res.json({ found: false });
        }

        // Return all codes with availability info
        const result: Record<string, { total: number; available: number; codes: string[] }> = {};
        for (const [version, codesArray] of Object.entries(codesData)) {
            if (Array.isArray(codesArray)) {
                result[version] = {
                    total: codesArray.length,
                    available: codesArray.length,
                    codes: codesArray,
                };
            }
        }
        res.json(result);
    } catch (error) {
        console.error("[Bot API] Error reading codes:", error);
        res.status(500).json({ error: "Failed to read codes" });
    }
});

// POST /api/bot/codes/add - Add a code to a version
router.post("/codes/add", (req, res) => {
    try {
        const { code, codes, version, addedBy } = req.body;

        const codesToAdd = Array.isArray(codes) ? codes : (code ? [code] : []);

        if (codesToAdd.length === 0 || !version || !addedBy) {
            return res.status(400).json({ error: "code(s), version, and addedBy are required" });
        }

        const codesData = readCodesJson();
        const claims = readClaims();
        
        const addedCodes: string[] = [];
        const errors: string[] = [];

        for (const c of codesToAdd) {
            let exists = false;
            for (const [v, codesArray] of Object.entries(codesData)) {
                if (Array.isArray(codesArray) && codesArray.includes(c)) {
                    errors.push(`Code ${c} already exists in ${v}`);
                    exists = true;
                    break;
                }
            }
            if (exists) continue;

            const existingClaim = findClaim(c);
            if (existingClaim) {
                errors.push(`Code ${c} was already claimed`);
                continue;
            }

            if (!codesData[version]) {
                codesData[version] = [];
            }
            codesData[version].push(c);
            claims.push({
                code: c,
                version,
                addedBy,
                addedAt: new Date().toISOString(),
                claimedBy: null,
                claimedAt: null,
            });
            addedCodes.push(c);
        }

        if (addedCodes.length > 0) {
            writeCodesJson(codesData);
            writeClaims(claims);
        }

        res.json({ success: true, added: addedCodes.length, errors, message: `Added ${addedCodes.length} codes to ${version}` });
    } catch (error) {
        console.error("[Bot API] Error adding code:", error);
        res.status(500).json({ error: "Failed to add code" });
    }
});

// DELETE /api/bot/codes/delete - Delete a code
router.delete("/codes/delete", (req, res) => {
    try {
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({ error: "code is required" });
        }

        const codesData = readCodesJson();
        let found = false;

        for (const [version, codesArray] of Object.entries(codesData)) {
            if (Array.isArray(codesArray)) {
                const index = codesArray.indexOf(code);
                if (index !== -1) {
                    codesArray.splice(index, 1);
                    found = true;
                    break;
                }
            }
        }

        if (!found) {
            return res.status(404).json({ error: "Code not found in codes.json" });
        }

        writeCodesJson(codesData);

        // Also remove from claims
        const claims = readClaims();
        const filteredClaims = claims.filter(c => c.code !== code);
        writeClaims(filteredClaims);

        res.json({ success: true, message: "Code deleted" });
    } catch (error) {
        console.error("[Bot API] Error deleting code:", error);
        res.status(500).json({ error: "Failed to delete code" });
    }
});

// PUT /api/bot/codes/edit - Edit a code (change version or the code value)
router.put("/codes/edit", (req, res) => {
    try {
        const { code, newCode, newVersion } = req.body;

        if (!code) {
            return res.status(400).json({ error: "code is required" });
        }

        const codesData = readCodesJson();
        let foundVersion: string | null = null;
        let foundIndex: number = -1;

        // Find the code
        for (const [version, codesArray] of Object.entries(codesData)) {
            if (Array.isArray(codesArray)) {
                const index = codesArray.indexOf(code);
                if (index !== -1) {
                    foundVersion = version;
                    foundIndex = index;
                    break;
                }
            }
        }

        if (!foundVersion || foundIndex === -1) {
            return res.status(404).json({ error: "Code not found" });
        }

        // Remove old code
        codesData[foundVersion].splice(foundIndex, 1);

        // Determine target version
        const targetVersion = newVersion || foundVersion;
        if (!codesData[targetVersion]) {
            codesData[targetVersion] = [];
        }

        // Add new code (or same code to new version)
        const codeToAdd = newCode || code;
        codesData[targetVersion].push(codeToAdd);

        writeCodesJson(codesData);

        // Update claims
        const claims = readClaims();
        const claimIndex = claims.findIndex(c => c.code === code);
        if (claimIndex !== -1) {
            claims[claimIndex].code = codeToAdd;
            claims[claimIndex].version = targetVersion;
            writeClaims(claims);
        }

        res.json({
            success: true,
            message: `Code updated: ${code} -> ${codeToAdd} in ${targetVersion}`,
        });
    } catch (error) {
        console.error("[Bot API] Error editing code:", error);
        res.status(500).json({ error: "Failed to edit code" });
    }
});

// GET /api/bot/user/:id - Get user info
router.get("/user/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const user = await UserDB.findById(id);
        if (!user) {
            return res.json({ found: false });
        }

        res.json({
            found: true,
            user: {
                discordId: user.discordId,
                username: user.username,
                avatar: user.avatar,
                versions: user.versions || [],
                activationCode: user.activationCode || null,
                isPremium: user.isPremium || false,
                downloads: (user.downloads || []).length,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                lastSync: user.lastSync || null,
            },
        });
    } catch (error) {
        console.error("[Bot API] Error fetching user:", error);
        res.status(500).json({ error: "Failed to fetch user" });
    }
});

export default router;

