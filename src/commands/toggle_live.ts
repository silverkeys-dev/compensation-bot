import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder
} from 'discord.js';
import { toggleKeyMode, getKeyMode, getKeyFilePaths } from '../utils/keyManager';
import { existsSync } from 'fs';
import logger from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('toggle_live')
  .setDescription('Toggle between live and test key files (Owner/Admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const ownerId = process.env.OWNER_ID;
  const adminRoleId = process.env.ADMIN_ROLE_ID;
  const user = interaction.user;

  // Check permissions - only owner or admin
  const isOwner = user.id === ownerId;
  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) || false;
  const hasAdminRole = adminRoleId && (interaction.member as any)?.roles?.cache?.has(adminRoleId);

  if (!isOwner && !isAdmin && !hasAdminRole) {
    await interaction.reply({
      content: '❌ You do not have permission to use this command.',
      ephemeral: true
    });
    return;
  }

  // Get current state before toggle
  const currentMode = getKeyMode();

  // Toggle the mode
  const newState = toggleKeyMode(user.tag);

  // Get key file paths for display
  const paths = getKeyFilePaths();
  const activePath = newState.mode === 'live' ? paths.live : paths.test;
  const fileExists = existsSync(activePath);

  const modeEmoji = newState.mode === 'live' ? '🔴' : '🧪';
  const modeLabel = newState.mode === 'live' ? 'LIVE' : 'TEST';
  const previousMode = currentMode.mode === 'live' ? 'LIVE' : 'TEST';

  const embed = new EmbedBuilder()
    .setColor(newState.mode === 'live' ? 0xFF0000 : 0x00AAFF)
    .setTitle(`${modeEmoji} Key Mode Toggled`)
    .setDescription(`Switched from **${previousMode}** to **${modeLabel}** mode`)
    .addFields(
      { name: 'Current Mode', value: `\`${modeLabel}\``, inline: true },
      { name: 'Key File', value: fileExists ? '✅ Found' : '⚠️ Not Found', inline: true },
      { name: 'Toggled By', value: `<@${user.id}>`, inline: true },
      { name: 'File Path', value: `\`${activePath}\``, inline: false }
    )
    .setTimestamp();

  if (newState.toggled_at) {
    embed.setFooter({ text: `Last toggled: ${new Date(newState.toggled_at).toLocaleString()}` });
  }

  await interaction.reply({
    embeds: [embed],
    ephemeral: false
  });

  logger.info(`Key mode toggled from ${previousMode} to ${modeLabel} by ${user.tag}`);
}

export default { data, execute };