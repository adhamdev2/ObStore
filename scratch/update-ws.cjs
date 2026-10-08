const fs = require('fs');
let c = fs.readFileSync('api/services/updateWsServer.ts', 'utf8');

if (!c.includes('isAdmin')) {
    c = c.replace(/interface AuthenticatedClient extends WebSocket \{/g, `interface AuthenticatedClient extends WebSocket {
    isAdmin?: boolean;`);

    c = c.replace(/ws\.on\("close", \(\) => \{/g, `ws.on("close", () => {
            if (ws.authenticated && ws.hwid && !ws.isAdmin) {
                this.broadcastAdminStatus(ws.hwid, false);
            }`);

    c = c.replace(/console\.log\(\`\[WS\] Client authenticated: \$\{hwid\} \(v\$\{version\}, build \$\{build\}\)\`\);/g, `console.log(\`[WS] Client authenticated: \${hwid} (v\${version}, build \${build})\`);
        this.broadcastAdminStatus(hwid, true);`);

    c = c.replace(/case "auth":\n\s*this\.handleAuth\(ws, message\.payload\);\n\s*break;/g, `case "auth":
                this.handleAuth(ws, message.payload);
                break;
            case "admin_auth":
                this.handleAdminAuth(ws, message.payload);
                break;`);

    c = c.replace(/class UpdateWebSocketServer \{/g, `class UpdateWebSocketServer {
    private broadcastAdminStatus(hwid: string, online: boolean): void {
        const msg = { type: "status", hwid, online };
        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN && client.isAdmin) {
                client.send(JSON.stringify(msg));
            }
        }
    }
    
    private handleAdminAuth(ws: AuthenticatedClient, payload: any): void {
        if (payload?.secret !== process.env.ADMIN_SECRET) {
            this.send(ws, { type: "auth_failed", payload: { reason: "Invalid secret" } });
            return;
        }
        ws.isAdmin = true;
        ws.authenticated = true;
        
        // Send current online clients
        const onlineHwids = Array.from(this.clients).filter(c => c.authenticated && c.hwid && !c.isAdmin).map(c => c.hwid);
        this.send(ws, { type: "initial_status", payload: onlineHwids });
        console.log(\`[WS] Admin authenticated via WS\`);
    }
`);
}

fs.writeFileSync('api/services/updateWsServer.ts', c);
