-- Normalize product names imported from Excel/legacy JSON where model prefixes were split.
-- Examples fixed: "Y DP65" -> "YDP65", "C LP735B" -> "CLP735B", "D SP 4SEU" -> "DSP4SEU".

-- 1) Basic cleanup: trim and collapse repeated spaces.
UPDATE products
SET name = btrim(regexp_replace(name, '\\s+', ' ', 'g'))
WHERE name IS NOT NULL
  AND name <> btrim(regexp_replace(name, '\\s+', ' ', 'g'));

-- 2) Join pattern: "D SP 4SEU" -> "DSP4SEU".
UPDATE products
SET name = regexp_replace(
    name,
    '^\\s*([A-Za-z])\\s+([A-Za-z]{1,4})\\s+(\\d[A-Za-z0-9-]*)',
    '\\1\\2\\3',
    'i'
)
WHERE name ~* '^\\s*[A-Za-z]\\s+[A-Za-z]{1,4}\\s+\\d[A-Za-z0-9-]*';

-- 3) Join pattern: "C LP735B" / "Y DP65" / "A 1031-U" -> "CLP735B" / "YDP65" / "A1031-U".
UPDATE products
SET name = regexp_replace(
    name,
    '^\\s*([A-Za-z])\\s+([A-Za-z0-9-]*\\d[A-Za-z0-9-]*)',
    '\\1\\2',
    'i'
)
WHERE name ~* '^\\s*[A-Za-z]\\s+[A-Za-z0-9-]*\\d[A-Za-z0-9-]*';

-- 4) Join split numeric suffix in first token: "DBR1 0" -> "DBR10".
UPDATE products
SET name = regexp_replace(
    name,
    '^\\s*([A-Za-z0-9-]*\\d)\\s+(\\d+)(\\b|$)',
    '\\1\\2\\3',
    'i'
)
WHERE name ~* '^\\s*[A-Za-z0-9-]*\\d\\s+\\d+(\\b|$)';

-- 5) Join split single-letter suffix: "CSP150 B" -> "CSP150B".
UPDATE products
SET name = regexp_replace(
    name,
    '^\\s*([A-Za-z0-9-]*\\d[A-Za-z0-9-]*)\\s+([A-Za-z])(\\b|$)',
    '\\1\\2\\3',
    'i'
)
WHERE name ~* '^\\s*[A-Za-z0-9-]*\\d[A-Za-z0-9-]*\\s+[A-Za-z](\\b|$)';

-- 6) Uppercase model token before first space to keep standard model formatting.
UPDATE products
SET name = upper(split_part(name, ' ', 1)) ||
           CASE WHEN strpos(name, ' ') > 0 THEN substr(name, strpos(name, ' ')) ELSE '' END
WHERE name IS NOT NULL
  AND split_part(name, ' ', 1) ~ '[A-Za-z]';

-- 7) Rebuild search key from normalized fields.
UPDATE products
SET search_key = lower(
    regexp_replace(
        coalesce(name, '') || ' ' || coalesce(code, '') || ' ' || coalesce(description, ''),
        '[^a-zа-яё0-9]+',
        '',
        'g'
    )
);
