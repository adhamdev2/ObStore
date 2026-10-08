const fs = require('fs');
let c = fs.readFileSync('api/routes/modDownloads.ts', 'utf8');

c = c.replace(/const CACHE_DIR = path\.join\(getDataPath\(\), "\.archive-cache"\);/, 'const CACHE_DIR = path.join(os.tmpdir(), "fivem_mod_cache");');

fs.writeFileSync('api/routes/modDownloads.ts', c);
