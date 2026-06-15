-- V10: Add barcode and warehouse_name to products for 1С two-file import
-- barcode = штрихкод — ключ для автоматического совпадения без подтверждения
-- warehouse_name = название склада из 1С (показывается в каталоге)

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS barcode VARCHAR(50),
    ADD COLUMN IF NOT EXISTS warehouse_name VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_products_barcode
    ON products(store_id, barcode)
    WHERE barcode IS NOT NULL;
