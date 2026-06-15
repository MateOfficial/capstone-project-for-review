-- V7: Build proper parent→child category hierarchy from prefix codes.
-- Prefixes (KL/GT/DR/PA/MC/ST/AV/WI/VL) become top-level parent categories.
-- Children get prefix stripped from name and parent_id set.
-- Product search_key rebuilt to include full category path.

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Insert parent categories for every known prefix
-- ──────────────────────────────────────────────────────────────────────────────
WITH store AS (
    SELECT DISTINCT store_id FROM categories LIMIT 1
),
parents (prefix, label, base_slug, sort) AS (VALUES
    ('KL', 'Клавишные',                  'klavishnye',               1),
    ('GT', 'Гитары',                     'gitary',                   2),
    ('DR', 'Ударные',                    'udarnye',                  3),
    ('PA', 'Звуковое оборудование PA',   'zvukovoe-oborudovanie-pa', 4),
    ('MC', 'Микрофоны',                  'mikrofony',                5),
    ('ST', 'Студийное оборудование',     'studiynoe-oborudovanie',   6),
    ('AV', 'Аудио и видео',              'audio-i-video',            7),
    ('WI', 'Духовые инструменты',        'duhovye-instrumenty',      8),
    ('VL', 'Смычковые инструменты',      'smychkovye-instrumenty',   9)
)
INSERT INTO categories (store_id, name, slug, parent_id, sort_order, active, created_at, updated_at)
SELECT s.store_id, p.label, p.base_slug, NULL, p.sort, true, now(), now()
FROM parents p
CROSS JOIN store s
ON CONFLICT (store_id, slug) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Link existing prefixed categories to their new parent + strip prefix from name
-- ──────────────────────────────────────────────────────────────────────────────
UPDATE categories c
SET
    parent_id  = parent.id,
    name       = btrim(regexp_replace(c.name, '^\s*[A-Z]{2,3}\s+', '', '')),
    updated_at = now()
FROM categories parent
WHERE parent.parent_id IS NULL
  AND parent.slug IN (
      'klavishnye', 'gitary', 'udarnye', 'zvukovoe-oborudovanie-pa',
      'mikrofony', 'studiynoe-oborudovanie', 'audio-i-video',
      'duhovye-instrumenty', 'smychkovye-instrumenty'
  )
  AND c.name ~* (
      CASE parent.slug
          WHEN 'klavishnye'               THEN '^\s*KL\s+'
          WHEN 'gitary'                   THEN '^\s*GT\s+'
          WHEN 'udarnye'                  THEN '^\s*DR\s+'
          WHEN 'zvukovoe-oborudovanie-pa' THEN '^\s*PA\s+'
          WHEN 'mikrofony'                THEN '^\s*MC\s+'
          WHEN 'studiynoe-oborudovanie'   THEN '^\s*ST\s+'
          WHEN 'audio-i-video'            THEN '^\s*AV\s+'
          WHEN 'duhovye-instrumenty'      THEN '^\s*WI\s+'
          WHEN 'smychkovye-instrumenty'   THEN '^\s*VL\s+'
      END
  )
  AND c.parent_id IS NULL;

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Normalize remaining standalone category names (trim, collapse spaces)
-- ──────────────────────────────────────────────────────────────────────────────
UPDATE categories
SET name       = btrim(regexp_replace(name, '\s+', ' ', 'g')),
    updated_at = now()
WHERE name <> btrim(regexp_replace(name, '\s+', ' ', 'g'));

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. Rebuild product search_key to include full category path (parent + child)
-- ──────────────────────────────────────────────────────────────────────────────
UPDATE products p
SET search_key = lower(regexp_replace(
    coalesce(p.name, '')        || ' ' ||
    coalesce(p.code, '')        || ' ' ||
    coalesce(p.description, '') || ' ' ||
    coalesce(child_cat.name, '') || ' ' ||
    coalesce(parent_cat.name, ''),
    '[^a-zа-яё0-9]+', '', 'g'
))
FROM categories child_cat
LEFT JOIN categories parent_cat ON child_cat.parent_id = parent_cat.id
WHERE child_cat.id = p.category_id;

-- also rebuild for products with no category
UPDATE products p
SET search_key = lower(regexp_replace(
    coalesce(p.name, '') || ' ' || coalesce(p.code, '') || ' ' || coalesce(p.description, ''),
    '[^a-zа-яё0-9]+', '', 'g'
))
WHERE p.category_id IS NULL;

COMMIT;
