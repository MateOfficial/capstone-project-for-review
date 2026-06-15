-- V11: Add warehouse_stock jsonb column for per-warehouse stock breakdown
ALTER TABLE products ADD COLUMN IF NOT EXISTS warehouse_stock jsonb;
