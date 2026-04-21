import { Client, GatewayIntentBits, Partials, Collection, REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import getDatabase from './database/db';
import logger from './utils/logger';
import AutoModScheduler from './schedulers/autoMod';
import handleModalSubmit, { clearPendingConfirmation } from './handlers/modalHandler';
import handleButtonInteraction from './handlers/buttonHandler';
import handleAutocomplete from './handlers/autocompleteHandler';

// Import commands
import setupCommand from './commands/setup';
import approveCommand from './commands/approve';
import denyCommand from './commands/deny';
import cancelCommand from './commands/cancel';
import viewCommand from './commands/view';
import statsCommand from './commands/stats';
import purgeCommand from './commands/purge';
import forceCloseCommand from './commands/force_close';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['DISCORD_TOKEN', 'CLIENT_ID', 'GUILD_ID', 'OWNER_ID'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    logger.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const DISCORD_TOKEN = process.env.DISCORD_TOKEN!;
const CLIENT_ID = process.env.CLIENT_ID!;
const GUILD_ID = process.env.GUILD_ID!;
const OWNER_ID = process.env.OWNER_ID!;
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID;
const DATABASE_PATH = process.env.DATABASE_PATH || './compensation_tickets.db';

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel, Partials.Message]
});

// Store commands in collection
const commands = new Collection<string, any>();

// Register commands
commands.set(setupCommand.data.name, setupCommand);
commands.set(approveCommand.data.name, approveCommand);
commands.set(denyCommand.data.name, denyCommand);
commands.set(cancelCommand.data.name, cancelCommand);
commands.set(viewCommand.data.name, viewCommand);
commands.set(statsCommand.data.name, statsCommand);
commands.set(purgeCommand.data.name, purgeCommand);
commands.set(forceCloseCommand.data.name, forceCloseCommand);

// Register slash commands with Discord
async function registerCommands(): Promise<void> {
  try {
    const commandsData = Array.from(commands.values()).map(cmd => cmd.data.toJSON());

    const rest = new REST().setToken(DISCORD_TOKEN);

    logger.info(`Started refreshing ${commandsData.length} application (/) commands.`);

    // Register commands for specific guild (faster for testing)
    const data = await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commandsData }
    );

    logger.info(`Successfully reloaded ${data} application (/) commands.`);
  } catch (error) {
    logger.error('Error registering commands:', error);
  }
}

// Display latest changes on startup
function displayLatestChanges(): void {
  try {
    const changeFilePath = join(__dirname, '../latest_change.txt');
    const content = readFileSync(changeFilePath, 'utf-8').trim();
    console.log('\n' + '='.repeat(60));
    console.log('📝 LATEST CHANGES:');
    console.log('='.repeat(60));
    console.log(content);
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    logger.debug('No latest_change.txt file found or unable to read it');
  }
}

// AutoMod scheduler
let autoModScheduler: AutoModScheduler | null = null;

// Bot ready event
client.once('ready', async () => {
  logger.info(`Bot logged in as ${client.user?.tag}`);
  logger.info(`Bot ID: ${client.user?.id}`);

  // Display latest changes
  displayLatestChanges();

  // Initialize database
  await getDatabase(DATABASE_PATH);

  // Validate channels and cancel tickets for deleted channels
  try {
    const db = await getDatabase(DATABASE_PATH);
    logger.info('Validating ticket channels...');
    const validTickets = await db.getPendingTicketsWithChannelCheck(client);
    logger.info(`Channel validation complete. Active pending tickets: ${validTickets.length}`);
  } catch (error) {
    logger.error('Error validating channels on startup:', error);
  }

  // Register commands
  await registerCommands();

  // Start AutoMod scheduler
  autoModScheduler = new AutoModScheduler(client);
  autoModScheduler.start();

  logger.info('Bot is ready!');
});

// Handle interactions
client.on('interactionCreate', async interaction => {
  try {
    // Handle modal submissions
    if (interaction.isModalSubmit()) {
      await handleModalSubmit(interaction);
      return;
    }

    // Handle button interactions
    if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
      return;
    }

    // Handle autocomplete
    if (interaction.isAutocomplete()) {
      await handleAutocomplete(interaction);
      return;
    }

    // Handle chat input commands (slash commands)
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);

      if (!command) {
        logger.error(`Unknown command: ${interaction.commandName}`);
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        logger.error(`Error executing command ${interaction.commandName}:`, error);

        const errorMessage = {
          content: 'There was an error executing this command!',
          ephemeral: true
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMessage);
        } else {
          await interaction.reply(errorMessage);
        }
      }
    }
  } catch (error) {
    logger.error('Error handling interaction:', error);
  }
});

// Error handling
client.on('error', error => {
  logger.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
  logger.error('Unhandled rejection:', error);
});

process.on('uncaughtException', error => {
  logger.error('Uncaught exception:', error);
  shutdown();
});

// Graceful shutdown
async function shutdown(): Promise<void> {
  logger.info('Shutting down bot...');

  if (autoModScheduler) {
    autoModScheduler.stop();
  }

  // Close database connection
  const db = await getDatabase(DATABASE_PATH);
  await db.close();

  // Destroy Discord client
  client.destroy();

  logger.info('Bot shut down complete');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Login to Discord
client.login(DISCORD_TOKEN).catch(error => {
  logger.error('Failed to login:', error);
  process.exit(1);
});

export { client, commands };
