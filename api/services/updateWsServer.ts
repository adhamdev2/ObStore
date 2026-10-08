import { WebSocketServer, WebSocket } from "ws";
import { createServer, Server } from "http";
import { updateService, UpdateInfo } from "./updateService";

interface AuthenticatedClient extends WebSocket {
    isAdmin?: boolean;
    hwid?: string;
    version?: string;
    build?: number;
    authenticated?: boolean;
    lastPing?: number;
}

interface WSMessage {
    type: string;
    payload?: any;
}

class UpdateWebSocketServer {
    private httpClients = new Map<string, number>();

    public recordHttpHeartbeat(hwid: string) {
        this.httpClients.set(hwid, Date.now());
        for (const [key, time] of this.httpClients.entries()) {
            if (Date.now() - time > 45000) this.httpClients.delete(key);
        }
    }
    public getOnlineHwids(): string[] {
        const wsHwids = Array.from(this.clients).filter(c => c.authenticated && c.hwid && !c.isAdmin).map(c => c.hwid!);
        const httpHwids = Array.from(this.httpClients.entries()).filter(([_, time]) => Date.now() - time <= 45000).map(([hwid]) => hwid);
        return Array.from(new Set([...wsHwids, ...httpHwids]));
    }

    private broadcastAdminStatus(hwid: string, online: boolean): void {
        const msg = { type: "status", hwid, online };
        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN && client.isAdmin) {
                client.send(JSON.stringify(msg));
            }
        }
    }
    
    private handleAdminAuth(ws: AuthenticatedClient, payload: any): void {
        if (payload?.secret !== (process.env.ADMIN_SECRET || "ob-admin")) {
            this.send(ws, { type: "auth_failed", payload: { reason: "Invalid secret" } });
            return;
        }
        ws.isAdmin = true;
        ws.authenticated = true;
        
        // Send current online clients
        const onlineHwids = Array.from(this.clients).filter(c => c.authenticated && c.hwid && !c.isAdmin).map(c => c.hwid);
        this.send(ws, { type: "initial_status", payload: onlineHwids });
        console.log(`[WS] Admin authenticated via WS`);
    }

    private wss: WebSocketServer | null = null;
    private httpServer: Server | null = null;
    private clients: Set<AuthenticatedClient> = new Set();
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private port: number;

    constructor(port: number = 3005) {
        this.port = port;
    }

    start(server?: Server): void {
        if (server) {
            this.wss = new WebSocketServer({ server,  });
            console.log('[WS] Attached to main HTTP server at /ws/updates');
        } else {
            this.httpServer = createServer();
            this.wss = new WebSocketServer({ server: this.httpServer,  });
            this.httpServer.listen(this.port, () => console.log("WS running on "));
        }
        this.wss.on('connection', (ws: AuthenticatedClient, req) => this.handleConnection(ws, req));
        this.wss.on('error', (err) => console.error('[WS] Server error:', err));
        this.startHeartbeat();
    }

    private handleConnection(ws: AuthenticatedClient, req: any): void {
        const ip = req.socket.remoteAddress;
        console.log(`[WS] New connection from ${ip}`);

        ws.authenticated = false;
        ws.lastPing = Date.now();
        this.clients.add(ws);

        ws.on("message", (data: Buffer) => {
            try {
                const message: WSMessage = JSON.parse(data.toString());
                this.handleMessage(ws, message);
            } catch (err) {
                console.warn("[WS] Invalid message format:", err);
            }
        });

        ws.on("close", () => {
            if (ws.authenticated && ws.hwid && !ws.isAdmin) {
                this.broadcastAdminStatus(ws.hwid, false);
            }
            this.clients.delete(ws);
            console.log(`[WS] Client disconnected (${ip})`);
        });

        ws.on("error", (err) => {
            console.error("[WS] Client error:", err);
            this.clients.delete(ws);
        });

        ws.on("pong", () => {
            ws.lastPing = Date.now();
        });
    }

    private handleMessage(ws: AuthenticatedClient, message: WSMessage): void {
        switch (message.type) {
            case "auth":
                this.handleAuth(ws, message.payload);
                break;
            case "ping":
                this.send(ws, { type: "pong" });
                break;
            default:
                console.log("[WS] Unknown message type:", message.type);
        }
    }

    private handleAuth(ws: AuthenticatedClient, payload: any): void {
        if (!payload || typeof payload !== "object") {
            this.send(ws, { type: "auth_failed", payload: { reason: "Invalid payload" } });
            return;
        }

        const { hwid, version, build } = payload;
        
        if (!hwid || !version || typeof build !== "number") {
            this.send(ws, { type: "auth_failed", payload: { reason: "Missing required fields" } });
            return;
        }

        ws.hwid = hwid;
        ws.version = version;
        ws.build = build;
        ws.authenticated = true;

        console.log(`[WS] Client authenticated: ${hwid} (v${version}, build ${build})`);
        this.broadcastAdminStatus(hwid, true);

        // Send current update status
        const current = updateService.getCurrent();
        if (current) {
            const { hasUpdate, mandatory } = updateService.getUpdateForClient(version, build);
            this.send(ws, {
                type: "update_status",
                payload: {
                    hasUpdate,
                    version: current.version,
                    build: current.build,
                    releaseDate: current.releaseDate,
                    changelog: current.changelog,
                    mandatory,
                },
            });
        } else {
            this.send(ws, { type: "update_status", payload: { hasUpdate: false } });
        }
    }

    private send(ws: AuthenticatedClient, message: WSMessage): void {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }

    private startHeartbeat(): void {
        this.heartbeatInterval = setInterval(() => {
            const now = Date.now();
            for (const client of this.clients) {
                if (client.readyState !== WebSocket.OPEN) {
                    this.clients.delete(client);
                    continue;
                }
                if (client.lastPing && now - client.lastPing > 60000) {
                    client.terminate();
                    this.clients.delete(client);
                    continue;
                }
                this.send(client, { type: "ping" });
            }
        }, 30000);
    }

    broadcastUpdate(update: UpdateInfo): void {
        const message: WSMessage = {
            type: "update_available",
            payload: {
                version: update.version,
                build: update.build,
                releaseDate: update.releaseDate,
                changelog: update.changelog,
                mandatory: false, // Each client determines this
            },
        };

        let sent = 0;
        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN && client.authenticated) {
                this.send(client, message);
                sent++;
            }
        }
        console.log(`[WS] Broadcast update to ${sent} clients`);
    }

    broadcastForceUpdate(update: UpdateInfo, deadline: string): void {
        const message: WSMessage = {
            type: "force_update",
            payload: {
                version: update.version,
                build: update.build,
                deadline,
            },
        };

        let sent = 0;
        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN && client.authenticated) {
                this.send(client, message);
                sent++;
            }
        }
        console.log(`[WS] Broadcast FORCE update to ${sent} clients`);
    }

    getStats(): { total: number; authenticated: number } {
        let authenticated = 0;
        for (const client of this.clients) {
            if (client.authenticated) authenticated++;
        }
        return { total: this.clients.size, authenticated };
    }

    stop(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        for (const client of this.clients) {
            client.close();
        }
        this.clients.clear();
        if (this.wss) {
            this.wss.close();
        }
        if (this.httpServer) {
            this.httpServer.close();
        }
    }
}

export const updateWsServer = new UpdateWebSocketServer();
export default updateWsServer;





