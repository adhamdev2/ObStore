const fs = require('fs');
let c = fs.readFileSync('api/routes/user.ts', 'utf8');

const newRoute = `
router.delete("/downloads", async (req, res) => {
    try {
        const user = await UserDB.findById(req.user!.id);
        if (!user) return res.status(404).json({ error: "User not found" });

        await UserDB.update(req.user!.id, { downloads: [], updatedAt: new Date() });
        
        res.json({ success: true, downloads: [] });
    } catch {
        res.status(500).json({ error: "Failed to clear downloads" });
    }
});

`;

c = c.replace(
    /router\.delete\("\/downloads\/:id", async \(req, res\) => \{/g,
    newRoute + 'router.delete("/downloads/:id", async (req, res) => {'
);

fs.writeFileSync('api/routes/user.ts', c);
console.log('Patched user.ts');
