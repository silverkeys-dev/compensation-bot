import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Client } from 'discord.js';
import logger from '../utils/logger';

export interface TicketData {
  user_id: string;
  username: string;
  key_type: string;
  reseller_name: string;
  bunni_key: string;
  payment_method: string;
}

export interface Ticket extends TicketData {
  ticket_id: number;
  status: 'pending' | 'approved' | 'denied' | 'cancelled';
  created_at: string;
  updated_at: string;
  approved_by?: string;
  denied_by?: string;
  denial_reason?: string;
  notes?: string;
}

export interface TicketStats {
  total: number;
  pending: number;
  approved: number;
  denied: number;
  cancelled: number;
}

class DatabaseManager {
  private db: Database | null = null;
  private SQL: SqlJsStatic | null = null;
  private dbPath: string;

  constructor(dbPath: string = './compensation_tickets.db') {
    this.dbPath = dbPath;
  }

  async connect(): Promise<void> {
    try {
      this.SQL = await initSqlJs();

      // Load existing database or create new
      if (existsSync(this.dbPath)) {
        const buffer = readFileSync(this.dbPath);
        this.db = new this.SQL.Database(buffer);
        logger.info('Database loaded successfully');
      } else {
        this.db = new this.SQL.Database();
        logger.info('New database created');
      }

      await this.initializeSchema();
    } catch (err) {
      logger.error('Failed to connect to database:', err);
      throw err;
    }
  }

  private async initializeSchema(): Promise<void> {
    if (!this.db || !this.SQL) {
      throw new Error('Database not initialized');
    }

    try {
      const schemaPath = join(__dirname, 'schema.sql');
      const schema = readFileSync(schemaPath, 'utf-8');

      this.db.run(schema);
      logger.info('Database schema initialized');
    } catch (error) {
      logger.error('Failed to read schema file:', error);
      throw error;
    }
  }

  private save(): void {
    if (!this.db) return;

    const data = this.db.export();
    const buffer = Buffer.from(data);
    writeFileSync(this.dbPath, buffer);
  }

  createTicket(data: TicketData): Promise<Ticket> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not connected'));
        return;
      }

      try {
        const stmt = this.db.prepare(`
          INSERT INTO compensation_tickets (
            user_id, username, key_type, reseller_name, bunni_key, payment_method
          ) VALUES (?, ?, ?, ?, ?, ?)
        `);

        stmt.bind([
          data.user_id,
          data.username,
          data.key_type,
          data.reseller_name,
          data.bunni_key,
          data.payment_method
        ]);

        stmt.step();
        // Get the last insert rowid
        const rowidStmt = this.db.prepare('SELECT last_insert_rowid() as id');
        rowidStmt.step();
        const ticketId = (rowidStmt.getAsObject() as { id: number }).id;
        rowidStmt.free();
        stmt.free();

        this.save();

        logger.info(`Created ticket #${ticketId} for user ${data.username}`);

        // Construct Ticket object directly from the data we already have
        const now = new Date().toISOString();
        const ticket: Ticket = {
          ticket_id: ticketId,
          status: 'pending',
          created_at: now,
          updated_at: now,
          ...data
        };

        resolve(ticket);
      } catch (err) {
        logger.error('Failed to create ticket:', err);
        reject(err);
      }
    });
  }

  getTicket(ticketId: number): Promise<Ticket | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not connected'));
        return;
      }

      try {
        const stmt = this.db.prepare('SELECT * FROM compensation_tickets WHERE ticket_id = ?');
        stmt.bind([ticketId]);

        if (stmt.step()) {
          const row = stmt.getAsObject() as unknown as Ticket;
          stmt.free();
          resolve(row);
        } else {
          stmt.free();
          resolve(null);
        }
      } catch (err) {
        logger.error(`Failed to get ticket #${ticketId}:`, err);
        reject(err);
      }
    });
  }

  getPendingTickets(): Promise<Ticket[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not connected'));
        return;
      }

      try {
        const stmt = this.db.prepare(`
          SELECT * FROM compensation_tickets
          WHERE status = 'pending'
          ORDER BY created_at DESC
        `);

        const tickets: Ticket[] = [];
        while (stmt.step()) {
          tickets.push(stmt.getAsObject() as unknown as Ticket);
        }
        stmt.free();

        resolve(tickets);
      } catch (err) {
        logger.error('Failed to get pending tickets:', err);
        reject(err);
      }
    });
  }

  async getPendingTicketsWithChannelCheck(client: Client): Promise<Ticket[]> {
    const tickets = await this.getPendingTickets();
    const validTickets: Ticket[] = [];

    for (const ticket of tickets) {
      const guild = client.guilds.cache.first();
      if (!guild) {
        validTickets.push(ticket);
        continue;
      }

      // Check if the ticket channel still exists
      const channel = guild.channels.cache.find(ch =>
        ch.name === `comp-${ticket.user_id}`
      );

      if (channel) {
        validTickets.push(ticket);
      } else {
        // Mark ticket as cancelled if channel doesn't exist
        logger.info(`Ticket #${ticket.ticket_id} marked as cancelled (channel deleted)`);
        await this.updateTicketStatus(ticket.ticket_id, 'cancelled');
      }
    }

    return validTickets;
  }

  updateTicketStatus(
    ticketId: number,
    status: 'approved' | 'denied' | 'cancelled',
    adminId?: string,
    denialReason?: string
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not connected'));
        return;
      }

      try {
        let sql: string;
        let params: (string | number)[] = [];

        if (status === 'approved') {
          sql = `
            UPDATE compensation_tickets
            SET status = ?, approved_by = ?, updated_at = datetime('now')
            WHERE ticket_id = ?
          `;
          params = [status, adminId || '', ticketId];
        } else if (status === 'denied') {
          sql = `
            UPDATE compensation_tickets
            SET status = ?, denied_by = ?, denial_reason = ?, updated_at = datetime('now')
            WHERE ticket_id = ?
          `;
          params = [status, adminId || '', denialReason || '', ticketId];
        } else {
          sql = `
            UPDATE compensation_tickets
            SET status = ?, updated_at = datetime('now')
            WHERE ticket_id = ?
          `;
          params = [status, ticketId];
        }

        this.db.run(sql, params);
        this.save();

        logger.info(`Updated ticket #${ticketId} to status: ${status}`);
        resolve(true);
      } catch (err) {
        logger.error(`Failed to update ticket #${ticketId}:`, err);
        reject(err);
      }
    });
  }

  getTicketStats(): Promise<TicketStats> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not connected'));
        return;
      }

      try {
        const stats: TicketStats = {
          total: 0,
          pending: 0,
          approved: 0,
          denied: 0,
          cancelled: 0
        };

        // Helper function to get count
        const getCount = (whereClause: string): number => {
          const sql = `SELECT COUNT(*) as count FROM compensation_tickets ${whereClause}`;
          const stmt = this.db!.prepare(sql);
          stmt.step();
          const result = stmt.getAsObject() as { count: number };
          stmt.free();
          return result.count;
        };

        stats.total = getCount('');
        stats.pending = getCount("WHERE status = 'pending'");
        stats.approved = getCount("WHERE status = 'approved'");
        stats.denied = getCount("WHERE status = 'denied'");
        stats.cancelled = getCount("WHERE status = 'cancelled'");

        resolve(stats);
      } catch (err) {
        logger.error('Failed to get ticket stats:', err);
        reject(err);
      }
    });
  }

  purgeAllTickets(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not connected'));
        return;
      }

      try {
        this.db.run('DELETE FROM compensation_tickets');
        this.save();

        const changes = this.db.getRowsModified();
        logger.info(`Purged ${changes} tickets from database`);
        resolve(true);
      } catch (err) {
        logger.error('Failed to purge tickets:', err);
        reject(err);
      }
    });
  }

  addTicketNote(ticketId: number, note: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not connected'));
        return;
      }

      try {
        this.db.run(
          `UPDATE compensation_tickets
           SET notes = ?, updated_at = datetime('now')
           WHERE ticket_id = ?`,
          [note, ticketId]
        );
        this.save();

        logger.info(`Added note to ticket #${ticketId}`);
        resolve(true);
      } catch (err) {
        logger.error(`Failed to add note to ticket #${ticketId}:`, err);
        reject(err);
      }
    });
  }

  checkUserActiveTicket(userId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not connected'));
        return;
      }

      try {
        const stmt = this.db.prepare(`
          SELECT COUNT(*) as count FROM compensation_tickets
          WHERE user_id = ? AND status = 'pending'
        `);
        stmt.bind([userId]);

        if (stmt.step()) {
          const result = stmt.getAsObject() as { count: number };
          stmt.free();
          resolve(result.count > 0);
        } else {
          stmt.free();
          resolve(false);
        }
      } catch (err) {
        logger.error(`Failed to check active ticket for user ${userId}:`, err);
        reject(err);
      }
    });
  }

  getUserMostRecentTicket(userId: string): Promise<Ticket | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not connected'));
        return;
      }

      try {
        const stmt = this.db.prepare(`
          SELECT * FROM compensation_tickets
          WHERE user_id = ?
          ORDER BY created_at DESC
          LIMIT 1
        `);
        stmt.bind([userId]);

        if (stmt.step()) {
          const ticket = stmt.getAsObject() as unknown as Ticket;
          stmt.free();
          resolve(ticket);
        } else {
          stmt.free();
          resolve(null);
        }
      } catch (err) {
        logger.error(`Failed to get most recent ticket for user ${userId}:`, err);
        reject(err);
      }
    });
  }

  getUserTodayRequestCount(userId: string): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not connected'));
        return;
      }

      try {
        const stmt = this.db.prepare(`
          SELECT COUNT(*) as count FROM compensation_tickets
          WHERE user_id = ? AND DATE(created_at) = DATE('now')
        `);
        stmt.bind([userId]);

        if (stmt.step()) {
          const result = stmt.getAsObject() as { count: number };
          stmt.free();
          resolve(result.count);
        } else {
          stmt.free();
          resolve(0);
        }
      } catch (err) {
        logger.error(`Failed to get today's request count for user ${userId}:`, err);
        reject(err);
      }
    });
  }

  getInactiveTickets(days: number): Promise<Ticket[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not connected'));
        return;
      }

      try {
        const stmt = this.db.prepare(`
          SELECT * FROM compensation_tickets
          WHERE status = 'pending'
          AND DATE(updated_at) < DATE('now', '-' || ? || ' days')
          ORDER BY updated_at ASC
        `);
        stmt.bind([days.toString()]);

        const tickets: Ticket[] = [];
        while (stmt.step()) {
          tickets.push(stmt.getAsObject() as unknown as Ticket);
        }
        stmt.free();

        resolve(tickets);
      } catch (err) {
        logger.error('Failed to get inactive tickets:', err);
        reject(err);
      }
    });
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        try {
          this.save();
          this.db.close();
          this.db = null;
          logger.info('Database connection closed');
          resolve();
        } catch (err) {
          logger.error('Failed to close database:', err);
          reject(err);
        }
      } else {
        resolve();
      }
    });
  }
}

// Singleton instance
let dbManager: DatabaseManager | null = null;

export async function getDatabase(dbPath?: string): Promise<DatabaseManager> {
  if (!dbManager) {
    dbManager = new DatabaseManager(dbPath);
    await dbManager.connect();
  }
  return dbManager;
}

export default getDatabase;
