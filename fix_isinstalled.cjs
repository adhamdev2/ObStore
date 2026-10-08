const fs = require('fs');
const file = 'd:/AW-PROJECTS/fivemModes/app/mods/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `            const electron = (window as any).electron;
            let installedIds: string[] = [];

            if (electron?.getInstalledMods && user?.settings?.fivemDir) {
                const items = await electron.getInstalledMods({ fivemPath: user.settings.fivemDir });
                installedIds = items.map((i: any) => i.id);
            }`;

const replacement = `            const electron = (window as any).electron;
            let installedIds: string[] = [];
            let fivemPath = user?.settings?.fivemDir?.trim() || "";

            if (!fivemPath) {
                try {
                    const pathsResponse = await apiFetch<{ paths: { fivemPath: string } }>("/paths");
                    fivemPath = pathsResponse.paths.fivemPath;
                } catch {}
            }

            if (electron?.getInstalledMods && fivemPath) {
                const items = await electron.getInstalledMods({ fivemPath });
                installedIds = items.map((i: any) => i.id);
            }`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(file, content);
    console.log('Replaced target successfully');
} else {
    console.log('Target not found - using regex');
    content = content.replace(
        /const electron = \(window as any\)\.electron;\r?\n            let installedIds: string\[\] = \[\];\r?\n\r?\n            if \(electron\?\.getInstalledMods && user\?\.settings\?\.fivemDir\) \{\r?\n                const items = await electron\.getInstalledMods\(\{ fivemPath: user\.settings\.fivemDir \}\);\r?\n                installedIds = items\.map\(\(i: any\) => i\.id\);\r?\n            \}/,
        replacement
    );
    fs.writeFileSync(file, content);
    console.log('Regex applied');
}
