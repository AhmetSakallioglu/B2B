-- Texas sales tax snapshot on orders (rate + amount; total_price remains tax-inclusive grand total).

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(6, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN orders.tax_rate IS 'Applied sales tax rate at checkout (e.g. 0.0825 for Texas 8.25%). 0 when exempt or legacy order.';
COMMENT ON COLUMN orders.tax_amount IS 'Sales tax collected on this order.';
COMMENT ON COLUMN orders.subtotal IS 'Tier-discounted merchandise subtotal before coupon.';
COMMENT ON COLUMN orders.total_price IS 'Final amount charged (taxable subtotal after coupon + tax_amount).';
