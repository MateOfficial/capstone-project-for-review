-- Add client_id FK to issuance_acts to properly link issuance acts to CRM clients
ALTER TABLE issuance_acts
    ADD COLUMN IF NOT EXISTS client_id BIGINT REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_issuance_acts_client ON issuance_acts(client_id);
