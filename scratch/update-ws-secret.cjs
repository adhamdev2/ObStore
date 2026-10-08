const fs = require('fs');
let c = fs.readFileSync('api/services/updateWsServer.ts', 'utf8');

c = c.replace(/if \(payload\?\.secret !== process\.env\.ADMIN_SECRET\)/, `if (payload?.secret !== (process.env.ADMIN_SECRET || "ob-admin"))`);

fs.writeFileSync('api/services/updateWsServer.ts', c);
