const fs = require('fs');
let c = fs.readFileSync('app/components/Hero/Hero.tsx', 'utf8');
c = c.replace(/to-\[\#686149\]/g, 'to-primary/60');
fs.writeFileSync('app/components/Hero/Hero.tsx', c);
console.log('Patched Hero.tsx');

let f = fs.readFileSync('app/page.tsx', 'utf8');
fs.writeFileSync('app/page.tsx', f);
