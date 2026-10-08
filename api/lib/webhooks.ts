import axios from "axios";

const WEBHOOKS = {
    login: "https://discord.com/api/webhooks/1525114899548868669/g2tRMptGlrfO7xpy2abyotAntF12IyJVo5BtxdfQB62U69gQVKiEB78NFIzoWs2nrK5h",
    download: "https://discord.com/api/webhooks/1525114659286548530/isONpytVKnexiy2JblSv-ew1dIFDsW9322-82SpVgGbSFj4LroyhJa-BuO-pZ67zvptF",
    codeClaim: "https://discord.com/api/webhooks/1525128977973252147/VRmVgsGzoJasI6w9GkWWnJpgW0ybFZPCCS2b2Vcp5vmQ6fZ7eZhC3_cALuoVKZgojYXg",
    hwidAlert: "https://discord.com/api/webhooks/1554229467323433012/J6KzqkbKqeKeWIsnHvMZRVJXxJvSzhhZxJIGQJMhHVqMYW8PJYxuIa64XNNxIsSrBPSU",
    homeDownload: "https://discord.com/api/webhooks/1554232093058277487/rK7_wz_wBiPerGPqa16KID6eA61w6z2c5MVMQrFDoTEuOmdGzlCcbuvSlxv8Rbsunhil",
}

export async function sendLoginWebhook(user: {
    id: string
    username: string
    avatar?: string | null
    roleName?: string | null
    versions?: string[]
}) {
    try {
        const avatarUrl = user.avatar
            ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
            : null

        await axios.post(WEBHOOKS.login, {
            embeds: [{
                title: "🔑 User Login",
                color: 0x5865f2,
                thumbnail: avatarUrl ? { url: avatarUrl } : undefined,
                fields: [
                    { name: "Username", value: user.username, inline: true },
                    { name: "User ID", value: user.id, inline: true },
                    { name: "Role", value: user.roleName || "None", inline: true },
                    { name: "Versions", value: (user.versions || []).join(", ") || "None", inline: false },
                ],
                timestamp: new Date().toISOString(),
            }],
        })
        console.log(`[Webhook] Login webhook sent for ${user.username}`)
    } catch (err: any) {
        console.error("[Webhook] Failed to send login webhook:", err?.response?.data || err.message || err)
    }
}

export async function sendDownloadWebhook(user: {
    id: string
    username: string
    avatar?: string | null
}, mod: {
    id: string
    name?: string
    version?: string
    type?: string
}) {
    try {
        const avatarUrl = user.avatar
            ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
            : null

        const payload = {
            embeds: [{
                title: "⬇️ Mod Download",
                color: 0x57f287,
                thumbnail: avatarUrl ? { url: avatarUrl } : undefined,
                fields: [
                    { name: "User", value: `${user.username} (${user.id})`, inline: true },
                    { name: "Mod", value: mod.name || mod.id, inline: true },
                    { name: "Version", value: mod.version || "Unknown", inline: true },
                    { name: "Type", value: mod.type || "Unknown", inline: true },
                ],
                timestamp: new Date().toISOString(),
            }],
        }

        console.log(`[Webhook] Sending download webhook: ${JSON.stringify({ user: user.username, mod: mod.name, type: mod.type })}`)
        await axios.post(WEBHOOKS.download, payload)
        console.log(`[Webhook] Download webhook sent successfully`)
    } catch (err: any) {
        console.error("[Webhook] Failed to send download webhook:", err?.response?.data || err.message || err)
    }
}

export async function sendHwidAlertWebhook(data: {
    user: {
        id: string;
        username: string;
        avatar?: string | null;
        roleName?: string | null;
    };
    registeredHwid: string;
    attemptedHwid: string;
    otherUser?: {
        id: string;
        username: string;
    } | null;
    ip?: string;
    userAgent?: string;
}) {
    try {
        const avatarUrl = data.user.avatar
            ? `https://cdn.discordapp.com/avatars/${data.user.id}/${data.user.avatar}.png`
            : null;

        const fields = [
            { name: "👤 User", value: `<@${data.user.id}> (${data.user.username})`, inline: true },
            { name: "🆔 User ID", value: `\`${data.user.id}\``, inline: true },
            { name: "🛡️ Role", value: data.user.roleName || "None", inline: true },
            { name: "🔒 Registered HWID", value: `\`${data.registeredHwid}\``, inline: false },
            { name: "⚠️ Attempted HWID", value: `\`${data.attemptedHwid}\``, inline: false },
        ];

        if (data.otherUser) {
            fields.push(
                { name: "🚨 HWID Registered To Other Account", value: `<@${data.otherUser.id}> (${data.otherUser.username})`, inline: true },
                { name: "🆔 Other User ID", value: `\`${data.otherUser.id}\``, inline: true }
            );
        }

        if (data.ip) {
            fields.push({ name: "🌐 IP", value: `\`${data.ip}\``, inline: true });
        }

        if (data.userAgent) {
            fields.push({ name: "🖥️ User Agent", value: `\`${data.userAgent.substring(0, 100)}\``, inline: false });
        }

        await axios.post(WEBHOOKS.hwidAlert, {
            content: `<@${data.user.id}> <@&1554229467323433012>`,
            embeds: [{
                title: "🚨 HWID Mismatch Alert",
                description: `User **${data.user.username}** attempted to login from an **unregistered device**.`,
                color: 0xed4245,
                thumbnail: avatarUrl ? { url: avatarUrl } : undefined,
                fields,
                timestamp: new Date().toISOString(),
                footer: { text: "OB1 Launcher Security" },
            }],
        });
        console.log(`[Webhook] HWID alert sent for ${data.user.username}`)
    } catch (err: any) {
        console.error("[Webhook] Failed to send HWID alert:", err?.response?.data || err.message || err)
    }
}

export async function sendCodeClaimWebhook(user: {
    id: string
    username: string
    avatar?: string | null
}, code: {
    code: string
    version: string
}) {
    try {
        const avatarUrl = user.avatar
            ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
            : null

        await axios.post(WEBHOOKS.codeClaim, {
            embeds: [{
                title: "🎫 Code Claimed",
                color: 0xfee75c,
                thumbnail: avatarUrl ? { url: avatarUrl } : undefined,
                fields: [
                    { name: "User", value: `${user.username} (${user.id})`, inline: true },
                    { name: "Code", value: `\`${code.code}\``, inline: true },
                    { name: "Version", value: code.version, inline: true },
                ],
                timestamp: new Date().toISOString(),
            }],
        })
        console.log(`[Webhook] Code claim webhook sent for ${user.username}: ${code.code} → ${code.version}`)
    } catch (err: any) {
        console.error("[Webhook] Failed to send code claim webhook:", err?.response?.data || err.message || err)
    }
}

export async function sendHomeDownloadWebhook(data: {
    ip?: string;
    userAgent?: string;
    referer?: string;
    authenticated?: boolean;
    userId?: string;
    username?: string;
}) {
    try {
        const fields = [
            { name: "🌐 IP", value: `\`${data.ip || "Unknown"}\``, inline: true },
            { name: "🖥️ User Agent", value: `\`${data.userAgent?.substring(0, 100) || "Unknown"}\``, inline: false },
        ];

        if (data.authenticated && data.userId) {
            fields.push(
                { name: "👤 User", value: `<@${data.userId}> (${data.username || "Unknown"})`, inline: true },
                { name: "🆔 User ID", value: `\`${data.userId}\``, inline: true }
            );
        }

        if (data.referer) {
            fields.push({ name: "🔗 Referer", value: `\`${data.referer}\``, inline: true });
        }

        await axios.post(WEBHOOKS.homeDownload, {
            embeds: [{
                title: "📥 Home Page Download Clicked",
                description: `Someone clicked **Download Now** on the home page.`,
                color: 0x57f287,
                fields,
                timestamp: new Date().toISOString(),
                footer: { text: "OB1 Launcher - Home Download" },
            }],
        });
        console.log(`[Webhook] Home download webhook sent`)
    } catch (err: any) {
        console.error("[Webhook] Failed to send home download webhook:", err?.response?.data || err.message || err)
    }
}
