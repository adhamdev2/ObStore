import {
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    ActionRowBuilder,
    type Interaction,
} from "discord.js";
import { botApiGet, botApiPost, ApiError } from "../helpers/apiClient";

export const pendingCodeFiles = new Map<string, string[]>();

export const data = new SlashCommandBuilder()
    .setName("add")
    .setDescription("Add activation codes from a .txt file")
    .addAttachmentOption(option =>
        option
            .setName("code")
            .setDescription("A .txt file with one code per line")
            .setRequired(true)
    );

export async function execute(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const attachment = interaction.options.getAttachment("code", true);

    if (!attachment.name.endsWith('.txt')) {
        await interaction.reply({
            content: "❌ Please upload a .txt file.",
            ephemeral: true,
        });
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        const response = await fetch(attachment.url);
        const text = await response.text();
        const codes = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

        if (codes.length === 0) {
            await interaction.editReply({ content: "❌ No valid codes found in the file." });
            return;
        }

        const validCodes = codes.filter(c => /^[A-Za-z0-9\-]{1,100}$/.test(c));
        
        if (validCodes.length === 0) {
            await interaction.editReply({ content: "❌ All codes in the file have invalid format." });
            return;
        }

        let codesData: Record<string, any>;
        codesData = await botApiGet("/codes");

        const versions = Object.keys(codesData);
        if (versions.length === 0) {
            await interaction.editReply({ content: "❌ No versions found in codes.json" });
            return;
        }

        const versionOptions = versions.slice(0, 25).map((v: string) => ({
            label: v,
            value: v,
            description: `${codesData[v]?.available || 0} codes`.slice(0, 100),
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`add_code_select_${interaction.user.id}`)
            .setPlaceholder("Select where to add the codes")
            .addOptions(versionOptions);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        pendingCodeFiles.set(interaction.user.id, validCodes);

        await interaction.editReply({
            content: `📂 **Found ${validCodes.length} codes** in \`${attachment.name}\`.\n\nChoose where to add them:`,
            components: [row as any],
        });
    } catch (error) {
        const msg = error instanceof ApiError ? error.message : "Failed to process request";
        await interaction.editReply({ content: `❌ ${msg}` });
    }
}

export async function handleSelect(interaction: Interaction): Promise<void> {
    if (!interaction.isStringSelectMenu()) return;

    const version = interaction.values[0];
    const codes = pendingCodeFiles.get(interaction.user.id);

    if (!codes || codes.length === 0) {
        await interaction.update({
            content: "❌ Could not find pending codes. Please run the /add command again.",
            components: [],
        });
        return;
    }

    if (!/^[A-Za-z0-9\.\_\-]{1,50}$/.test(version)) {
        await interaction.update({
            content: "❌ Invalid version name.",
            components: [],
        });
        return;
    }

    try {
        const result = await botApiPost("/codes/add", {
            codes,
            version,
            addedBy: interaction.user.id,
        });

        if (result.success) {
            const errorText = result.errors && result.errors.length > 0 ? `\n⚠️ **Errors:**\n${result.errors.slice(0, 5).join('\n')}${result.errors.length > 5 ? '\n...and more' : ''}` : '';
            await interaction.update({
                content: `✅ Successfully added **${result.added || 0}** codes to **${version}**!${errorText}`,
                components: [],
            });
        } else {
            await interaction.update({
                content: `❌ Failed to add codes: ${result.error || "Unknown error"}`,
                components: [],
            });
        }
        
        pendingCodeFiles.delete(interaction.user.id);
    } catch (error) {
        const msg = error instanceof ApiError ? error.message : "Failed to add codes";
        await interaction.update({
            content: `❌ ${msg}`,
            components: [],
        });
        pendingCodeFiles.delete(interaction.user.id);
    }
}
