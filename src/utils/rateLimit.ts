import { Client } from 'discord.js';
import getDatabase, { Ticket } from '../database/db';
import logger from './logger';

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
}

export async function canSubmitTicket(userId: string, username: string, client: Client): Promise<RateLimitResult> {
  try {
    const db = await getDatabase();

    // Check for pending tickets AND verify channels exist
    const pendingTickets = await db.getPendingTicketsWithChannelCheck(client);
    const hasActiveTicket = pendingTickets.some(t => t.user_id === userId);

    if (hasActiveTicket) {
      logger.info(`User ${username} (${userId}) has an active pending ticket`);
      return {
        allowed: false,
        reason: 'You already have an active pending ticket. Please wait for it to be resolved before submitting another.'
      };
    }

    // Check if user has submitted 3 or more tickets today
    const todayCount = await db.getUserTodayRequestCount(userId);
    if (todayCount >= 3) {
      logger.info(`User ${username} (${userId}) has reached daily ticket limit (3)`);
      return {
        allowed: false,
        reason: 'You have reached the maximum of 3 compensation requests per day. Please try again tomorrow.'
      };
    }

    logger.info(`Rate limit check passed for user ${username} (${userId}), today's count: ${todayCount}`);
    return { allowed: true };
  } catch (error) {
    logger.error('Error checking rate limits:', error);
    // Allow submission if rate limit check fails (fail-open)
    return { allowed: true };
  }
}

export default canSubmitTicket;
