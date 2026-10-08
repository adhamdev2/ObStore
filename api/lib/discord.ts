import { Client, GatewayIntentBits, Partials } from 'discord.js';

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;

// Define a singleton for the Discord client
let client: Client | null = null;
let clientPromise: Promise<Client> | null = null;

export async function getDiscordClient(): Promise<Client> {
  if (client) return client;
  if (clientPromise) return clientPromise;

  if (!DISCORD_BOT_TOKEN) {
    throw new Error('DISCORD_BOT_TOKEN is not configured in environment variables');
  }

  clientPromise = new Promise((resolve, reject) => {
    const newClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
      ],
      partials: [Partials.GuildMember, Partials.User],
    });

    newClient.once('ready', () => {
      console.log(`[Discord Bot] Logged in as ${newClient.user?.tag}`);
      client = newClient;
      resolve(newClient);
    });

    newClient.once('error', (err) => {
      console.error('[Discord Bot] Error:', err);
      clientPromise = null;
      reject(err);
    });

    newClient.login(DISCORD_BOT_TOKEN).catch(reject);
  });

  return clientPromise;
}

/**
 * Fetches roles for a user in the configured guild.
 */
export async function getMemberRoles(userId: string): Promise<string[] | null> {
  try {
    if (!DISCORD_GUILD_ID) {
      console.warn('[Discord Bot] DISCORD_GUILD_ID is not configured');
      return null;
    }

    const bot = await getDiscordClient();
    const guild = await bot.guilds.fetch(DISCORD_GUILD_ID);

    if (!guild) {
      console.warn(`[Discord Bot] Could not fetch guild: ${DISCORD_GUILD_ID}`);
      return null;
    }

    const member = await guild.members.fetch(userId);
    if (!member) return null;

    return Array.from(member.roles.cache.keys());
  } catch (err) {
    console.error(`[Discord Bot] Error fetching roles for user ${userId}:`, err);
    return null;
  }
}
