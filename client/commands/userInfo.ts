import {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags,
    type Interaction,
    type GuildMember,
} from "discord.js";
import { botApiGet, ApiError } from "../helpers/apiClient";

export const data = new SlashCommandBuilder()
    .setName("user")
    .setDescription("Get user information")
    .addUserOption(option =>
        option
            .setName("mention")
            .setDescription("The user to look up")
            .setRequired(true)
    );

export async function execute(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const targetUser = interaction.options.getUser("mention", true);

    // Validate user ID format
    if (!/^\d{17,20}$/.test(targetUser.id)) {
        await interaction.reply({
            content: "❌ Invalid user.",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    let member: GuildMember;
    try {
        member = await interaction.guild!.members.fetch(targetUser.id);
    } catch {
        await interaction.editReply({
            content: "❌ Could not find this user in the server.",
        });
        return;
    }

    // Get user data from API
    let apiResult: any = null;
    try {
        apiResult = await botApiGet(`/user/${targetUser.id}`);
    } catch (error) {
        // Non-critical - continue without API data
        console.error("[Bot] Failed to fetch user from API:", error);
    }

    // Get Discord roles
    const roles = member.roles.cache
        .filter((r) => r.id !== interaction.guild!.id)
        .map((r) => r.toString());

    const embed = new EmbedBuilder()
        .setTitle(`User Information: ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
        .addFields(
            { name: "ID", value: targetUser.id, inline: true },
            { name: "Username", value: targetUser.username, inline: true },
            { name: "Display Name", value: member.displayName, inline: true },
            {
                name: "Account Created",
                value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`,
                inline: true,
            },
            {
                name: "Joined Server",
                value: member.joinedTimestamp
                    ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
                    : "Unknown",
                inline: true,
            },
            { name: "Bot", value: targetUser.bot ? "Yes" : "No", inline: true }
        )
        .setColor(member.displayHexColor || 0x5865f2)
        .setTimestamp();

    // Roles
    if (roles.length > 0) {
        const displayRoles = roles.length > 20
            ? roles.slice(0, 20).join(", ") + ` ... +${roles.length - 20} more`
            : roles.join(", ");
        embed.addFields({
            name: `Roles (${roles.length})`,
            value: displayRoles,
            inline: false,
        });
    } else {
        embed.addFields({ name: "Roles", value: "None", inline: false });
    }

    // Premium status
    const premiumRoles: Record<string, string> = {
        "1452011604634767401": "ViP Client",
        "1427282181759434823": "Premium Client",
        "1402381305613647970": "Client",
    };

    let premiumName = "None";
    for (const [roleId, name] of Object.entries(premiumRoles)) {
        if (member.roles.cache.has(roleId)) {
            premiumName = name;
            break;
        }
    }

    embed.addFields({
        name: "Premium Status",
        value: premiumName,
        inline: true,
    });

    // API data (versions, downloads, etc.)
    if (apiResult?.found) {
        const u = apiResult.user;
        if (u.versions && u.versions.length > 0) {
            embed.addFields({
                name: `Versions (${u.versions.length})`,
                value: u.versions.join(", "),
                inline: false,
            });
        }

        embed.addFields(
            {
                name: "Downloads",
                value: String(u.downloads || 0),
                inline: true,
            },
            {
                name: "Registered",
                value: u.createdAt
                    ? `<t:${Math.floor(new Date(u.createdAt).getTime() / 1000)}:R>`
                    : "Unknown",
                inline: true,
            },
            {
                name: "Last Sync",
                value: u.lastSync
                    ? `<t:${Math.floor(new Date(u.lastSync).getTime() / 1000)}:R>`
                    : "Never",
                inline: true,
            }
        );
    }

    await interaction.editReply({ embeds: [embed] });
}
