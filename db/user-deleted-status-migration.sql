-- Soft-deleted members stay in the system with account_status = 'deleted'.

ALTER TYPE account_status ADD VALUE IF NOT EXISTS 'deleted';
