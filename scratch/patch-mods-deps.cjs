const fs = require('fs');
let c = fs.readFileSync('app/mods/page.tsx', 'utf8');
c = c.replace(
    /\}\s*finally\s*\{\s*setIsLoading\(false\);\s*\}\s*\}, \[\]\);/g,
    `} finally {
            setIsLoading(false);
        }
    }, [user]);`
);
fs.writeFileSync('app/mods/page.tsx', c);
console.log('Patched deps in mods/page.tsx');
