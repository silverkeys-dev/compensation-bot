import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalActionRowComponentBuilder
} from 'discord.js';
import { TicketData } from '../database/db';
import logger from '../utils/logger';

export interface ConfirmationData {
  user_id: string;
  username: string;
  // Bunni-specific fields
  key_type: string;
  reseller_name: string;
  bunni_key: string;
  payment_method: string;
  // Legacy fields for compatibility (optional)
  order_id?: string;
  email?: string;
  product?: string;
  purchase_date?: string;
  issue_description?: string;
  additional_details?: string;
}

export function createConfirmationModal(data: ConfirmationData): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId('compensation_confirmation_modal')
    .setTitle('Confirm Compensation Request');

  // Display summary as a readonly text input
  const summaryField = new TextInputBuilder()
    .setCustomId('confirmation_summary')
    .setLabel('Please review your request:')
    .setStyle(TextInputStyle.Paragraph)
    .setValue(formatConfirmationSummary(data))
    .setRequired(false);

  const firstActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(summaryField);
  modal.addComponents(firstActionRow);

  logger.info(`Created confirmation modal for user ${data.username}`);
  return modal;
}

export function createConfirmationEmbed(data: ConfirmationData): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0xFF69B4) // Pink color for Bunni branding
    .setTitle('🔑 Confirm Bunni Key Compensation Request')
    .setDescription('Please review the information below carefully.')
    .addFields(
      { name: 'Discord User', value: `${data.username} (${data.user_id})`, inline: true },
      { name: 'Key Type', value: `\`${data.key_type?.toUpperCase()}\``, inline: true },
      { name: 'Reseller', value: `\`${data.reseller_name}\``, inline: true },
      { name: 'Bunni Key', value: `\`${data.bunni_key?.substring(0, 15)}...\``, inline: true },
      { name: 'Payment Method', value: `\`${data.payment_method}\``, inline: true }
    )
    .setTimestamp();

  embed.addFields({
    name: 'Action',
    value: 'Click **Confirm** to submit your request or **Cancel** to abort.'
  });

  return embed;
}

export function createConfirmationButtons(): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();

  const confirmButton = new ButtonBuilder()
    .setCustomId('confirm_compensation')
    .setLabel('Confirm')
    .setStyle(ButtonStyle.Success)
    .setEmoji('✅');

  const cancelButton = new ButtonBuilder()
    .setCustomId('cancel_compensation')
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('❌');

  row.addComponents(confirmButton, cancelButton);

  return row;
}

function formatConfirmationSummary(data: ConfirmationData): string {
  let summary = `═══════════════════════════════════════\n`;
  summary += `   BUNNI KEY COMPENSATION REQUEST SUMMARY\n`;
  summary += `═══════════════════════════════════════\n\n`;

  summary += `👤 Discord User: ${data.username}\n`;
  summary += `🆔 User ID: ${data.user_id}\n`;
  summary += `🔑 Key Type: ${data.key_type.toUpperCase()}\n`;
  summary += `🏪 Reseller: ${data.reseller_name}\n`;
  summary += `🎫 Bunni Key: ${data.bunni_key}\n`;
  summary += `💳 Payment Method: ${data.payment_method}\n\n`;

  summary += `═══════════════════════════════════════\n`;
  summary += `Click CONFIRM to submit or CANCEL to abort.`;
  summary += `\n═══════════════════════════════════════`;

  return summary;
}

export default {
  createConfirmationModal,
  createConfirmationEmbed,
  createConfirmationButtons
};
