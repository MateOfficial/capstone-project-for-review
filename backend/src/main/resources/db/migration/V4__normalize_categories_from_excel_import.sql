-- Normalize category data produced by legacy Excel/JSON imports.
-- 1) Merge duplicate categories by normalized name per store.
-- 2) Re-point products to canonical category.
-- 3) Ensure canonical slugs are ASCII-like and stable.

WITH category_usage AS (
    SELECT
        c.id,
        c.store_id,
        c.name,
        c.slug,
        lower(regexp_replace(trim(c.name), '\\s+', ' ', 'g')) AS norm_name,
        COUNT(p.id) AS usage_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id, c.store_id, c.name, c.slug
), ranked AS (
    SELECT
        cu.*,
        ROW_NUMBER() OVER (
            PARTITION BY cu.store_id, cu.norm_name
            ORDER BY cu.usage_count DESC, cu.id ASC
        ) AS rn,
        FIRST_VALUE(cu.id) OVER (
            PARTITION BY cu.store_id, cu.norm_name
            ORDER BY cu.usage_count DESC, cu.id ASC
        ) AS keep_id
    FROM category_usage cu
), duplicates AS (
    SELECT *
    FROM ranked
    WHERE rn > 1
)
UPDATE products p
SET category_id = d.keep_id
FROM duplicates d
WHERE p.category_id = d.id;

DELETE FROM categories c
USING (
    SELECT id
    FROM (
        SELECT
            c.id,
            ROW_NUMBER() OVER (
                PARTITION BY c.store_id, lower(regexp_replace(trim(c.name), '\\s+', ' ', 'g'))
                ORDER BY COUNT(p.id) DESC, c.id ASC
            ) AS rn
        FROM categories c
        LEFT JOIN products p ON p.category_id = c.id
        GROUP BY c.id, c.store_id, c.name
    ) x
    WHERE x.rn > 1
) d
WHERE c.id = d.id;

-- Convert known Cyrillic-only slug variants from Excel imports to stable ASCII form.
UPDATE categories
SET slug = 'mikrofony'
WHERE lower(regexp_replace(trim(name), '\\s+', ' ', 'g')) = 'микрофоны';
