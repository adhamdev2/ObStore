const fs = require('fs');
let c = fs.readFileSync('app/lib/auth.tsx', 'utf8');

c = c.replace(
    /return cleanup;\r?\n\s+\} else if/g,
    `return () => {
                window.removeEventListener("force-refresh-mods", handleRefreshMods);
                cleanup();
            };
        } else if`
);

c = c.replace(
    /console\.warn\("\[Auth\] 🛑 IPC onAuthSuccess listener NOT found\. Electron bridge might be broken\."\);\r?\n\s+\}\r?\n\s+\}, \[\]\);/g,
    `console.warn("[Auth] 🛑 IPC onAuthSuccess listener NOT found. Electron bridge might be broken.");
            return () => {
                window.removeEventListener("force-refresh-mods", handleRefreshMods);
            };
        }
    }, []);`
);

fs.writeFileSync('app/lib/auth.tsx', c);
console.log('Patched auth.tsx');
