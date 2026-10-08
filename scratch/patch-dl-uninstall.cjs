const fs = require('fs');
let c = fs.readFileSync('app/components/sections/download/DownloadPageContent.tsx', 'utf8');

c = c.replace(
    /try \{\r?\n\s+await electron\.uninstallMod\(\{ id, files: modInBackend\?\.files, fivemPath: currentPath \}\);\r?\n\r?\n\s+\/\/ Remove from backend history\r?\n\s+await apiFetch\(`\/user\/downloads\/\$\{id\}`/g,
    `try {
            await electron.uninstallMod({ id, files: modInBackend?.files, fivemPath: currentPath }).catch((err: any) => console.error("Local uninstall failed, ignoring:", err));

            // Remove from backend history
            await apiFetch(\`/user/downloads/\${id}\``
);

fs.writeFileSync('app/components/sections/download/DownloadPageContent.tsx', c);
console.log('Patched DownloadPageContent uninstall');
