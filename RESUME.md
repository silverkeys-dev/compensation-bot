# ✅ Fixed: Channel Deletion Creates Stale Pending Tickets

## Problem

When a compensation channel is manually deleted by an admin, the database still contains a ticket with `status='pending'`. The rate limiting system only checks the database, not if the Discord channel exists, blocking users from creating new tickets.

## Root Cause

`src/utils/rateLimit.ts` calls `db.checkUserActiveTicket()` which only queries the database:
```sql
SELECT COUNT(*) FROM compensation_tickets
WHERE user_id = ? AND status = 'pending'
```

It doesn't verify the Discord channel actually exists.

## Solution

Modify `canSubmitTicket()` to use the existing `getPendingTicketsWithChannelCheck()` function that:
1. Fetches pending tickets
2. Checks if Discord channels exist
3. Auto-cancels tickets with missing channels

## Files to Modify

### 1. `src/utils/rateLimit.ts`

Add `Client` parameter and use channel verification:

```typescript
export async function canSubmitTicket(
  userId: string,
  username: string,
  client: Client  // NEW parameter
): Promise<RateLimitResult> {
  try {
    const db = await getDatabase();

    // Check for pending tickets AND verify channels exist
    const pendingTickets = await db.getPendingTicketsWithChannelCheck(client);
    const hasActiveTicket = pendingTickets.some(t => t.user_id === userId);

    if (hasActiveTicket) {
      return {
        allowed: false,
        reason: 'You already have an active pending ticket...'
      };
    }

    // ... rest of rate limit checks unchanged
  }
}
```

### 2. `src/handlers/buttonHandler.ts`

Update line 65 to pass the client:

```typescript
const rateLimit = await canSubmitTicket(user.id, user.username, interaction.client);
```

Add import:
```typescript
import { Client } from 'discord.js';
```

## Testing Checklist

- [ ] Create ticket → manually delete channel → create new ticket (should work)
- [ ] Create ticket → try to create second ticket (should be blocked)
- [ ] Verify database shows old ticket as `cancelled` after manual deletion
- [ ] Test admin operations (approve/deny/cancel) still work
- [ ] Check logs for auto-cancellation messages

## Notes

- The fix reuses existing infrastructure (`getPendingTicketsWithChannelCheck()`)
- Fail-open policy preserved for network issues
- Auto-cancels stale tickets with log messages
