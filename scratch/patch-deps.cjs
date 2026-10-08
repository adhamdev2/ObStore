const fs = require('fs');
let c = fs.readFileSync('app/download/page.tsx', 'utf8');

c = c.replace(
    /\}\s*finally\s*\{\s*setIsLoading\(false\);\s*\}\s*\}, \[\]\);/g,
    `        } finally {
            setIsLoading(false);
        }
    }, [user]);`
);

fs.writeFileSync('app/download/page.tsx', c);
console.log('Patched page.tsx deps');
