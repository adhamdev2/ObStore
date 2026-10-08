const fs = require('fs');
let c = fs.readFileSync('admin/app/dashboard/app-users/page.tsx', 'utf8');

const t1 = `  onDelete,
  }: {
    user: AppUser;
    onSuspend: () => void;
    onUnbind: () => void;
    onDelete: () => void;
  }) {`;
  
const r1 = `  onDelete,
    onChangeHardware,
  }: {
    user: AppUser;
    onSuspend: () => void;
    onUnbind: () => void;
    onDelete: () => void;
    onChangeHardware: () => void;
  }) {`;

c = c.replace(t1, r1);
fs.writeFileSync('admin/app/dashboard/app-users/page.tsx', c);
