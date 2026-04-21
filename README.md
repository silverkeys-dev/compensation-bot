# Discord Compensation Bot

A full-featured Discord.js bot for handling compensation requests with ticket-based workflows and admin approval systems.

## Features

- **Multi-step Modal Forms**: Users can submit compensation requests through an intuitive modal interface
- **Ticket Management**: Automatic ticket channel creation with proper permissions
- **Admin Approval Workflow**: Easy approve/deny/cancel system for administrators
- **Rate Limiting**: Prevents spam with limits on active tickets and daily submissions
- **Auto-Mod Features**: Automatically cancels inactive tickets after 7 days
- **DM Notifications**: Users receive direct messages about their request status
- **Persistent Storage**: SQLite database for reliable ticket data storage
- **Comprehensive Logging**: Winston-based logging with daily rotation
- **Statistics Dashboard**: View ticket stats and performance metrics

## Prerequisites

- Node.js v18 or higher
- Discord Bot Token
- Discord Application with bot and applications.commands scopes

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd compensation-bot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` with your configuration:
   ```env
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_application_id_here
   GUILD_ID=your_test_guild_id_here
   OWNER_ID=your_discord_user_id
   ADMIN_ROLE_ID=admin_role_id
   DATABASE_PATH=./compensation_tickets.db
   LOG_LEVEL=info
   ```

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

### Watch Mode
```bash
npm run watch
```

### Using PM2 (Recommended for production)
```bash
npm run build
pm2 start dist/index.js --name compensation-bot
```

## Initial Setup

1. Start the bot
2. Run the `/setup_compensation` command with:
   - A category for ticket channels
   - A support role for ticket management
   - A channel for the request button
3. The bot will automatically post a "Request Compensation" button in the designated channel

## Commands

### User Commands
- **Request Compensation**: Click the button in the designated channel to submit a request

### Admin Commands
- `/setup_compensation` - Configure the compensation system (Owner only)
- `/approve_compensation` - Approve a compensation request
- `/deny_compensation` - Deny a compensation request (with optional reason)
- `/cancel_ticket` - Cancel a ticket
- `/view_ticket` - View ticket details
- `/compensation_stats` - View ticket statistics
- `/purge_compensation_db` - Delete all tickets (Owner only)

## Bot Permissions

The bot requires the following permissions:
- Manage Channels
- Manage Roles
- Send Messages
- Embed Links
- Attach Files
- Read Message History
- Add Reactions

## Configuration

The bot creates a configuration file at `config/compensation_config.json` with the following structure:

```json
{
  "category_id": "ticket_category_id",
  "support_role_id": "support_role_id",
  "request_channel_id": "request_channel_id",
  "discord_invite": "https://discord.gg/yourserver",
  "redemption_instructions": "Join the server and open a ticket",
  "ticket_channel_prefix": "ticket-"
}
```

## Database

The bot uses SQLite for data storage. The database file is created automatically at the location specified in `DATABASE_PATH` environment variable.

### Database Schema
- `ticket_id` - Unique ticket identifier
- `user_id` - Discord user ID
- `username` - Discord username
- `order_id` - Order ID from user
- `email` - User's email
- `product` - Product type
- `purchase_date` - Date of purchase
- `issue_description` - Description of the issue
- `additional_details` - Additional information (optional)
- `status` - Ticket status (pending/approved/denied/cancelled)
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp
- `approved_by` - Admin who approved (if applicable)
- `denied_by` - Admin who denied (if applicable)
- `denial_reason` - Reason for denial (if applicable)
- `notes` - Admin notes

## Auto-Mod Features

- **Inactive Ticket Reminders**: Sends reminders after 3 days of inactivity
- **Auto-Cancellation**: Automatically cancels tickets after 7 days of inactivity
- **Bot Status**: Updates bot status to show pending ticket count
- **Channel Cleanup**: Deletes ticket channels 5 minutes after resolution

## Logging

Logs are stored in the `logs/` directory:
- `combined-YYYY-MM-DD.log` - All log entries
- `error-YYYY-MM-DD.log` - Error-only logs

Logs are rotated daily and kept for:
- 14 days for combined logs
- 30 days for error logs

## Rate Limiting

- Users can only have 1 active pending ticket at a time
- Maximum 3 compensation requests per day per user
- All rate limits are enforced database-side

## Troubleshooting

### Bot doesn't respond to commands
- Check that the bot has proper permissions
- Ensure the bot token is correct in `.env`
- Verify the bot is online and connected

### Database errors
- Check that the database file path is correct
- Ensure the bot has write permissions for the database file
- Try deleting the database file and letting it recreate

### Modal doesn't appear
- Clear your Discord cache
- Ensure the bot has `applications.commands` scope
- Check that commands are properly registered

## Development

### Project Structure
```
compensation-bot/
├── src/
│   ├── index.ts              # Main entry point
│   ├── commands/             # Slash commands
│   ├── handlers/             # Interaction handlers
│   ├── database/             # Database layer
│   ├── utils/                # Utilities
│   ├── views/                # UI components
│   └── schedulers/           # Background tasks
├── config/                   # Configuration files
├── logs/                     # Log files
├── dist/                     # Compiled JavaScript
└── package.json
```

### Adding New Commands
1. Create a new file in `src/commands/`
2. Export `data` (SlashCommandBuilder) and `execute` function
3. Import and register in `src/index.ts`

## License

MIT

## Support

For issues and questions, please open an issue on the GitHub repository.