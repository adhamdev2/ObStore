import {
    type Interaction,
    type Client,
    PermissionFlagsBits,
    type GuildMember,
} from "discord.js";
import * as addCode from "../commands/addCode";
import * as codeGet from "../commands/codeGet";
import * as userInfo from "../commands/userInfo";

const ADMIN_ROLE_ID = "1402381305613647966";

function isAdmin(member: GuildMember): boolean {
    return (
        member.permissions.has(PermissionFlagsBits.Administrator) &&
        member.roles.cache.has(ADMIN_ROLE_ID)
    );
}

function extractUserIdFromCustomId(customId: string): string | null {
    const parts = customId.split("_");
    const lastPart = parts[parts.length - 1];
    if (/^\d{17,20}$/.test(lastPart)) {
        return lastPart;
    }
    return null;
}

function verifyInteractionUser(interaction: Interaction, allowedUserId: string): boolean {
    return interaction.user.id === allowedUserId;
}

// ═══════════════════════════════════════════════════════════
// Handler Maps
// ═══════════════════════════════════════════════════════════

const commandHandlers: Record<string, (interaction: Interaction) => Promise<void>> = {
    add: addCode.execute,
    code: codeGet.execute,
    user: userInfo.execute,
};

const selectMenuHandlers: Record<string, (interaction: Interaction) => Promise<void>> = {
    add_code_select: addCode.handleSelect,
    code_edit_select: codeGet.handleEditSelect,
};

const buttonHandlers: Record<string, (interaction: Interaction) => Promise<void>> = {
    code_delete: codeGet.handleDelete,
    code_edit: codeGet.handleEdit,
};

// ═══════════════════════════════════════════════════════════
// Main Handler
// ═══════════════════════════════════════════════════════════

export async function handleInteraction(interaction: Interaction, client: Client): Promise<void> {
    // Guild-only check
    if (!interaction.guild) {
        if (interaction.isRepliable()) {
            await interaction.reply({
                content: "❌ This command can only be used in a server.",
                ephemeral: true,
            });
        }
        return;
    }

    const MAIN_GUILD_ID = process.env.MainGuildID;
    if (interaction.guild.id !== MAIN_GUILD_ID) {
        if (interaction.isRepliable()) {
            await interaction.reply({
                content: "❌ This command is not available in this server.",
                ephemeral: true,
            });
        }
        return;
    }

    // ─── Slash Commands ────────────────────────────────────
    if (interaction.isChatInputCommand()) {
        const handler = commandHandlers[interaction.commandName];
        if (!handler) return;

        const member = interaction.member;
        if (!member || !("roles" in member) || !isAdmin(member as GuildMember)) {
            await interaction.reply({
                content: "❌ You don't have permission to use this command.",
                ephemeral: true,
            });
            return;
        }

        await handler(interaction);
        return;
    }

    // ─── String Select Menus ───────────────────────────────
    if (interaction.isStringSelectMenu()) {
        const customId = interaction.customId;

        for (const [prefix, handler] of Object.entries(selectMenuHandlers)) {
            if (customId.startsWith(prefix)) {
                const allowedUserId = extractUserIdFromCustomId(customId);
                if (!allowedUserId || !verifyInteractionUser(interaction, allowedUserId)) {
                    await interaction.reply({
                        content: "❌ This interaction is not for you.",
                        ephemeral: true,
                    });
                    return;
                }

                await handler(interaction);
                return;
            }
        }
        return;
    }

    // ─── Buttons ───────────────────────────────────────────
    if (interaction.isButton()) {
        const customId = interaction.customId;

        for (const [prefix, handler] of Object.entries(buttonHandlers)) {
            if (customId.startsWith(prefix)) {
                const allowedUserId = extractUserIdFromCustomId(customId);
                if (!allowedUserId || !verifyInteractionUser(interaction, allowedUserId)) {
                    await interaction.reply({
                        content: "❌ This interaction is not for you.",
                        ephemeral: true,
                    });
                    return;
                }

                await handler(interaction);
                return;
            }
        }
    }
}
