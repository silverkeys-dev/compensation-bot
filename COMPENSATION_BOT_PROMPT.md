# Discord.js Compensation Bot - Complete Implementation Prompt

Create a full-featured Discord.js bot for handling compensation requests. The bot manages ticket-based compensation requests with admin approval workflows.

## Core Features Required

### 1. Compensation Request System
- **Multi-part Modal Form** (2-step process):
  - Part 1: User inputs (text fields)
    - Order ID (required)
    - Email (required)
    - Product purchased (dropdown)
    - Date of purchase (required)
    - Discord username (auto-filled, readonly)
    - Issue description (paragraph text)
    - Additional details (paragraph text, optional)

  - Part 2: Confirmation after Part 1 submission
    - Shows summary of submitted data
    - Confirm or Cancel buttons
    - On Confirm: Creates ticket channel
    - On Cancel: Closes interaction

### 2. Ticket Channel Creation
- Create dedicated private ticket channel in specific category
- Channel name format: `ticket-{username}-{ticket-id}`
- Add user to channel (permission overwrite)
- Add support role to channel (permission overwrite)
- Send embed message in ticket channel with:
  - Ticket details (all form data)
  - User mention
  - Action buttons for admins (Approve, Deny, Cancel)

### 3. Admin Commands (Slash Commands)
All admin commands require OWNER or ADMIN role only.

- `/setup_compensation` - Initialize compensation system
  - Parameters: 
    - `category`: Discord category for tickets
    - `support_role`: Role that can manage tickets
  - Creates/updates config file
  - Sets up database

- `/approve_compensation` - Approve and fulfill compensation
  - Parameter: `ticket_id` (autocomplete from active tickets)
  - Actions:
    1. Mark ticket as approved in database
    2. Send DM to user with:
       - Approval message
       - Discord invite link (configurable)
       - Redemption instructions
    3. Close ticket channel
    4. Log to database

- `/deny_compensation` - Deny compensation request
  - Parameter: `ticket_id` (autocomplete)
  - Optional: `reason` (why denied)
  - Actions:
    1. Mark as denied in database
    2. Send DM to user with denial reason
    3. Close ticket channel
    4. Log to database

- `/cancel_ticket` - Cancel ticket (user or admin)
  - Parameter: `ticket_id`
  - Actions:
    1. Mark as cancelled
    2. Close ticket channel
    3. Log to database

- `/view_ticket` - View ticket details
  - Parameter: `ticket_id` (autocomplete)
  - Shows:
    - All form data
    - Current status (pending/approved/denied/cancelled)
    - Timestamps
    - Admin notes (if any)

- `/compensation_stats` - Show statistics
  - Displays:
    - Total tickets
    - Pending count
    - Approved count
    - Denied count
    - Cancelled count

- `/purge_compensation_db` - Clear all tickets (Owner only)
  - Confirmation required
  - Deletes all database records

### 4. Persistent Button Views
- **Request Button** (persistent message):
  - Posted in designated channel
  - "Request Compensation" button
  - Always available for users to click
  - Opens modal form on click

- **Ticket Action Buttons** (in each ticket channel):
  - Approve (green) - `/approve_compensation`
  - Deny (red) - `/deny_compensation`
  - Cancel (gray) - `/cancel_ticket`

### 5. Database (SQLite)
Database schema for `compensation_tickets.db`:
```sql
CREATE TABLE compensation_tickets (
    ticket_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    order_id TEXT NOT NULL,
    email TEXT NOT NULL,
    product TEXT NOT NULL,
    purchase_date TEXT NOT NULL,
    issue_description TEXT NOT NULL,
    additional_details TEXT,
    status TEXT DEFAULT 'pending', -- pending, approved, denied, cancelled
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_by TEXT,
    denied_by TEXT,
    denial_reason TEXT,
    notes TEXT
);
```

### 6. Configuration System
Config file: `config/compensation_config.json`
```json
{
  "category_id": "1234567890",
  "support_role_id": "0987654321",
  "request_channel_id": "1111111111",
  "discord_invite": "https://discord.gg/yourserver",
  "redemption_instructions": "Join the server and open a ticket",
  "ticket_channel_prefix": "ticket-"
}
```

### 7. DM Messages

**Approval DM:**
```
✅ Compensation Request Approved

Your compensation request for Order ID: {order_id} has been approved!

Next Steps:
1. Join our Discord server: {discord_invite}
2. Open a ticket in the support channel
3. Mention this order ID: {order_id}

Thank you for your patience!
```

**Denial DM:**
```
❌ Compensation Request Denied

Your compensation request for Order ID: {order_id} has been denied.

Reason: {reason}

If you believe this is an error, please contact support.
```

**Cancellation DM:**
```
⚪ Ticket Cancelled

Your compensation ticket #{ticket_id} has been cancelled.

If you still need assistance, feel free to submit a new request.
```

### 8. AutoMod Integration (Optional)
- Auto-close inactive tickets after 7 days
- Send reminder to user after 3 days of inactivity
- Auto-approve tickets that meet criteria (configurable)

## Technical Requirements

### Tech Stack
- **Node.js** (v18+)
- **discord.js** (v14.14+)
- **sqlite3** or **better-sqlite3** for database
- **dotenv** for environment variables

### Project Structure
```
compensation-bot/
├── src/
│   ├── index.js              # Main entry point
│   ├── commands/
│   │   ├── setup.js
│   │   ├── approve.js
│   │   ├── deny.js
│   │   ├── cancel.js
│   │   ├── view.js
│   │   ├── stats.js
│   │   └── purge.js
│   ├── handlers/
│   │   ├── modalHandler.js   # Modal form submission
│   │   ├── buttonHandler.js  # Button interactions
│   │   └── autocompleteHandler.js
│   ├── database/
│   │   ├── db.js             # Database connection
│   │   └── schema.sql        # Table creation
│   ├── utils/
│   │   ├── config.js         # Config management
│   │   └── helpers.js        # Utility functions
│   └── views/
│       ├── CompensationView.js       # Request button
│       ├── ConfirmationView.js       # Confirm/cancel after form
│       └── TicketActionView.js       # Approve/deny/cancel buttons
├── config/
│   └── compensation_config.json      # Bot configuration
├── logs/                           # Optional: logging directory
├── .env                            # Environment variables
├── package.json
└── README.md
```

### Environment Variables (.env)
```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_id_here
GUILD_ID=your_test_guild_id_here  # For slash command testing
OWNER_ID=your_discord_user_id
ADMIN_ROLE_ID=admin_role_id
DATABASE_PATH=./compensation_tickets.db
```

### Key Implementation Details

1. **Autocomplete for ticket_id**: Query database for tickets where status='pending', return list formatted as "ID-username (order_id)"

2. **Modal Validation**:
   - Order ID: required, alphanumeric + dashes only
   - Email: required, validate email format
   - Product: required dropdown (validate against options)
   - Purchase Date: required, validate not in future
   - Issue Description: required, min 10 chars, max 1000 chars

3. **Error Handling**:
   - All database operations in try-catch blocks
   - Discord API errors handled gracefully
   - User-friendly error messages
   - Logging to console for debugging

4. **Permission Checks**:
   - OWNER_ID can use all commands
   - ADMIN_ROLE_ID can use approve/deny/view
   - Regular users can only use request button and cancel their own tickets

5. **Rate Limiting** (optional):
   - Users can only have 1 active ticket at a time
   - Max 3 requests per day per user
   - Store timestamps in database

## Setup Instructions

1. **Initialize Project**
   ```bash
   npm init -y
   npm install discord.js dotenv better-sqlite3
   ```

2. **Create Discord Application**
   - Go to Discord Developer Portal
   - Create application
   - Enable bot
   - Get token
   - Enable necessary scopes:
     - bot
     - applications.commands
   - Enable bot permissions:
     - Manage Channels
     - Manage Roles
     - Send Messages
     - Embed Links
     - Attach Files
     - Read Message History
     - Add Reactions

3. **Register Slash Commands**
   - Use REST API or guild-based commands for testing
   - Sync commands on bot ready

4. **Deploy**
   - Push to GitHub
   - Clone on server
   - `npm install`
   - `node src/index.js`
   - Use PM2 for production: `pm2 start src/index.js --name compensation-bot`

## Additional Features (Nice to Have)

1. **Web Dashboard**: Express.js dashboard to view/manage tickets
2. **Email Notifications**: Send email on approval/denial
3. **Analytics Dashboard**: Charts showing ticket trends
4. **Multi-language Support**: i18n for different languages
5. **Custom Status**: Bot shows pending ticket count in status
6. **Backup System**: Daily database backups
7. **Audit Log**: Log all admin actions to file
8. **Ticket Transfers**: Allow admins to reassign tickets
9. **Bulk Actions**: Approve/deny multiple tickets at once
10. **Custom Fields**: Allow server owners to add custom form fields

## Testing Checklist

- [ ] Modal form submission works
- [ ] Ticket channel created correctly
- [ ] User has access to ticket channel
- [ ] Admin has access to ticket channel
- [ ] Approve button sends DM to user
- [ ] Deny button sends DM with reason
- [ ] Cancel button closes ticket
- [ ] Database records are accurate
- [ ] Autocomplete works for ticket_id
- [ ] Config file updates correctly
- [ ] Permission checks work (owner/admin/user)
- [ ] Error messages are user-friendly
- [ ] Bot reconnection after disconnect
- [ ] Multiple tickets don't interfere
- [ ] Database handles concurrent requests

## Example Interaction Flow

**User Flow:**
1. User clicks "Request Compensation" button
2. Part 1 modal opens → User fills form → Submits
3. Part 2 confirmation modal shows → User clicks Confirm
4. Ticket channel created → User added → Embed shown
5. (Wait for admin)
6. User receives DM (approved/denied/cancelled)
7. Ticket channel closed/deleted

**Admin Flow:**
1. `/setup_compensation category:#tickets support_role:@Support`
2. Bot posts request button in request channel
3. Ticket created → Notified
4. Goes to ticket channel → Reviews info
5. Clicks Approve/Deny button → Confirms
6. Bot handles DM + close channel
7. `/compensation_stats` → View metrics

---

## IMPORTANT NOTES FOR IMPLEMENTATION

- **DM Fallback**: If user has DMs closed, send message in ticket channel instead
- **Channel Deletion**: Delete ticket channels 5 minutes after closing (not immediately)
- **Database Migrations**: Include version tracking for future schema changes
- **Config Hot Reload**: Watch config file for changes and reload without restart
- **Graceful Shutdown**: Handle SIGINT/SIGTERM, close database connection
- **Logging**: Use winston or pino for production logging
- **Input Sanitization**: Escape all user input to prevent injection attacks
- **Rate Limiting**: Implement per-user rate limits on form submissions
- **Ticket ID Format**: Use sequential integers or UUIDs for ticket IDs

Start by implementing the core flow (request → ticket → approve/deny), then add the advanced features incrementally.
