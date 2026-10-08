const fs = require('fs');
let c = fs.readFileSync('admin/app/dashboard/app-users/page.tsx', 'utf8');

c = c.replace(/const wsUrl = process\.env\.NEXT_PUBLIC_WS_URL;/, `const wsUrl = process.env.NEXT_PUBLIC_WS_URL || (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'ws://localhost:3006' : 'wss://api.ob1.store');`);

fs.writeFileSync('admin/app/dashboard/app-users/page.tsx', c);
