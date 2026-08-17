-- ============================================================
-- Casa Quest — Migration 00003: Categories + Points
-- 1. Adds the 'tropecos' category (negative-point actions)
-- 2. Adds a `points` column to action_templates (can be negative)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Extend action_templates.category to include 'tropecos'
--    We locate the real CHECK constraint dynamically so we don't
--    depend on the auto-generated name (action_templates_category_check).
-- ------------------------------------------------------------
DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT c.conname INTO con_name
  FROM pg_constraint c
  WHERE c.conrelid = 'action_templates'::regclass
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%habitos%'
  LIMIT 1;

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE action_templates DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE action_templates
  ADD CONSTRAINT action_templates_category_check
  CHECK (category IN (
    'habitos', 'cooperacao', 'missoes', 'gentilezas',
    'autoaperfeicoamento', 'rendimento_escolar', 'tropecos'
  ));

-- ------------------------------------------------------------
-- 2. Points column (positive for habits/cooperation/missions,
--    negative for tropecos)
-- ------------------------------------------------------------
ALTER TABLE action_templates
  ADD COLUMN IF NOT EXISTS points INT NOT NULL DEFAULT 0;
