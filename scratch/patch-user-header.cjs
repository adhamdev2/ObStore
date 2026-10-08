const fs = require('fs');
let c = fs.readFileSync('app/components/sections/settings/UserHeader.tsx', 'utf8');
c = c.replace(
    /if \(role\?\.includes\("ViP"\)\) return "from-amber/g,
    'if (role?.includes("[OB]")) return "from-purple-500 via-fuchsia-500 to-pink-500 shadow-purple-500/30";\n        if (role?.includes("ViP")) return "from-amber'
);
fs.writeFileSync('app/components/sections/settings/UserHeader.tsx', c);
console.log('Patched UserHeader');
