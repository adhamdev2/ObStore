const fs = require('fs');
const file = 'd:/AW-PROJECTS/fivemModes/app/download/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /const mappedMods: Mod\[\] = backendMods\.map\(plugin => \(\{\r?\n\s*\.\.\.plugin,\r?\n\s*category: \(plugin\.category \|\| "ModPack"\)\.toLowerCase\(\),\r?\n\s*isInstalled: installedIds\.includes\(plugin\.id\),\r?\n\s*isIncompatible: false,\r?\n\s*config: plugin\.config\r?\n\s*\}\)\);/;

const replacement = `const downloadedIds = user?.downloads?.map((d: any) => d.id) || [];
                const mappedMods: Mod[] = backendMods.map(plugin => ({
                    ...plugin,
                    category: (plugin.category || "ModPack").toLowerCase(),
                    isInstalled: installedIds.includes(plugin.id) || downloadedIds.includes(plugin.id),
                    isIncompatible: false,
                    config: plugin.config
                }));`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(file, content);
    console.log('Replaced target successfully in download page via regex');
} else {
    console.log('Regex target not found in download page');
}
