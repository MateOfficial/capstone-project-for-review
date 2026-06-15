-- V9: Add API key for automatic 1С sync over local network
-- Allows 1С to push stock data via HTTP without JWT login.

ALTER TABLE integration_settings
    ADD COLUMN IF NOT EXISTS sync_api_key VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_settings_api_key
    ON integration_settings(sync_api_key)
    WHERE sync_api_key IS NOT NULL;
