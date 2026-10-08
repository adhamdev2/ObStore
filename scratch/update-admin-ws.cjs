const fs = require('fs');
let c = fs.readFileSync('admin/app/dashboard/app-users/page.tsx', 'utf8');

if (c.includes('if (msg.type === "status") {')) {
    // We modify to support initial_status and status
    c = c.replace(/ws\.onmessage = \(event\) => \{[\s\S]*?\} catch \{\}/g, `ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "status") {
              setUsers((prev) =>
                prev.map((u) =>
                  u.hardwareId === msg.hwid ? { ...u, online: msg.online } : u
                )
              );
            } else if (msg.type === "initial_status") {
              const onlineHwids = new Set(msg.payload || []);
              setUsers((prev) =>
                prev.map((u) => ({
                  ...u,
                  online: onlineHwids.has(u.hardwareId)
                }))
              );
            }
          } catch {}
        };
        
        ws.onopen = () => {
          ws.send(JSON.stringify({ type: "admin_auth", payload: { secret: "ob-admin" } }));
        }`);
}
fs.writeFileSync('admin/app/dashboard/app-users/page.tsx', c);
