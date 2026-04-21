import { AutocompleteInteraction } from 'discord.js';
import { getDatabase } from '../database/db';
import logger from '../utils/logger';

export async function handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  try {
    const focusedValue = interaction.options.getFocused();
    const db = await getDatabase();

    // Get pending tickets with channel existence check
    const pendingTickets = await db.getPendingTicketsWithChannelCheck(interaction.client);

    // Format choices as "ID-username (key_type from reseller)"
    const choices = pendingTickets
      .filter(ticket => {
        const searchStr = `${ticket.ticket_id} ${ticket.username} ${(ticket as any).key_type} ${(ticket as any).reseller_name}`.toLowerCase();
        return searchStr.includes(focusedValue.toLowerCase());
      })
      .slice(0, 25) // Discord limits to 25 choices
      .map(ticket => ({
        name: `${ticket.ticket_id} - ${ticket.username} (${(ticket as any).key_type} from ${(ticket as any).reseller_name})`,
        value: ticket.ticket_id.toString()
      }));

    await interaction.respond(choices);
  } catch (error) {
    logger.error('Error handling autocomplete:', error);
  }
}

export default handleAutocomplete;
