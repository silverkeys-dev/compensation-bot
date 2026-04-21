import {
  ButtonInteraction,
  ChannelType,
  Client,
  PermissionOverwrites,
  OAuth2Scopes,
  ButtonStyle
} from 'discord.js';
import { getDatabase, TicketData } from '../database/db';
import { createTicketActionButtons } from '../views/TicketActionView';
import {
  createTicketEmbed,
  createTicketChannelName,
  sendDMOrFallback,
  createApprovalMessage,
  createDenialMessage,
  createCancellationMessage
} from '../utils/helpers';
import loadConfig from '../utils/config';
import canSubmitTicket from '../utils/rateLimit';
import logger from '../utils/logger';
import {
  getPendingConfirmation,
  clearPendingConfirmation
} from './modalHandler';

export async function handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
  try {
    const customId = interaction.customId;

    // Handle Request Compensation button
    if (customId === 'request_compensation_button') {
      await handleRequestCompensation(interaction);
    }
    // Handle Confirm button (after form submission)
    else if (customId === 'confirm_compensation') {
      await handleConfirmCompensation(interaction);
    }
    // Handle Cancel button (request flow)
    else if (customId === 'cancel_compensation') {
      await handleCancelRequest(interaction);
    }
    // Handle ticket action buttons
    else if (customId.startsWith('approve_ticket_')) {
      await handleApproveTicket(interaction);
    } else if (customId.startsWith('deny_ticket_')) {
      await handleDenyTicket(interaction);
    } else if (customId.startsWith('cancel_ticket_')) {
      await handleCancelTicket(interaction);
    }
  } catch (error) {
    logger.error('Error handling button interaction:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'An error occurred while processing your request. Please try again.',
        ephemeral: true
      });
    }
  }
}

async function handleRequestCompensation(interaction: ButtonInteraction): Promise<void> {
  const user = interaction.user;

  // Check rate limits
  const rateLimit = await canSubmitTicket(user.id, user.username, interaction.client);
  if (!rateLimit.allowed) {
    await interaction.reply({
      content: `❌ ${rateLimit.reason}`,
      ephemeral: true
    });
    return;
  }

  // Show the compensation request modal (select menus DON'T work in modals!)
  const { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

  const modal = new ModalBuilder()
    .setCustomId('compensation_request_modal')
    .setTitle('🔑 Bunni Key Compensation Request');

  // Question 1: Key Type - Smart text input with examples
  const keyTypeInput = new TextInputBuilder()
    .setCustomId('key_type')
    .setLabel('Key Type')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Type: 1 for Monthly, 2 for Lifetime')
    .setMinLength(1)
    .setMaxLength(1)
    .setRequired(true);

  // Question 2: Reseller Name
  const resellerInput = new TextInputBuilder()
    .setCustomId('reseller_name')
    .setLabel('Reseller Name')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Where did you buy Bunni?')
    .setMinLength(2)
    .setMaxLength(50)
    .setRequired(true);

  // Question 3: Bunni Key
  const keyInput = new TextInputBuilder()
    .setCustomId('bunni_key')
    .setLabel('Your Bunni Key')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Paste your key here')
    .setMinLength(5)
    .setMaxLength(100)
    .setRequired(true);

  // Question 4: Payment Method - Smart text input
  const paymentInput = new TextInputBuilder()
    .setCustomId('payment_method')
    .setLabel('Payment Method')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Type: 1 for Card/PayPal/Crypto/Other, 2 for Robux')
    .setMinLength(1)
    .setMaxLength(1)
    .setRequired(true);

  // Create ActionRows (max 5 for modals, each row can only have 1 component)
  const firstRow = new ActionRowBuilder().addComponents(keyTypeInput);
  const secondRow = new ActionRowBuilder().addComponents(resellerInput);
  const thirdRow = new ActionRowBuilder().addComponents(keyInput);
  const fourthRow = new ActionRowBuilder().addComponents(paymentInput);

  modal.addComponents(firstRow, secondRow, thirdRow, fourthRow);

  await interaction.showModal(modal);
  logger.info(`User ${user.tag} opened compensation request modal`);
}

async function handleConfirmCompensation(interaction: ButtonInteraction): Promise<void> {
  const user = interaction.user;

  // Get pending confirmation data
  const pendingData = getPendingConfirmation(user.id);
  if (!pendingData) {
    await interaction.reply({
      content: '❌ No pending request found. Please submit a new request.',
      ephemeral: true
    });
    return;
  }

  // Load config
  const config = loadConfig();
  if (!config) {
    await interaction.reply({
      content: '❌ Bot is not properly configured. Please contact an administrator.',
      ephemeral: true
    });
    return;
  }

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({
      content: '❌ This command can only be used in a server.',
      ephemeral: true
    });
    return;
  }

  // Get category
  const category = guild.channels.cache.get(config.category_id);
  if (!category || category.type !== ChannelType.GuildCategory) {
    await interaction.reply({
      content: '❌ Invalid ticket category configured.',
      ephemeral: true
    });
    return;
  }

  try {
    // Create ticket in database with Bunni-specific data
    const db = await getDatabase();
    const ticket = await db.createTicket({
      user_id: pendingData.user_id,
      username: pendingData.username,
      key_type: pendingData.key_type || 'Unknown',
      reseller_name: pendingData.reseller_name || 'Unknown',
      bunni_key: pendingData.bunni_key || 'Unknown',
      payment_method: pendingData.payment_method || 'Unknown'
    });

    // Create ticket channel
    const channelName = createTicketChannelName(pendingData.user_id, ticket.ticket_id.toString());
    const ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: ['ViewChannel']
        },
        {
          id: user.id,
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
        },
        {
          id: config.support_role_id,
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageChannels', 'ManageRoles']
        }
      ],
      reason: `Compensation ticket #${ticket.ticket_id}`
    });

    // Create embed and action buttons
    const embed = createTicketEmbed(ticket);
    const actionButtons = createTicketActionButtons(ticket.ticket_id);

    await ticketChannel.send({
      content: `<@${user.id}> <@&${config.support_role_id}>`,
      embeds: [embed],
      components: [actionButtons]
    });

    // Send proof-of-purchase request message
    const isRobux = pendingData.payment_method?.toLowerCase().includes('robux');
    const proofMessage = isRobux ? `
Please provide proof-of-purchase for your Bunni key.

**If you used Robux**, please provide a screenshot of the Robux transaction in your ROBLOX transaction history.
    ` : `
Please provide proof-of-purchase for your Bunni key.

**If you used Card/PayPal/Crypto/Other**, please provide:
- A screenshot of the bank transaction
- A screenshot of your email invoice showing you received the key
    `;

    await ticketChannel.send({
      content: `<@${user.id}>${proofMessage}`
    });

    // Clear pending confirmation
    clearPendingConfirmation(user.id);

    // Only send success message after everything completes successfully
    await interaction.update({
      content: `✅ Your compensation request has been submitted!\n\nTicket channel created: <#${ticketChannel.id}>\nTicket ID: \`${ticket.ticket_id}\``,
      components: [],
      embeds: []
    });

    logger.info(`Created ticket #${ticket.ticket_id} and channel #${channelName} for user ${user.tag}`);
  } catch (error) {
    logger.error('Failed to create ticket:', error);

    // Clear pending confirmation on error
    clearPendingConfirmation(user.id);

    // Use followUp instead of reply since interaction.update might have been called
    try {
      await interaction.followUp({
        content: '❌ Failed to create ticket. Please contact an administrator.',
        ephemeral: true
      });
    } catch {
      // If followUp also fails, try editReply
      try {
        await interaction.editReply({
          content: '❌ Failed to create ticket. Please contact an administrator.'
        });
      } catch {
        // If both fail, log the error
        logger.error('Failed to send error message to user');
      }
    }
  }
}

async function handleCancelRequest(interaction: ButtonInteraction): Promise<void> {
  const user = interaction.user;

  clearPendingConfirmation(user.id);

  await interaction.update({
    content: '❌ Your compensation request has been cancelled.',
    components: [],
    embeds: []
  });

  logger.info(`User ${user.tag} cancelled their compensation request`);
}

async function handleApproveTicket(interaction: ButtonInteraction): Promise<void> {
  const user = interaction.user;
  const ticketId = parseInt(interaction.customId.replace('approve_ticket_', ''));

  // Check permissions
  const ownerId = process.env.OWNER_ID;
  const adminRoleId = process.env.ADMIN_ROLE_ID;
  const isOwner = user.id === ownerId;
  const isAdmin = interaction.memberPermissions?.has('Administrator') || false;
  const hasAdminRole = adminRoleId && (interaction.member as any)?.roles?.cache?.has(adminRoleId);

  if (!isOwner && !isAdmin && !hasAdminRole) {
    await interaction.reply({
      content: '❌ You do not have permission to approve tickets.',
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

  const config = loadConfig();
  if (!config) {
    await interaction.reply({
      content: '❌ Bot is not properly configured.',
      ephemeral: true
    });
    return;
  }

  try {
    // Update ticket status
    await db.updateTicketStatus(ticketId, 'approved', user.id);

    // Send DM to user
    const discordUser = await interaction.client.users.fetch(ticket.user_id);
    const approvalMessage = createApprovalMessage(ticket, config.discord_invite, config.redemption_instructions);
    await sendDMOrFallback(discordUser, approvalMessage, interaction.channel as any);

    // Update interaction
    await interaction.update({
      content: `✅ Ticket #${ticketId} has been approved by ${user.tag}. Closing channel in 5 minutes...`,
      components: []
    });

    // Close channel after 5 minutes
    setTimeout(async () => {
      try {
        const channel = interaction.channel;
        if (channel && channel.type === ChannelType.GuildText) {
          await channel.send('🔒 This channel will be deleted in 10 seconds...');
          setTimeout(() => channel.delete('Ticket resolved'), 10000);
        }
      } catch (error) {
        logger.error('Failed to delete ticket channel:', error);
      }
    }, 1 * 60 * 1000);

    logger.info(`Ticket #${ticketId} approved by ${user.tag}`);
  } catch (error) {
    logger.error(`Failed to approve ticket #${ticketId}:`, error);
    await interaction.reply({
      content: '❌ Failed to approve ticket. Please try again.',
      ephemeral: true
    });
  }
}

async function handleDenyTicket(interaction: ButtonInteraction): Promise<void> {
  const user = interaction.user;
  const ticketId = parseInt(interaction.customId.replace('deny_ticket_', ''));

  // Check permissions
  const ownerId = process.env.OWNER_ID;
  const adminRoleId = process.env.ADMIN_ROLE_ID;
  const isOwner = user.id === ownerId;
  const isAdmin = interaction.memberPermissions?.has('Administrator') || false;
  const hasAdminRole = adminRoleId && (interaction.member as any)?.roles?.cache?.has(adminRoleId);

  if (!isOwner && !isAdmin && !hasAdminRole) {
    await interaction.reply({
      content: '❌ You do not have permission to deny tickets.',
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
    // Update ticket status (without reason for button interaction)
    await db.updateTicketStatus(ticketId, 'denied', user.id, 'Denied via ticket channel button');

    // Send DM to user
    const discordUser = await interaction.client.users.fetch(ticket.user_id);
    const bunniTicket = ticket as any;
    const denialMessage = createDenialMessage(bunniTicket.bunni_key || 'Unknown', 'Denied via ticket channel button');
    await sendDMOrFallback(discordUser, denialMessage, interaction.channel as any);

    // Update interaction
    await interaction.update({
      content: `❌ Ticket #${ticketId} has been denied by ${user.tag}. Closing channel in 5 minutes...`,
      components: []
    });

    // Close channel after 5 minutes
    setTimeout(async () => {
      try {
        const channel = interaction.channel;
        if (channel && channel.type === ChannelType.GuildText) {
          await channel.send('🔒 This channel will be deleted in 10 seconds...');
          setTimeout(() => channel.delete('Ticket resolved'), 10000);
        }
      } catch (error) {
        logger.error('Failed to delete ticket channel:', error);
      }
    }, 1 * 60 * 1000);

    logger.info(`Ticket #${ticketId} denied by ${user.tag}`);
  } catch (error) {
    logger.error(`Failed to deny ticket #${ticketId}:`, error);
    await interaction.reply({
      content: '❌ Failed to deny ticket. Please try again.',
      ephemeral: true
    });
  }
}

async function handleCancelTicket(interaction: ButtonInteraction): Promise<void> {
  const user = interaction.user;
  const ticketId = parseInt(interaction.customId.replace('cancel_ticket_', ''));

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
  const ownerId = process.env.OWNER_ID;
  const adminRoleId = process.env.ADMIN_ROLE_ID;
  const isOwner = user.id === ownerId;
  const isAdmin = interaction.memberPermissions?.has('Administrator') || false;
  const hasAdminRole = adminRoleId && (interaction.member as any)?.roles?.cache?.has(adminRoleId);
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

    // Update interaction
    await interaction.update({
      content: `⚪ Ticket #${ticketId} has been cancelled by ${user.tag}. Closing channel in 5 minutes...`,
      components: []
    });

    // Close channel after 5 minutes
    setTimeout(async () => {
      try {
        const channel = interaction.channel;
        if (channel && channel.type === ChannelType.GuildText) {
          await channel.send('🔒 This channel will be deleted in 10 seconds...');
          setTimeout(() => channel.delete('Ticket resolved'), 10000);
        }
      } catch (error) {
        logger.error('Failed to delete ticket channel:', error);
      }
    }, 1 * 60 * 1000);

    logger.info(`Ticket #${ticketId} cancelled by ${user.tag}`);
  } catch (error) {
    logger.error(`Failed to cancel ticket #${ticketId}:`, error);
    await interaction.reply({
      content: '❌ Failed to cancel ticket. Please try again.',
      ephemeral: true
    });
  }
}

export default handleButtonInteraction;
