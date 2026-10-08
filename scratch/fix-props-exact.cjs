const fs = require('fs');
let c = fs.readFileSync('admin/app/dashboard/app-users/page.tsx', 'utf8');

c = c.replace(/onDelete,\n\}: \{/g, 'onDelete,\n  onChangeHardware,\n}: {');
c = c.replace(/onDelete: \(\) => void;\n\}\) \{/g, 'onDelete: () => void;\n  onChangeHardware: () => void;\n}) {');

fs.writeFileSync('admin/app/dashboard/app-users/page.tsx', c);
