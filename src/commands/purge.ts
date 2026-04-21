import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} from 'discord.js';
import { getDatabase } from '../database/db';
import logger from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('purge_compensation_db')
  .setDescription('⚠️ Delete all compensation tickets from the database (Owner only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const ownerId = process.env.OWNER_ID;
  const user = interaction.user;

  // Only allow the bot owner to use this command
  if (user.id !== ownerId) {
    await interaction.reply({
      content: '❌ Only the bot owner can use this command.',
      ephemeral: true
    });
    return;
  }

  // Show confirmation modal
  const modal = new ModalBuilder()
    .setCustomId('purge_confirmation_modal')
    .setTitle('⚠️ Confirm Database Purge');

  const warningInput = new TextInputBuilder()
    .setCustomId('purge_warning')
    .setLabel('Type "DELETE ALL TICKETS" to confirm')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('This action cannot be undone!');

  const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(warningInput);
  modal.addComponents(firstRow);

  await interaction.showModal(modal);
  logger.info(`User ${user.tag} initiated database purge`);
}

export async function handlePurgeConfirmation(interaction: any): Promise<void> {
  const ownerId = process.env.OWNER_ID;
  const user = interaction.user;

  if (user.id !== ownerId) {
    await interaction.reply({
      content: '❌ Only the bot owner can use this command.',
      ephemeral: true
    });
    return;
  }

  const confirmation = interaction.fields.getTextInputValue('purge_warning');

  if (confirmation !== 'DELETE ALL TICKETS') {
    await interaction.reply({
      content: '❌ Purge cancelled. Confirmation text did not match.',
      ephemeral: true
    });
    return;
  }

  try {
    const db = await getDatabase();
    await db.purgeAllTickets();

    await interaction.reply({
      content: '✅ All compensation tickets have been deleted from the database.',
      ephemeral: true
    });

    logger.warn(`Database purged by ${user.tag}`);
  } catch (error) {
    logger.error('Failed to purge database:', error);
    await interaction.reply({
      content: '❌ Failed to purge database. Please try again.',
      ephemeral: true
    });
  }
}

export default { data, execute, handlePurgeConfirmation };
