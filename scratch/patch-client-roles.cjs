const fs = require('fs');
let c = fs.readFileSync('client/helpers/getUserActivisionRoles.ts', 'utf8');

c = c.replace(
    /const clientRoles = \{\r?\n    "ViP Client": "1452011604634767401",/g,
    'const clientRoles = {\n    "[OB]": "1552635126830080020",\n    "ViP Client": "1452011604634767401",'
);

c = c.replace(
    /const hasRole = \(roleId: string\) => member\.roles\.cache\.has\(roleId\);\r?\n/g,
    'const hasRole = (roleId: string) => member.roles.cache.has(roleId);\n\n        if (hasRole(clientRoles["[OB]"])) {\n            return [...versionList, "OB.Guns.skin", "OB.pvp", "OB.real", "OB.Guns.skin.v2"];\n        }\n'
);

c = c.replace(
    /const priority = \["ViP Client", "Premium Client", "Client"\];/g,
    'const priority = ["[OB]", "ViP Client", "Premium Client", "Client"];'
);

fs.writeFileSync('client/helpers/getUserActivisionRoles.ts', c);
console.log('Patched getUserActivisionRoles');
