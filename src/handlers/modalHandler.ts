import {
  ModalSubmitInteraction,
  TextInputStyle,
  ComponentType
} from 'discord.js';
import { getDatabase, TicketData } from '../database/db';
import {
  validateOrderId,
  validateEmail,
  validatePurchaseDate,
  validateIssueDescription,
  sanitizeInput
} from '../utils/helpers';
import logger from '../utils/logger';
import { createConfirmationEmbed, createConfirmationButtons, ConfirmationData } from '../views/ConfirmationView';
import { handlePurgeConfirmation } from '../commands/purge';

// Store temporary confirmation data
const pendingConfirmations = new Map<string, ConfirmationData>();

export async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  try {
    // Handle Part 1: Compensation Request Modal
    if (interaction.customId === 'compensation_request_modal') {
      await handleCompensationRequestModal(interaction);
    }
    // Handle Part 2: Confirmation Modal
    else if (interaction.customId === 'compensation_confirmation_modal') {
      await handleConfirmationModal(interaction);
    }
    // Handle Purge Confirmation Modal
    else if (interaction.customId === 'purge_confirmation_modal') {
      await handlePurgeConfirmation(interaction);
    }
  } catch (error) {
    logger.error('Error handling modal submission:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'An error occurred while processing your request. Please try again.',
        ephemeral: true
      });
    }
  }
}

async function handleCompensationRequestModal(interaction: ModalSubmitInteraction): Promise<void> {
  const user = interaction.user;

  // Extract form data
  const keyTypeInput = sanitizeInput(interaction.fields.getTextInputValue('key_type'));
  const resellerName = sanitizeInput(interaction.fields.getTextInputValue('reseller_name'));
  const bunniKey = sanitizeInput(interaction.fields.getTextInputValue('bunni_key'));
  const paymentInput = sanitizeInput(interaction.fields.getTextInputValue('payment_method'));

  // Convert number inputs to actual values
  const keyTypeMapping: Record<string, string> = {
    '1': 'Monthly',
    '2': 'Lifetime',
    'monthly': 'Monthly',
    'lifetime': 'Lifetime',
    'm': 'Monthly',
    'l': 'Lifetime'
  };

  const paymentMapping: Record<string, string> = {
    '1': 'Card/PayPal/Crypto/Other',
    '2': 'Robux',
    'card': 'Card/PayPal/Crypto/Other',
    'paypal': 'Card/PayPal/Crypto/Other',
    'crypto': 'Card/PayPal/Crypto/Other',
    'robux': 'Robux',
    'rbx': 'Robux'
  };

  const keyTypeValue = keyTypeMapping[keyTypeInput.toLowerCase()];
  const paymentValue = paymentMapping[paymentInput.toLowerCase()];

  // Validate key type
  if (!keyTypeValue) {
    await interaction.reply({
      content: '❌ Invalid key type. Please type **1** for Monthly or **2** for Lifetime.',
      ephemeral: true
    });
    return;
  }

  // Validate payment method
  if (!paymentValue) {
    await interaction.reply({
      content: '❌ Invalid payment method. Please type **1** for Card/PayPal/Crypto/Other or **2** for Robux.',
      ephemeral: true
    });
    return;
  }

  // Validate reseller name
  if (!resellerName || resellerName.trim().length < 2) {
    await interaction.reply({
      content: '❌ Reseller name must be at least 2 characters.',
      ephemeral: true
    });
    return;
  }

  // Validate Bunni key
  if (!bunniKey || bunniKey.trim().length < 5) {
    await interaction.reply({
      content: '❌ Bunni key must be at least 5 characters.',
      ephemeral: true
    });
    return;
  }

  // Store confirmation data temporarily
  const confirmationData: ConfirmationData = {
    user_id: user.id,
    username: user.username,
    key_type: keyTypeValue,
    reseller_name: resellerName,
    bunni_key: bunniKey,
    payment_method: paymentValue,
    // Legacy fields for compatibility
    order_id: bunniKey.substring(0, 10),
    email: 'N/A',
    product: `Bunni Key (${keyTypeValue})`,
    purchase_date: new Date().toISOString().split('T')[0],
    issue_description: `Bunni key compensation request from ${resellerName}`,
    additional_details: undefined
  };

  const confirmationKey = `${user.id}_${Date.now()}`;
  pendingConfirmations.set(confirmationKey, confirmationData);

  // Send confirmation embed with buttons
  const embed = createConfirmationEmbed(confirmationData);
  const buttons = createConfirmationButtons();

  await interaction.reply({
    content: 'Please review your Bunni key compensation request and confirm.',
    embeds: [embed],
    components: [buttons],
    ephemeral: true
  });

  // Store the key for button handlers
  setTimeout(() => {
    pendingConfirmations.delete(confirmationKey);
  }, 15 * 60 * 1000); // Clear after 15 minutes

  logger.info(`User ${user.tag} submitted Bunni key compensation request modal`);
}

async function handleConfirmationModal(interaction: ModalSubmitInteraction): Promise<void> {
  // This is handled by button handlers instead
  await interaction.reply({
    content: 'Please use the buttons below to confirm or cancel your request.',
    ephemeral: true
  });
}

export function getPendingConfirmation(userId: string): ConfirmationData | null {
  // Find the most recent confirmation for this user
  for (const [key, data] of pendingConfirmations.entries()) {
    if (data.user_id === userId) {
      return data;
    }
  }
  return null;
}

export function clearPendingConfirmation(userId: string): void {
  for (const [key, data] of pendingConfirmations.entries()) {
    if (data.user_id === userId) {
      pendingConfirmations.delete(key);
      break;
    }
  }
}

export default handleModalSubmit;
