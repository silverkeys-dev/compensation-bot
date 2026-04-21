import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ChannelType,
  PermissionFlagsBits
} from 'discord.js';
import { saveConfig, loadConfig } from '../utils/config';
import { createCompensationRequestButton } from '../views/CompensationView';
import logger from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('setup_compensation')
  .setDescription('Set up the compensation system')
  .addChannelOption(option =>
    option
      .setName('category')
      .setDescription('The category where ticket channels will be created')
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildCategory)
  )
  .addRoleOption(option =>
    option
      .setName('support_role')
      .setDescription('The role that can manage compensation tickets')
      .setRequired(true)
  )
  .addChannelOption(option =>
    option
      .setName('request_channel')
      .setDescription('The channel where the request button will be posted')
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildText)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const ownerId = process.env.OWNER_ID;

  // Only allow the bot owner to use this command
  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: '❌ Only the bot owner can use this command.',
      ephemeral: true
    });
    return;
  }

  const category = interaction.options.getChannel('category', true);
  const supportRole = interaction.options.getRole('support_role', true);
  const requestChannel = interaction.options.getChannel('request_channel', true);

  if (!interaction.guild) {
    await interaction.reply({
      content: '❌ This command can only be used in a server.',
      ephemeral: true
    });
    return;
  }

  try {
    // Load existing config or create new one
    const existingConfig = loadConfig();

    const newConfig = {
      category_id: category.id,
      support_role_id: supportRole.id,
      request_channel_id: requestChannel.id,
      discord_invite: existingConfig?.discord_invite || 'https://discord.gg/yourserver',
      redemption_instructions: existingConfig?.redemption_instructions || 'Join the server and open a ticket',
      ticket_channel_prefix: existingConfig?.ticket_channel_prefix || 'ticket-'
    };

    // Save config
    const saved = saveConfig(newConfig);
    if (!saved) {
      await interaction.reply({
        content: '❌ Failed to save configuration.',
        ephemeral: true
      });
      return;
    }

    // Post request button to request channel
    const channel = interaction.guild.channels.cache.get(requestChannel.id);
    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.reply({
        content: '⚠️ Config saved but failed to post request button to channel.',
        ephemeral: true
      });
      return;
    }

    const button = createCompensationRequestButton();
    await channel.send({
      content: '**Compensation Request System**\n\nClick the button below to submit a compensation request.',
      components: [button]
    });

    await interaction.reply({
      content: `✅ Compensation system configured successfully!\n\n**Settings:**\n- Ticket Category: ${category}\n- Support Role: ${supportRole}\n- Request Channel: ${channel}\n\nRequest button has been posted to the request channel.`,
      ephemeral: true
    });

    logger.info(`Compensation system configured by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in setup command:', error);
    await interaction.reply({
      content: '❌ An error occurred while setting up the compensation system.',
      ephemeral: true
    });
  }
}

export default { data, execute };
