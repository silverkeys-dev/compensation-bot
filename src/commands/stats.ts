import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder
} from 'discord.js';
import { getDatabase } from '../database/db';
import logger from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('compensation_stats')
  .setDescription('View compensation ticket statistics')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const ownerId = process.env.OWNER_ID;
  const adminRoleId = process.env.ADMIN_ROLE_ID;
  const user = interaction.user;

  // Check permissions
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

  try {
    const db = await getDatabase();
    const stats = await db.getTicketStats();

    const embed = new EmbedBuilder()
      .setColor(0x00AAFF)
      .setTitle('📊 Compensation Ticket Statistics')
      .addFields(
        { name: 'Total Tickets', value: stats.total.toString(), inline: true },
        { name: 'Pending', value: stats.pending.toString(), inline: true },
        { name: 'Approved', value: stats.approved.toString(), inline: true },
        { name: 'Denied', value: stats.denied.toString(), inline: true },
        { name: 'Cancelled', value: stats.cancelled.toString(), inline: true }
      )
      .setTimestamp()
      .setFooter({ text: `Requested by ${user.tag}` });

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });

    logger.info(`Statistics viewed by ${user.tag}`);
  } catch (error) {
    logger.error('Failed to retrieve statistics:', error);
    await interaction.reply({
      content: '❌ Failed to retrieve statistics.',
      ephemeral: true
    });
  }
}

export default { data, execute };
