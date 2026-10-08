import { Client, GatewayIntentBits, Partials, Events, type Interaction } from "discord.js";
import dotenv from "dotenv";
import path from "path";
import { handleInteraction } from "./handlers/interaction";
import { setupReadyEvent } from "./events/ready";

// Load env vars
const rootDir = path.resolve(process.cwd(), "..");
const apiDir = path.join(rootDir, "api");

dotenv.config({ path: path.join(rootDir, ".env") });
dotenv.config({ path: path.join(apiDir, ".env") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
const MAIN_GUILD_ID = process.env.MainGuildID!;

if (!DISCORD_BOT_TOKEN) {
    console.error("[Bot] DISCORD_BOT_TOKEN is not set");
    process.exit(1);
}

if (!DISCORD_CLIENT_ID) {
    console.error("[Bot] DISCORD_CLIENT_ID is not set");
    process.exit(1);
}

if (!MAIN_GUILD_ID) {
    console.error("[Bot] MainGuildID is not set");
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.GuildMember, Partials.User, Partials.Message],
});

// Setup events
setupReadyEvent(client);

// Interaction handler
client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
        await handleInteraction(interaction, client);
    } catch (error) {
        console.error("[Bot] Unhandled error in interaction:", error);

        try {
            if (interaction.isRepliable()) {
                const msg = { content: "❌ An unexpected error occurred.", ephemeral: true };
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(msg);
                } else {
                    await interaction.reply(msg);
                }
            }
        } catch (replyError) {
            console.error("[Bot] Failed to send error response:", replyError);
        }
    }
});

// Process error handlers
process.on("unhandledRejection", (error) => {
    console.error("[Bot] Unhandled promise rejection:", error);
});

process.on("uncaughtException", (error) => {
    console.error("[Bot] Uncaught exception:", error);
    process.exit(1);
});

// Login
console.log("[Bot] Connecting to Discord...");
client.login(DISCORD_BOT_TOKEN).catch((error) => {
    console.error("[Bot] Failed to login:", error);
    process.exit(1);
});

export { client };
