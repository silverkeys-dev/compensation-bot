import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
  ChannelType
} from 'discord.js';
import { getDatabase } from '../database/db';
import { createCancellationMessage } from '../utils/helpers';
import { sendDMOrFallback } from '../utils/helpers';
import logger from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('force_close_ticket')
  .setDescription('Immediately close a compensation ticket and delete its channel (Admin only)')
  .addStringOption(option =>
    option
      .setName('ticket_id')
      .setDescription('The ticket ID to force close')
      .setRequired(true)
      .setAutocomplete(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const ownerId = process.env.OWNER_ID;
  const adminRoleId = process.env.ADMIN_ROLE_ID;
  const user = interaction.user;

  // Check permissions - only admins can force close
  const isOwner = user.id === ownerId;
  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) || false;
  const hasAdminRole = adminRoleId && (interaction.member as any)?.roles?.cache?.has(adminRoleId);

  if (!isOwner && !isAdmin && !hasAdminRole) {
    await interaction.reply({
      content: '❌ You do not have permission to force close tickets.',
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
    // Update ticket status first
    await db.updateTicketStatus(ticketId, 'cancelled');

    // Send DM to user
    const discordUser = await interaction.client.users.fetch(ticket.user_id);
    const cancellationMessage = createCancellationMessage(ticketId);
    await sendDMOrFallback(discordUser, cancellationMessage, interaction.channel as any);

    // Find and delete the ticket channel immediately
    const guild = interaction.guild;
    if (guild) {
      const channelName = `comp-${ticket.user_id}`;
      const channels = guild.channels.cache.filter(ch =>
        ch.name === channelName &&
        ch.type === ChannelType.GuildText
      );

      for (const [_id, channel] of channels) {
        if (channel.type === ChannelType.GuildText) {
          try {
            const textChannel = channel as TextChannel;
            await textChannel.send('🔒 This ticket has been force closed by an administrator. Channel will be deleted in 5 seconds...');
            setTimeout(async () => {
              try {
                await channel.delete('Force closed by administrator');
                logger.info(`Deleted channel for force-closed ticket #${ticketId}`);
              } catch (deleteError) {
                logger.error(`Failed to delete channel for ticket #${ticketId}:`, deleteError);
              }
            }, 5000);
          } catch (error) {
            logger.error(`Failed to send close message to channel for ticket #${ticketId}:`, error);
          }
        }
      }
    }

    await interaction.reply({
      content: `🔒 Ticket #${ticketId} has been force closed. User has been notified and channel will be deleted shortly.`,
      ephemeral: false
    });

    // Log the action
    logger.info(`Ticket #${ticketId} force closed by ${user.tag}`);
  } catch (error) {
    logger.error(`Failed to force close ticket #${ticketId}:`, error);
    await interaction.reply({
      content: '❌ Failed to force close ticket. Please try again.',
      ephemeral: true
    });
  }
}

export default { data, execute };
