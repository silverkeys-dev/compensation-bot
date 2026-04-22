import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits
} from 'discord.js';
import { getDatabase } from '../database/db';
import { createDenialMessage } from '../utils/helpers';
import { sendDMOrFallback } from '../utils/helpers';
import logger from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('deny_compensation')
  .setDescription('Deny a compensation request')
  .addStringOption(option =>
    option
      .setName('ticket_id')
      .setDescription('The ticket ID to deny')
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

  if (ticket.status !== 'pending') {
    await interaction.reply({
      content: `❌ This ticket has already been ${ticket.status}.`,
      ephemeral: true
    });
    return;
  }

  try {
    // Update ticket status
    await db.updateTicketStatus(ticketId, 'denied', user.id);

    // Send DM to user
    const discordUser = await interaction.client.users.fetch(ticket.user_id);
    const denialMessage = createDenialMessage();
    await sendDMOrFallback(discordUser, denialMessage, interaction.channel as any);

    await interaction.reply({
      content: `❌ Ticket #${ticketId} has been denied. User has been notified.`,
      ephemeral: false
    });

    // Log the action
    logger.info(`Ticket #${ticketId} denied by ${user.tag}`);
  } catch (error) {
    logger.error(`Failed to deny ticket #${ticketId}:`, error);
    await interaction.reply({
      content: '❌ Failed to deny ticket. Please try again.',
      ephemeral: true
    });
  }
}

export default { data, execute };
