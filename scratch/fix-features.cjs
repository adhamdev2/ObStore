const fs = require('fs');
let c = fs.readFileSync('app/components/Features/FeaturesGrid.tsx', 'utf8');
c = c.replace(/stroke="#3A352A"/g, 'stroke="currentColor"');
fs.writeFileSync('app/components/Features/FeaturesGrid.tsx', c);
console.log('Patched FeaturesGrid.tsx');
