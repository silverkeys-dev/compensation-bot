import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits
} from 'discord.js';
import { getDatabase } from '../database/db';
import { createApprovalMessage } from '../utils/helpers';
import loadConfig from '../utils/config';
import { sendDMOrFallback } from '../utils/helpers';
import { popTopKey, getKeyMode } from '../utils/keyManager';
import logger from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('approve_compensation')
  .setDescription('Approve a compensation request')
  .addStringOption(option =>
    option
      .setName('ticket_id')
      .setDescription('The ticket ID to approve')
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

  // Check if the ticket channel still exists
  const guild = interaction.guild;
  if (guild) {
    const channel = guild.channels.cache.find(ch =>
      ch.name === `comp-${ticket.user_id}`
    );

    if (!channel) {
      await interaction.reply({
        content: '⚠️ Warning: Ticket channel not found. It may have been manually deleted. The ticket will be marked as cancelled.',
        ephemeral: true
      });
      // Mark ticket as cancelled since channel doesn't exist
      await db.updateTicketStatus(ticketId, 'cancelled');
      return;
    }
  }

  if (ticket.status !== 'pending') {
    await interaction.reply({
      content: `❌ This ticket has already been ${ticket.status}.`,
      ephemeral: true
    });
    return;
  }

  const config = loadConfig();
  if (!config) {
    await interaction.reply({
      content: '❌ Bot is not properly configured.',
      ephemeral: true
    });
    return;
  }

  try {
    // Pop a key from the active key file
    const compensationKey = popTopKey();
    if (!compensationKey) {
      const keyMode = getKeyMode();
      await interaction.reply({
        content: `❌ No compensation keys available in **${keyMode.mode.toUpperCase()}** mode. Please add keys to the key file before approving.`,
        ephemeral: true
      });
      return;
    }

    // Update ticket status
    await db.updateTicketStatus(ticketId, 'approved', user.id);

    // Send DM to user with compensation key
    const discordUser = await interaction.client.users.fetch(ticket.user_id);
    const approvalMessage = createApprovalMessage(ticket, compensationKey, config.request_channel_id);
    await sendDMOrFallback(discordUser, approvalMessage, interaction.channel as any);

    await interaction.reply({
      content: `✅ Ticket #${ticketId} has been approved. Key (\`${compensationKey}\`) sent to user via DM.`,
      ephemeral: false
    });

    // Log the action
    logger.info(`Ticket #${ticketId} approved by ${user.tag}, key: ${compensationKey}`);
  } catch (error) {
    logger.error(`Failed to approve ticket #${ticketId}:`, error);
    await interaction.reply({
      content: '❌ Failed to approve ticket. Please try again.',
      ephemeral: true
    });
  }
}

export default { data, execute };
