import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export function createTicketActionButtons(ticketId: number): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();

  const approveButton = new ButtonBuilder()
    .setCustomId(`approve_ticket_${ticketId}`)
    .setLabel('Approve')
    .setStyle(ButtonStyle.Success)
    .setEmoji('✅');

  const denyButton = new ButtonBuilder()
    .setCustomId(`deny_ticket_${ticketId}`)
    .setLabel('Deny')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('❌');

  const cancelButton = new ButtonBuilder()
    .setCustomId(`cancel_ticket_${ticketId}`)
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('⚪');

  row.addComponents(approveButton, denyButton, cancelButton);

  return row;
}

export default createTicketActionButtons;
