import { Client, TextChannel, ChannelType } from 'discord.js';
import { getDatabase } from '../database/db';
import { createCancellationMessage } from '../utils/helpers';
import logger from '../utils/logger';

interface ScheduledTask {
  interval: NodeJS.Timeout;
  name: string;
}

class AutoModScheduler {
  private client: Client;
  private tasks: ScheduledTask[] = [];

  constructor(client: Client) {
    this.client = client;
  }

  start(): void {
    // Run inactive ticket check every hour
    const inactiveCheckTask = setInterval(() => {
      this.checkInactiveTickets().catch(error => {
        logger.error('Error in inactive ticket check:', error);
      });
    }, 60 * 60 * 1000); // 1 hour

    this.tasks.push({
      interval: inactiveCheckTask,
      name: 'inactive_ticket_check'
    });

    // Update bot status every 5 minutes
    const statusUpdateTask = setInterval(() => {
      this.updateBotStatus().catch(error => {
        logger.error('Error updating bot status:', error);
      });
    }, 5 * 60 * 1000); // 5 minutes

    this.tasks.push({
      interval: statusUpdateTask,
      name: 'bot_status_update'
    });

    logger.info('AutoMod scheduler started');
  }

  private async checkInactiveTickets(): Promise<void> {
    try {
      const db = await getDatabase();

      // Check for tickets inactive for 3 days (send reminder)
      const threeDayInactive = await db.getInactiveTickets(3);
      for (const ticket of threeDayInactive) {
        try {
          // Find the ticket channel
          const guild = this.client.guilds.cache.first();
          if (!guild) continue;

          const channels = guild.channels.cache.filter(channel =>
            channel.name === `comp-${ticket.user_id}` &&
            channel.type === ChannelType.GuildText
          );

          for (const [_id, channel] of channels) {
            if (channel.type === ChannelType.GuildText) {
              const textChannel = channel as TextChannel;
              await textChannel.send({
              content: `⏰ **Reminder:** This ticket has been inactive for 3 days. It will be automatically cancelled after 7 days of inactivity.\n\n<@${ticket.user_id}>`,
            });
            logger.info(`Sent reminder for inactive ticket #${ticket.ticket_id}`);
            }
          }
        } catch (error) {
          logger.error(`Failed to send reminder for ticket #${ticket.ticket_id}:`, error);
        }
      }

      // Check for tickets inactive for 7 days (auto-cancel)
      const sevenDayInactive = await db.getInactiveTickets(7);
      for (const ticket of sevenDayInactive) {
        try {
          // Update ticket status
          await db.updateTicketStatus(ticket.ticket_id, 'cancelled');

          // Try to send DM to user
          const user = await this.client.users.fetch(ticket.user_id);
          const cancellationMessage = createCancellationMessage(ticket.ticket_id);

          try {
            await user.send(cancellationMessage);
            logger.info(`Auto-cancelled ticket #${ticket.ticket_id} and sent DM`);
          } catch (dmError) {
            logger.warn(`Failed to send DM for auto-cancelled ticket #${ticket.ticket_id}`);
          }

          // Close the ticket channel
          const guild = this.client.guilds.cache.first();
          if (!guild) continue;

          const channels = guild.channels.cache.filter(channel =>
            channel.name === `comp-${ticket.user_id}` &&
            channel.type === ChannelType.GuildText
          );

          for (const [_id, channel] of channels) {
            if (channel.type === ChannelType.GuildText) {
              try {
                await channel.send('🔒 This ticket has been automatically cancelled due to 7 days of inactivity. Channel will be deleted in 10 seconds...');
                setTimeout(async () => {
                try {
                  await channel.delete('Auto-cancelled due to inactivity');
                  logger.info(`Deleted channel for auto-cancelled ticket #${ticket.ticket_id}`);
                } catch (deleteError) {
                  logger.error(`Failed to delete channel for ticket #${ticket.ticket_id}:`, deleteError);
                }
              }, 10000);
              } catch (error) {
                logger.error(`Failed to close channel for ticket #${ticket.ticket_id}:`, error);
              }
            }
          }
        } catch (error) {
          logger.error(`Failed to auto-cancel ticket #${ticket.ticket_id}:`, error);
        }
      }

      if (sevenDayInactive.length > 0) {
        logger.info(`Auto-cancelled ${sevenDayInactive.length} tickets due to inactivity`);
      }
    } catch (error) {
      logger.error('Error checking inactive tickets:', error);
    }
  }

  private async updateBotStatus(): Promise<void> {
    try {
      const db = await getDatabase();
      const stats = await db.getTicketStats();

      const status = `Helping with ${stats.pending} pending tickets`;
      await this.client.user?.setActivity(status, { type: 3 }); // Type 3 = Watching

      logger.debug(`Updated bot status: ${status}`);
    } catch (error) {
      logger.error('Error updating bot status:', error);
    }
  }

  stop(): void {
    this.tasks.forEach(task => {
      clearInterval(task.interval);
      logger.info(`Stopped scheduler: ${task.name}`);
    });
    this.tasks = [];
    logger.info('AutoMod scheduler stopped');
  }
}

export default AutoModScheduler;
