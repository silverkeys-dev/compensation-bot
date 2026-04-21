import { EmbedBuilder, User, TextChannel, inlineCode } from 'discord.js';
import { Ticket } from '../database/db';
import logger from './logger';

export function validateOrderId(orderId: string): { valid: boolean; error?: string } {
  if (!orderId || orderId.trim().length === 0) {
    return { valid: false, error: 'Order ID is required' };
  }

  // Allow alphanumeric characters, dashes, and underscores
  const orderRegex = /^[A-Za-z0-9\-_]+$/;
  if (!orderRegex.test(orderId)) {
    return { valid: false, error: 'Order ID can only contain letters, numbers, dashes, and underscores' };
  }

  if (orderId.length > 50) {
    return { valid: false, error: 'Order ID must be 50 characters or less' };
  }

  return { valid: true };
}

export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || email.trim().length === 0) {
    return { valid: false, error: 'Email is required' };
  }

  // Basic email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Please enter a valid email address' };
  }

  if (email.length > 255) {
    return { valid: false, error: 'Email must be 255 characters or less' };
  }

  return { valid: true };
}

export function validatePurchaseDate(dateStr: string): { valid: boolean; error?: string } {
  if (!dateStr || dateStr.trim().length === 0) {
    return { valid: false, error: 'Purchase date is required' };
  }

  // Validate YYYY-MM-DD format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    return { valid: false, error: 'Date must be in YYYY-MM-DD format' };
  }

  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (isNaN(date.getTime())) {
    return { valid: false, error: 'Invalid date' };
  }

  if (date > today) {
    return { valid: false, error: 'Purchase date cannot be in the future' };
  }

  return { valid: true };
}

export function validateIssueDescription(description: string): { valid: boolean; error?: string } {
  if (!description || description.trim().length === 0) {
    return { valid: false, error: 'Issue description is required' };
  }

  if (description.trim().length < 10) {
    return { valid: false, error: 'Issue description must be at least 10 characters' };
  }

  if (description.length > 1000) {
    return { valid: false, error: 'Issue description must be 1000 characters or less' };
  }

  return { valid: true };
}

export function sanitizeInput(str: string): string {
  if (!str) return '';

  // Remove potentially dangerous characters while preserving basic formatting
  return str
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .trim();
}

export function createTicketEmbed(ticket: Ticket): EmbedBuilder {
  const statusColors: Record<string, number> = {
    pending: 0xFFAA00,
    approved: 0x00AA00,
    denied: 0xAA0000,
    cancelled: 0x808080
  };

  // Type assertion for Bunni-specific fields
  const bunniTicket = ticket as any;

  const embed = new EmbedBuilder()
    .setColor(statusColors[ticket.status] || statusColors.pending)
    .setTitle(`🔑 Bunni Key Compensation #${ticket.ticket_id}`)
    .addFields(
      { name: 'User', value: `<@${ticket.user_id}> (${inlineCode(ticket.username)})`, inline: true },
      { name: 'Key Type', value: inlineCode((bunniTicket.key_type || 'Unknown').toUpperCase()), inline: true },
      { name: 'Reseller', value: inlineCode(bunniTicket.reseller_name || 'Unknown'), inline: true },
      { name: 'Bunni Key', value: inlineCode(bunniTicket.bunni_key || 'Unknown'), inline: true },
      { name: 'Payment Method', value: inlineCode(bunniTicket.payment_method || 'Unknown'), inline: true },
      { name: 'Status', value: inlineCode(ticket.status.toUpperCase()), inline: true }
    )
    .setTimestamp(new Date(ticket.created_at));

  if (ticket.notes) {
    embed.addFields({ name: 'Admin Notes', value: ticket.notes });
  }

  if (ticket.denial_reason) {
    embed.addFields({ name: 'Denial Reason', value: ticket.denial_reason });
  }

  return embed;
}

export async function sendDMOrFallback(
  user: User,
  message: string,
  fallbackChannel: TextChannel
): Promise<boolean> {
  try {
    await user.send(message);
    logger.info(`DM sent to user ${user.tag}`);
    return true;
  } catch (error) {
    logger.warn(`Failed to send DM to user ${user.tag}, using fallback channel`);
    await fallbackChannel.send(
      `${user}, I couldn't send you a DM. Please enable DMs from server members.\n\n${message}`
    );
    return false;
  }
}

export function formatProductList(): { label: string; value: string }[] {
  return [
    { label: 'Software', value: 'Software' },
    { label: 'Subscription', value: 'Subscription' },
    { label: 'Course', value: 'Course' },
    { label: 'Service', value: 'Service' },
    { label: 'Other', value: 'Other' }
  ];
}

export function createApprovalMessage(ticket: Ticket, inviteLink: string, instructions: string): string {
  const bunniTicket = ticket as any;
  return `✅ **Bunni Key Compensation Request Approved**

Your Bunni key compensation request has been approved!

**Key Details:**
- Key Type: ${bunniTicket.key_type?.toUpperCase() || 'Unknown'}
- Reseller: ${bunniTicket.reseller_name || 'Unknown'}

**Next Steps:**
1. Join our Discord server: ${inviteLink}
2. ${instructions}
3. Mention your ticket ID: #${ticket.ticket_id}

Thank you for your patience!`;
}

export function createDenialMessage(orderId: string, reason?: string): string {
  return `❌ **Bunni Key Compensation Request Denied**

Your Bunni key compensation request has been denied.${reason ? `\n\n**Reason:** ${reason}` : ''}

If you believe this is an error, please contact support.`;
}

export function createCancellationMessage(ticketId: number): string {
  return `⚪ **Bunni Key Ticket Cancelled**

Your Bunni key compensation ticket #${ticketId} has been cancelled.

If you still need assistance, feel free to submit a new request.`;
}

export function createTicketChannelName(userId: string, ticketId: string): string {
  // Use comp-<userId> format
  return `comp-${userId}`;
}

export default {
  validateOrderId,
  validateEmail,
  validatePurchaseDate,
  validateIssueDescription,
  sanitizeInput,
  createTicketEmbed,
  sendDMOrFallback,
  formatProductList,
  createApprovalMessage,
  createDenialMessage,
  createCancellationMessage,
  createTicketChannelName
};
