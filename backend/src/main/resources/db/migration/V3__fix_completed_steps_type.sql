DO $$
DECLARE
    col_type text;
BEGIN
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'setup_state'
      AND column_name = 'completed_steps';

    IF col_type IS DISTINCT FROM 'jsonb' THEN
        ALTER TABLE setup_state ALTER COLUMN completed_steps DROP DEFAULT;
        ALTER TABLE setup_state ALTER COLUMN completed_steps TYPE jsonb
            USING array_to_json(completed_steps)::jsonb;
        ALTER TABLE setup_state ALTER COLUMN completed_steps SET DEFAULT '[]'::jsonb;
    END IF;
END $$;
