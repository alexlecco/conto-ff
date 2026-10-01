-- Waiter orders: orders placed by employees on behalf of clients
ALTER TABLE orders ADD COLUMN IF NOT EXISTS waiter_order BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payed BOOLEAN DEFAULT FALSE;
