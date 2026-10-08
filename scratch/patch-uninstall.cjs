const fs = require('fs');

function patchFile(filePath, replacements) {
    let content = fs.readFileSync(filePath, 'utf8');
    for (const {old, newText} of replacements) {
        content = content.replace(old, newText);
    }
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Patched ${filePath}`);
}

patchFile('app/mods/page.tsx', [
    {
        old: /await electron\.deleteModFolders\(\{ fivemPath: user\.settings\.fivemDir \}\);/g,
        newText: 'await electron.deleteModFolders({ fivemPath: user.settings.fivemDir }).catch((e: any) => console.warn("deleteModFolders failed", e));'
    },
    {
        old: /await electron\.uninstallMod\(\{ id, files: modInBackend\?\.files, fivemPath: user\?\.settings\?\.fivemDir \}\);/g,
        newText: 'await electron.uninstallMod({ id, files: modInBackend?.files, fivemPath: user?.settings?.fivemDir }).catch((e: any) => console.warn("uninstallMod failed", e));'
    }
]);

patchFile('app/components/layout/Navbar/NavbarActions.tsx', [
    {
        old: /await electron\.deleteModFolders\(\{ fivemPath: user\.settings\.fivemDir \}\);/g,
        newText: 'await electron.deleteModFolders({ fivemPath: user.settings.fivemDir }).catch((e: any) => console.warn("deleteModFolders failed", e));'
    },
    {
        old: /await electron\.uninstallMod\(\{ id, files, fivemPath: user\?\.settings\?\.fivemDir \}\);/g,
        newText: 'await electron.uninstallMod({ id, files, fivemPath: user?.settings?.fivemDir }).catch((e: any) => console.warn("uninstallMod failed", e));'
    }
]);

// Also check app/download/page.tsx
if (fs.existsSync('app/download/page.tsx')) {
    patchFile('app/download/page.tsx', [
        {
            old: /await electron\.uninstallMod\(\{ id, files: modInBackend\?\.files, fivemPath: user\?\.settings\?\.fivemDir \}\);/g,
            newText: 'await electron.uninstallMod({ id, files: modInBackend?.files, fivemPath: user?.settings?.fivemDir }).catch((e: any) => console.warn("uninstallMod failed", e));'
        }
    ]);
}
