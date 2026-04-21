import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export function createCompensationRequestButton(): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();

  const button = new ButtonBuilder()
    .setCustomId('request_compensation_button')
    .setLabel('🔑 Request Bunni Key Compensation')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('🔑');

  row.addComponents(button);

  return row;
}

export default createCompensationRequestButton;
