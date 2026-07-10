-- Snapshot tier pricing on orders for accurate historical invoices.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS msrp_subtotal NUMERIC(10, 2);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tier_name VARCHAR(100);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tier_discount_percent NUMERIC(5, 2);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tier_discount_amount NUMERIC(10, 2);
