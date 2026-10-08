import { Router } from "express";
import fs from "fs";
import { updateService } from "../services/updateService";

const router = Router();

router.get("/", async (req, res) => {
    try {
        const { getDataPath } = await import("../lib/paths");
        const currentUpdateFile = updateService.getFilePath();
        const legacyFile = getDataPath("app.exe");
        const exeFile = fs.existsSync(currentUpdateFile) ? currentUpdateFile : legacyFile;

        res.set({
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        });
        
        if (!fs.existsSync(exeFile)) {
            return res.status(404).json({ success: false, error: "File not found" });
        }

        // Send the file directly with the desired name
        return res.download(exeFile, "ob.exe");
    } catch (error) {
        console.error("Error downloading file:", error);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});

export default router;
