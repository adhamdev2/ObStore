const fs = require('fs');
let c = fs.readFileSync('admin/app/dashboard/app-users/page.tsx', 'utf8');

c = c.replace(/ws\.onopen = \(\) => \{\n\s*ws\.send\(JSON\.stringify\(\{ type: "admin_auth", payload: \{ secret: "ob-admin" \} \}\)\);\n\s*\}\n\s*\};\n\n\s*ws\.onclose = \(\) => \{/, `ws.onopen = () => {
          ws.send(JSON.stringify({ type: "admin_auth", payload: { secret: "ob-admin" } }));
        };

        ws.onclose = () => {`);

fs.writeFileSync('admin/app/dashboard/app-users/page.tsx', c);
