const fs = require('fs');
let c = fs.readFileSync('admin/app/dashboard/app-users/page.tsx', 'utf8');

// 1. Fix ActionMenu Props
if (!c.includes('onChangeHardware: () => void;')) {
    c = c.replace(/onDelete: \(\) => void;\n  \}\)/, 'onDelete: () => void;\n    onChangeHardware: () => void;\n  })'); // this failed
    c = c.replace(/onDelete: \(\) => void;\n  \}\) \{/, 'onDelete: () => void;\n    onChangeHardware: () => void;\n  }) {'); 
    c = c.replace(/onDelete: \(\) => void;\n\s*\}\) \{/g, 'onDelete: () => void;\n    onChangeHardware: () => void;\n  }) {'); 
}

// Another attempt for ActionMenu props if it's `{ user: AppUser; onSuspend: () => void; onUnbind: () => void; onDelete: () => void; }`
c = c.replace(/onDelete: \(\) => void;\n\s*\}/, 'onDelete: () => void;\n    onChangeHardware: () => void;\n  }');

// 2. Insert promptModal state
if (!c.includes('const [promptModal, setPromptModal]')) {
    c = c.replace(/const \[actionLoading, setActionLoading\] = useState<string \| null>\(null\);/, `$&
  const [promptModal, setPromptModal] = useState({ open: false, title: "", message: "", placeholder: "", confirmLabel: "", onConfirm: (val: string) => {} });`);
}

fs.writeFileSync('admin/app/dashboard/app-users/page.tsx', c);
