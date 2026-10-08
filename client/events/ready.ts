import { Events, type Client, REST, Routes } from "discord.js";
import { commands } from "../commands";

async function registerCommands(): Promise<void> {
    const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
    const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
    const MAIN_GUILD_ID = process.env.MainGuildID;

    if (!DISCORD_BOT_TOKEN || !DISCORD_CLIENT_ID || !MAIN_GUILD_ID) {
        console.error("[Bot] Missing env vars for command registration");
        return;
    }

    const rest = new REST({ version: "10" }).setToken(DISCORD_BOT_TOKEN);

    console.log("[Bot] Registering slash commands...");

    const commandData = commands.map(cmd => cmd.toJSON());
    console.log(`[Bot] Found ${commandData.length} commands`);

    const result = await rest.put(
        Routes.applicationGuildCommands(DISCORD_CLIENT_ID, MAIN_GUILD_ID),
        { body: commandData }
    );

    const registered = Array.isArray(result) ? result.length : 0;
    console.log(`[Bot] Registered ${registered} commands successfully`);
}

export function setupReadyEvent(client: Client): void {
    client.once(Events.ClientReady, async (c) => {
        console.log(`[Bot] Logged in as ${c.user.tag} (${c.user.id})`);
        console.log(`[Bot] Guilds: ${client.guilds.cache.size}`);

        const MAIN_GUILD_ID = process.env.MainGuildID;

        if (MAIN_GUILD_ID) {
            try {
                const guild = await client.guilds.fetch(MAIN_GUILD_ID);
                (client as any).guild = guild;
                (client as any).guildId = MAIN_GUILD_ID;
                console.log(`[Bot] Main guild: ${guild.name}`);
            } catch (error) {
                console.error("[Bot] Failed to fetch main guild:", error);
            }
        } else {
            console.error("[Bot] MainGuildID is not set");
        }

        await registerCommands();
    });
}
