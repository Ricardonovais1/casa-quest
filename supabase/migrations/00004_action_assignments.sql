-- ============================================================
-- Casa Quest — Migration 00004: Action Assignments (Distribution)
-- Standing monthly distribution of collaborative actions to guardians.
-- ============================================================

-- Rotation interval (1, 2 or 3 months) per family
ALTER TABLE families
  ADD COLUMN IF NOT EXISTS rotation_interval_months INT NOT NULL DEFAULT 1;

-- ============================================================
-- ACTION ASSIGNMENTS
-- One row = one collaborative action assigned to one guardian
-- for a validity period (valid_from .. valid_until, inclusive).
-- ============================================================
CREATE TABLE IF NOT EXISTS action_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  action_template_id UUID NOT NULL REFERENCES action_templates(id) ON DELETE CASCADE,
  guardian_id UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  valid_from DATE NOT NULL,
  valid_until DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- one assignment per action per period
  UNIQUE(action_template_id, valid_from)
);

CREATE INDEX IF NOT EXISTS idx_assignments_family ON action_assignments(family_id);
CREATE INDEX IF NOT EXISTS idx_assignments_guardian ON action_assignments(guardian_id, valid_from);

-- Supabase may enable RLS on new tables by default. Disable it explicitly so
-- it matches this project's environment (RLS is disabled app-wide via
-- scripts/fix-rls.mjs). All app queries scope by family_id.
ALTER TABLE action_assignments DISABLE ROW LEVEL SECURITY;
