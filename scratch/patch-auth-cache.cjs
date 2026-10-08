const fs = require('fs');
let c = fs.readFileSync('app/lib/auth.tsx', 'utf8');

c = c.replace(
    /const data = await apiFetch<User>\("\/auth\/me"\);/g,
    'const data = await apiFetch<User>(`/auth/me?t=${Date.now()}`);'
);

fs.writeFileSync('app/lib/auth.tsx', c);
console.log('Patched auth.tsx cache buster');
