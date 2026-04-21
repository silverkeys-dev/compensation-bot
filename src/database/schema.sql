-- Bunni Key Compensation Tickets Database Schema

CREATE TABLE IF NOT EXISTS compensation_tickets (
    ticket_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    key_type TEXT NOT NULL,
    reseller_name TEXT NOT NULL,
    bunni_key TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_by TEXT,
    denied_by TEXT,
    denial_reason TEXT,
    notes TEXT
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_status ON compensation_tickets(status);
CREATE INDEX IF NOT EXISTS idx_user_id ON compensation_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_created_at ON compensation_tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_key_type ON compensation_tickets(key_type);
