import { Router } from "express";
import fs from "fs";
import path from "path";
import { UserDB } from "../models/User";
import { assignUserRoles } from "../../client/helpers/getUserActivisionRoles";
import { syncUserAccess } from "../services/syncService";
import { sendCodeClaimWebhook } from "../lib/webhooks";

const router = Router();

const normalizeVersionName = (version: string) => version.trim().toLowerCase();

router.post("/verify", async (req, res) => {
    try {
        const { code } = req.body;
        
        if (!code || typeof code !== "string") {
            return res.status(400).json({ success: false, error: "Code is required" });
        }
        
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: "Unauthorized" });
        }
        
        const { getDataPath } = await import("../lib/paths");
        const codesPath = getDataPath("codes.json");

        const user = await UserDB.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, error: "User not found" });
        }

        let foundVersion: string | null = null;
        const codesData = JSON.parse(fs.readFileSync(codesPath, "utf-8"));

        for (const [version, codesArray] of Object.entries(codesData)) {
            if (Array.isArray(codesArray) && codesArray.includes(code)) {
                foundVersion = version;
                break;
            }
        }

        if (foundVersion) {
            const versions = Array.isArray(user.versions) ? user.versions : [];
            if (versions.some(version => normalizeVersionName(version) === normalizeVersionName(foundVersion))) {
                return res.status(400).json({ success: false, error: `You already have access to ${foundVersion}.` });
            }

            // Consume the code
            const codesArray = codesData[foundVersion] as string[];
            codesData[foundVersion] = codesArray.filter((c: string) => c !== code);
            fs.writeFileSync(codesPath, JSON.stringify(codesData, null, 4), "utf-8");

            // Track the claim in code_claims.json
            try {
                const claimsPath = getDataPath("code_claims.json");
                const claimsData = JSON.parse(fs.readFileSync(claimsPath, "utf-8"));
                const claims = claimsData.claims || [];
                const claimIndex = claims.findIndex((c: any) => c.code === code);
                if (claimIndex !== -1) {
                    claims[claimIndex].claimedBy = userId;
                    claims[claimIndex].claimedAt = new Date().toISOString();
                } else {
                    claims.push({
                        code,
                        version: foundVersion,
                        addedBy: null,
                        addedAt: null,
                        claimedBy: userId,
                        claimedAt: new Date().toISOString(),
                    });
                }
                fs.writeFileSync(claimsPath, JSON.stringify({ claims }, null, 4), "utf-8");
            } catch (claimErr) {
                console.error("Failed to track claim:", claimErr);
            }

            // The user wants Discord to be the source of truth for revocation.
            // We assign the role in Discord, and then syncUserAccess will update the 'versions' field locally.
            const roleResult = await assignUserRoles(userId, foundVersion);
            if (!roleResult.success) {
                console.error("Failed to assign roles to user : ");
            }
            await syncUserAccess(userId, true); // Force pull from Discord immediately

            sendCodeClaimWebhook(
                { id: userId, username: user.username, avatar: user.avatar },
                { code, version: foundVersion }
            );

            return res.json({ success: true, version: foundVersion });
        }

        return res.status(400).json({ success: false, error: "Invalid code" });
    } catch (error) {
        console.error("Error verifying code:", error);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});

export default router;

