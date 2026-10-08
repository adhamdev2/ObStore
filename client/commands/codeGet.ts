import {
    SlashCommandBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    EmbedBuilder,
    StringSelectMenuBuilder,
    type Interaction,
} from "discord.js";
import { botApiGet, botApiDelete, botApiPut, ApiError } from "../helpers/apiClient";

export const data = new SlashCommandBuilder()
    .setName("code")
    .setDescription("Code management commands")
    .addSubcommand(sub =>
        sub
            .setName("get")
            .setDescription("Get information about a code")
            .addStringOption(option =>
                option
                    .setName("code")
                    .setDescription("The code to look up")
                    .setRequired(true)
            )
    );

export async function execute(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "get") {
        await handleCodeGet(interaction);
    }
}

async function handleCodeGet(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const code = interaction.options.getString("code", true);

    if (!/^[A-Za-z0-9\-]{1,100}$/.test(code)) {
        await interaction.reply({
            content: "❌ Invalid code format.",
            ephemeral: true,
        });
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    let result: any;
    try {
        result = await botApiGet(`/codes?search=${encodeURIComponent(code)}`);
    } catch (error) {
        const msg = error instanceof ApiError ? error.message : "Failed to search code";
        await interaction.editReply({ content: `❌ ${msg}` });
        return;
    }

    if (!result.found) {
        const embed = new EmbedBuilder()
            .setTitle("Code Not Found")
            .setDescription(`Code \`${code}\` was not found in the system.`)
            .setColor(0xff0000);

        await interaction.editReply({ embeds: [embed] });
        return;
    }

    const status = result.available ? "Available" : "Claimed";

    const embed = new EmbedBuilder()
        .setTitle("Code Information")
        .addFields(
            { name: "Code", value: `\`${result.code}\``, inline: true },
            { name: "Version", value: result.version || "Unknown", inline: true },
            { name: "Status", value: status, inline: true }
        )
        .setColor(result.available ? 0x00ff00 : 0xff0000)
        .setTimestamp();

    if (result.addedBy) {
        embed.addFields({
            name: "Added By",
            value: `<@${result.addedBy}>`,
            inline: true,
        });
    }

    if (result.addedAt) {
        const timestamp = Math.floor(new Date(result.addedAt).getTime() / 1000);
        if (!isNaN(timestamp)) {
            embed.addFields({
                name: "Added At",
                value: `<t:${timestamp}:R>`,
                inline: true,
            });
        }
    }

    if (result.claimedBy) {
        embed.addFields({
            name: "Claimed By",
            value: `<@${result.claimedBy}>`,
            inline: true,
        });
    }

    if (result.claimedAt) {
        const timestamp = Math.floor(new Date(result.claimedAt).getTime() / 1000);
        if (!isNaN(timestamp)) {
            embed.addFields({
                name: "Claimed At",
                value: `<t:${timestamp}:R>`,
                inline: true,
            });
        }
    }

    const deleteButton = new ButtonBuilder()
        .setCustomId(`code_delete_${interaction.user.id}`)
        .setLabel("Delete")
        .setStyle(ButtonStyle.Danger);

    const editButton = new ButtonBuilder()
        .setCustomId(`code_edit_${interaction.user.id}`)
        .setLabel("Edit")
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(deleteButton, editButton);

    await interaction.editReply({
        embeds: [embed],
        components: [row as any],
    });
}

export async function handleDelete(interaction: Interaction): Promise<void> {
    if (!interaction.isButton()) return;

    const code = interaction.message.embeds[0]?.fields?.find(
        (f: any) => f.name === "Code"
    )?.value?.replace(/`/g, "");

    if (!code) {
        await interaction.update({
            content: "❌ Could not extract code from embed.",
            embeds: [],
            components: [],
        });
        return;
    }

    try {
        const result = await botApiDelete("/codes/delete", { code });

        if (result.success) {
            await interaction.update({
                content: `✅ Code \`${code}\` deleted successfully!`,
                embeds: [],
                components: [],
            });
        } else {
            await interaction.update({
                content: `❌ Failed to delete code: ${result.error || "Unknown error"}`,
                embeds: [],
                components: [],
            });
        }
    } catch (error) {
        const msg = error instanceof ApiError ? error.message : "Failed to delete code";
        await interaction.update({
            content: `❌ ${msg}`,
            embeds: [],
            components: [],
        });
    }
}

export async function handleEdit(interaction: Interaction): Promise<void> {
    if (!interaction.isButton()) return;

    const code = interaction.message.embeds[0]?.fields?.find(
        (f: any) => f.name === "Code"
    )?.value?.replace(/`/g, "");

    if (!code) {
        await interaction.update({
            content: "❌ Could not extract code from embed.",
            embeds: [],
            components: [],
        });
        return;
    }

    let codesData: Record<string, any>;
    try {
        codesData = await botApiGet("/codes");
    } catch (error) {
        const msg = error instanceof ApiError ? error.message : "Failed to fetch versions";
        await interaction.update({
            content: `❌ ${msg}`,
            embeds: [],
            components: [],
        });
        return;
    }

    const versions = Object.keys(codesData);
    if (versions.length === 0) {
        await interaction.update({
            content: "❌ No versions available.",
            embeds: [],
            components: [],
        });
        return;
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`code_edit_select_${interaction.user.id}`)
        .setPlaceholder("Select new version")
        .addOptions(
            versions.slice(0, 25).map((v: string) => ({
                label: v,
                value: v,
            }))
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.update({
        content: `Editing code \`${code}\`\n\nSelect the new version:`,
        embeds: [],
        components: [row as any],
    });
}

export async function handleEditSelect(interaction: Interaction): Promise<void> {
    if (!interaction.isStringSelectMenu()) return;

    const code = interaction.message.content.match(/`([^`]+)`/)?.[1];
    const newVersion = interaction.values[0];

    if (!code) {
        await interaction.update({
            content: "❌ Could not extract code from message.",
            components: [],
        });
        return;
    }

    if (!/^[A-Za-z0-9\.\_\-]{1,50}$/.test(newVersion)) {
        await interaction.update({
            content: "❌ Invalid version name.",
            components: [],
        });
        return;
    }

    try {
        const result = await botApiPut("/codes/edit", {
            code,
            newVersion,
        });

        if (result.success) {
            await interaction.update({
                content: `✅ Code \`${code}\` moved to **${newVersion}** successfully!`,
                components: [],
            });
        } else {
            await interaction.update({
                content: `❌ Failed to edit code: ${result.error || "Unknown error"}`,
                components: [],
            });
        }
    } catch (error) {
        const msg = error instanceof ApiError ? error.message : "Failed to edit code";
        await interaction.update({
            content: `❌ ${msg}`,
            components: [],
        });
    }
}
