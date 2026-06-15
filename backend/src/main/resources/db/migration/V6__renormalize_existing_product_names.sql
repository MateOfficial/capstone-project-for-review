-- Re-normalize existing products after legacy imports.
-- This migration is intentionally idempotent and can run on populated DB.

UPDATE products
SET name = btrim(regexp_replace(name, '\\s+', ' ', 'g'))
WHERE name IS NOT NULL
  AND name <> btrim(regexp_replace(name, '\\s+', ' ', 'g'));

UPDATE products
SET name = regexp_replace(name, '^\\s*([A-Za-z])\\s+([A-Za-z]{1,4})\\s+(\\d[A-Za-z0-9-]*)', '\\1\\2\\3', 'i')
WHERE name ~* '^\\s*[A-Za-z]\\s+[A-Za-z]{1,4}\\s+\\d[A-Za-z0-9-]*';

UPDATE products
SET name = regexp_replace(name, '^\\s*([A-Za-z])\\s+([A-Za-z0-9-]*\\d[A-Za-z0-9-]*)', '\\1\\2', 'i')
WHERE name ~* '^\\s*[A-Za-z]\\s+[A-Za-z0-9-]*\\d[A-Za-z0-9-]*';

UPDATE products
SET name = regexp_replace(name, '^\\s*([A-Za-z0-9-]*\\d)\\s+(\\d+)(\\b|$)', '\\1\\2\\3', 'i')
WHERE name ~* '^\\s*[A-Za-z0-9-]*\\d\\s+\\d+(\\b|$)';

UPDATE products
SET name = regexp_replace(name, '^\\s*([A-Za-z0-9-]*\\d[A-Za-z0-9-]*)\\s+([A-Za-z])(\\b|$)', '\\1\\2\\3', 'i')
WHERE name ~* '^\\s*[A-Za-z0-9-]*\\d[A-Za-z0-9-]*\\s+[A-Za-z](\\b|$)';

UPDATE products
SET name = upper(split_part(name, ' ', 1)) ||
           CASE WHEN strpos(name, ' ') > 0 THEN substr(name, strpos(name, ' ')) ELSE '' END
WHERE name IS NOT NULL
  AND split_part(name, ' ', 1) ~ '[A-Za-z]';

UPDATE products
SET search_key = lower(
    regexp_replace(
        coalesce(name, '') || ' ' || coalesce(code, '') || ' ' || coalesce(description, ''),
        '[^a-zа-яё0-9]+',
        '',
        'g'
    )
);
