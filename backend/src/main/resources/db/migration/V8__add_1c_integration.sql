-- V8: 1С Integration groundwork
-- Adds external_sku field to products for mapping to 1С SKUs,
-- and integration_settings table for storing provider credentials.

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS external_sku VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_products_external_sku
    ON products(store_id, external_sku)
    WHERE external_sku IS NOT NULL;

CREATE TABLE IF NOT EXISTS integration_settings (
    id                      BIGSERIAL PRIMARY KEY,
    store_id                BIGINT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    provider                VARCHAR(50) NOT NULL,       -- '1c', 'iiko', 'moysklad', etc.
    base_url                VARCHAR(500),
    username                VARCHAR(255),
    password_hash           VARCHAR(500),
    sync_enabled            BOOLEAN DEFAULT FALSE,
    sync_interval_minutes   INTEGER DEFAULT 60,
    last_sync_at            TIMESTAMP,
    last_sync_count         INTEGER DEFAULT 0,
    created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(store_id, provider)
);
