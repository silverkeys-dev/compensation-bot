import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits
} from 'discord.js';
import { getDatabase } from '../database/db';
import { createCancellationMessage } from '../utils/helpers';
import { sendDMOrFallback } from '../utils/helpers';
import logger from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('cancel_ticket')
  .setDescription('Cancel a compensation ticket')
  .addStringOption(option =>
    option
      .setName('ticket_id')
      .setDescription('The ticket ID to cancel')
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

  if (ticket.status !== 'pending') {
    await interaction.reply({
      content: `❌ This ticket has already been ${ticket.status}.`,
      ephemeral: true
    });
    return;
  }

  // Check if user is the ticket owner or has admin permissions
  const isTicketOwner = user.id === ticket.user_id;

  if (!isOwner && !isAdmin && !hasAdminRole && !isTicketOwner) {
    await interaction.reply({
      content: '❌ You do not have permission to cancel this ticket.',
      ephemeral: true
    });
    return;
  }

  try {
    // Update ticket status
    await db.updateTicketStatus(ticketId, 'cancelled');

    // Send DM to user
    const discordUser = await interaction.client.users.fetch(ticket.user_id);
    const cancellationMessage = createCancellationMessage(ticketId);
    await sendDMOrFallback(discordUser, cancellationMessage, interaction.channel as any);

    await interaction.reply({
      content: `⚪ Ticket #${ticketId} has been cancelled. User has been notified.`,
      ephemeral: false
    });

    // Log the action
    logger.info(`Ticket #${ticketId} cancelled by ${user.tag}`);
  } catch (error) {
    logger.error(`Failed to cancel ticket #${ticketId}:`, error);
    await interaction.reply({
      content: '❌ Failed to cancel ticket. Please try again.',
      ephemeral: true
    });
  }
}

export default { data, execute };
