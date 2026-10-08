const fs = require('fs');
let c = fs.readFileSync('app/components/sections/settings/SettingItem.tsx', 'utf8');

if (!c.includes('import { apiFetch }')) {
    c = c.replace(
        /import \{ useTranslation \} from "@\/hooks\/useTranslation";/g,
        'import { useTranslation } from "@/hooks/useTranslation";\nimport { apiFetch } from "@/lib/api";'
    );
}

c = c.replace(
    /await fetch\('\/api\/user\/downloads', \{\r?\n\s+method: 'DELETE',\r?\n\s+headers: \{\r?\n\s+'Authorization': `Bearer \$\{localStorage\.getItem\('auth_session'\)\}`\r?\n\s+\}\r?\n\s+\}\)/g,
    `await apiFetch('/user/downloads', { method: 'DELETE' })`
);

fs.writeFileSync('app/components/sections/settings/SettingItem.tsx', c);
console.log('Patched SettingItem.tsx apiFetch');
