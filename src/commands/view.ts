import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder
} from 'discord.js';
import { getDatabase } from '../database/db';
import { createTicketEmbed } from '../utils/helpers';
import logger from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('view_ticket')
  .setDescription('View details of a compensation ticket')
  .addStringOption(option =>
    option
      .setName('ticket_id')
      .setDescription('The ticket ID to view')
      .setRequired(true)
      .setAutocomplete(true)
  )
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

  const ticketIdStr = interaction.options.getString('ticket_id', true);
  const ticketId = parseInt(ticketIdStr);

  if (isNaN(ticketId)) {
    await interaction.reply({
      content: '❌ Invalid ticket ID.',
      ephemeral: true
    });
    return;
  }

  const db = await getDatabase();
  const ticket = await db.getTicket(ticketId);

  if (!ticket) {
    await interaction.reply({
      content: '❌ Ticket not found.',
      ephemeral: true
    });
    return;
  }

  try {
    const embed = createTicketEmbed(ticket);

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });

    logger.info(`Ticket #${ticketId} viewed by ${user.tag}`);
  } catch (error) {
    logger.error(`Failed to view ticket #${ticketId}:`, error);
    await interaction.reply({
      content: '❌ Failed to retrieve ticket details.',
      ephemeral: true
    });
  }
}

export default { data, execute };
