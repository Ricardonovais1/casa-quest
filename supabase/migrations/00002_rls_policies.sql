-- ============================================================
-- Casa Quest — RLS Policies
-- Allows authenticated users to access their own family's data.
-- Uses the guardians.user_id column to link auth.users to families.
-- ============================================================

-- Helper: get the family_id for the authenticated user
-- Returns the family_id of the guardian record linked to auth.uid()
CREATE OR REPLACE FUNCTION auth_family_id()
RETURNS UUID AS $$
  SELECT family_id FROM public.guardians
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- FAMILIES
-- ============================================================
ALTER TABLE families ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read own family"
  ON families FOR SELECT
  USING (id = auth_family_id());

CREATE POLICY "Mor can update own family"
  ON families FOR UPDATE
  USING (id = auth_family_id())
  WITH CHECK (id = auth_family_id());

CREATE POLICY "Authenticated users can insert families"
  ON families FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- GUARDIANS
-- ============================================================
ALTER TABLE guardians ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read guardians in their family"
  ON guardians FOR SELECT
  USING (family_id = auth_family_id());

CREATE POLICY "Mor can insert guardians"
  ON guardians FOR INSERT
  WITH CHECK (
    family_id = auth_family_id()
    AND EXISTS (
      SELECT 1 FROM guardians g
      WHERE g.family_id = auth_family_id()
        AND g.user_id = auth.uid()
        AND g.is_mor = true
    )
  );

CREATE POLICY "Mor can update guardians"
  ON guardians FOR UPDATE
  USING (family_id = auth_family_id())
  WITH CHECK (family_id = auth_family_id());

-- ============================================================
-- ACTION TEMPLATES
-- ============================================================
ALTER TABLE action_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read action templates"
  ON action_templates FOR SELECT
  USING (family_id = auth_family_id());

CREATE POLICY "Mor can manage action templates"
  ON action_templates FOR INSERT
  WITH CHECK (family_id = auth_family_id());

CREATE POLICY "Mor can update action templates"
  ON action_templates FOR UPDATE
  USING (family_id = auth_family_id());

-- ============================================================
-- MISSIONS
-- ============================================================
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read missions"
  ON missions FOR SELECT
  USING (family_id = auth_family_id());

CREATE POLICY "Mor can manage missions"
  ON missions FOR INSERT
  WITH CHECK (family_id = auth_family_id());

CREATE POLICY "Mor can update missions"
  ON missions FOR UPDATE
  USING (family_id = auth_family_id());

-- ============================================================
-- MISSION GUARDIANS
-- ============================================================
ALTER TABLE mission_guardians ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read mission_guardians"
  ON mission_guardians FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM missions m
      WHERE m.id = mission_guardians.mission_id
        AND m.family_id = auth_family_id()
    )
  );

CREATE POLICY "Mor can manage mission_guardians"
  ON mission_guardians FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM missions m
      WHERE m.id = mission_guardians.mission_id
        AND m.family_id = auth_family_id()
    )
  );

CREATE POLICY "Mor can update mission_guardians"
  ON mission_guardians FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM missions m
      WHERE m.id = mission_guardians.mission_id
        AND m.family_id = auth_family_id()
    )
  );

-- ============================================================
-- MISSION ACTIONS
-- ============================================================
ALTER TABLE mission_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read mission_actions"
  ON mission_actions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM missions m
      WHERE m.id = mission_actions.mission_id
        AND m.family_id = auth_family_id()
    )
  );

CREATE POLICY "Mor can manage mission_actions"
  ON mission_actions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM missions m
      WHERE m.id = mission_actions.mission_id
        AND m.family_id = auth_family_id()
    )
  );

CREATE POLICY "Guardian can update own actions"
  ON mission_actions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM guardians g
      WHERE g.id = mission_actions.guardian_id
        AND g.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM missions m
      JOIN guardians g ON g.family_id = m.family_id
      WHERE m.id = mission_actions.mission_id
        AND g.user_id = auth.uid()
        AND g.is_mor = true
    )
  );

-- ============================================================
-- ACTION CONFIRMATIONS
-- ============================================================
ALTER TABLE action_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read confirmations"
  ON action_confirmations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM mission_actions ma
      JOIN missions m ON m.id = ma.mission_id
      WHERE ma.id = action_confirmations.mission_action_id
        AND m.family_id = auth_family_id()
    )
  );

CREATE POLICY "Eligible confirmers can insert"
  ON action_confirmations FOR INSERT
  WITH CHECK (
    guardian_id = (SELECT id FROM guardians WHERE user_id = auth.uid() LIMIT 1)
  );

-- ============================================================
-- ENERGY EVENTS
-- ============================================================
ALTER TABLE energy_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read energy_events"
  ON energy_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM missions m
      WHERE m.id = energy_events.mission_id
        AND m.family_id = auth_family_id()
    )
  );

CREATE POLICY "Authenticated users can insert energy_events"
  ON energy_events FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- COOPERATION EVENTS
-- ============================================================
ALTER TABLE cooperation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read cooperation_events"
  ON cooperation_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM missions m
      WHERE m.id = cooperation_events.mission_id
        AND m.family_id = auth_family_id()
    )
  );

CREATE POLICY "Authenticated users can insert cooperation_events"
  ON cooperation_events FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- ESCALADA CATEGORIES
-- ============================================================
ALTER TABLE escalada_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read escalada_categories"
  ON escalada_categories FOR SELECT
  USING (family_id = auth_family_id());

CREATE POLICY "Mor can manage escalada_categories"
  ON escalada_categories FOR INSERT
  WITH CHECK (family_id = auth_family_id());
