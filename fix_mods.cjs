const fs = require('fs');
const file = 'd:/AW-PROJECTS/fivemModes/app/mods/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /const mappedMods: Mod\[\] = filtered\.map\(mod => \(\{\r?\n\s*\.\.\.mod,\r?\n\s*category: \(mod\.category \|\| "version"\)\.toLowerCase\(\),\r?\n\s*isInstalled: installedIds\.includes\(mod\.id\),\r?\n\s*isIncompatible: false\r?\n\s*\}\)\);/;

const replacement = `const downloadedIds = user?.downloads?.map((d: any) => d.id) || [];
                const mappedMods: Mod[] = filtered.map(mod => ({
                    ...mod,
                    category: (mod.category || "version").toLowerCase(),
                    isInstalled: installedIds.includes(mod.id) || downloadedIds.includes(mod.id),
                    isIncompatible: false
                }));`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(file, content);
    console.log('Replaced target successfully in mods page via regex');
} else {
    console.log('Regex target not found in mods page');
}
