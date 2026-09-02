-- ============================================================
-- Casa Quest — Migration 00007: RLS completo (multi-família)
--
-- PROBLEMA: o RLS foi desligado em todas as tabelas (scripts/fix-rls.mjs)
-- porque as políticas da 00002 quebravam o onboarding: a família é criada
-- antes do guardião-mor existir, então `auth_family_id()` era NULL e nem o
-- SELECT de retorno do INSERT passava. Com RLS desligado, qualquer pessoa
-- com a chave anon pública lê e altera os dados de todas as famílias.
--
-- DECISÃO: uma política ampla por tabela — quem está autenticado só
-- enxerga e altera linhas da própria família — mais duas exceções de
-- bootstrap para o onboarding (família criada por mim; meu próprio
-- registro de guardião-mor). Os guardiões (crianças) nunca usam RLS:
-- entram por token e o servidor usa a service role depois de validar.
--
-- Idempotente: pode rodar de novo com segurança.
-- ============================================================

-- ------------------------------------------------------------
-- Helper: família do usuário autenticado
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION auth_family_id()
RETURNS UUID AS $$
  SELECT family_id FROM public.guardians
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------
-- Limpa políticas antigas (nomes da 00002 e desta migração)
-- ------------------------------------------------------------
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'families', 'guardians', 'action_templates', 'missions',
        'mission_guardians', 'mission_actions', 'action_confirmations',
        'energy_events', 'cooperation_events', 'escalada_categories',
        'action_assignments'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- FAMILIES
-- ------------------------------------------------------------
ALTER TABLE families ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family_select"
  ON families FOR SELECT
  USING (id = auth_family_id() OR created_by = auth.uid());

CREATE POLICY "family_insert"
  ON families FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE POLICY "family_update"
  ON families FOR UPDATE
  USING (id = auth_family_id() OR created_by = auth.uid())
  WITH CHECK (id = auth_family_id() OR created_by = auth.uid());

CREATE POLICY "family_delete"
  ON families FOR DELETE
  USING (created_by = auth.uid());

-- ------------------------------------------------------------
-- GUARDIANS
-- ------------------------------------------------------------
ALTER TABLE guardians ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guardian_select"
  ON guardians FOR SELECT
  USING (family_id = auth_family_id() OR user_id = auth.uid());

-- Bootstrap: o criador da família insere o próprio registro de Mor;
-- depois disso, o Mor insere os demais guardiões da família.
CREATE POLICY "guardian_insert"
  ON guardians FOR INSERT
  WITH CHECK (
    family_id = auth_family_id()
    OR (
      is_mor = true
      AND user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM families f
        WHERE f.id = guardians.family_id AND f.created_by = auth.uid()
      )
    )
  );

CREATE POLICY "guardian_update"
  ON guardians FOR UPDATE
  USING (family_id = auth_family_id())
  WITH CHECK (family_id = auth_family_id());

CREATE POLICY "guardian_delete"
  ON guardians FOR DELETE
  USING (family_id = auth_family_id() AND is_mor = false);

-- ------------------------------------------------------------
-- Tabelas com family_id direto
-- ------------------------------------------------------------
ALTER TABLE action_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "action_templates_all"
  ON action_templates FOR ALL
  USING (family_id = auth_family_id())
  WITH CHECK (family_id = auth_family_id());

ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "missions_all"
  ON missions FOR ALL
  USING (family_id = auth_family_id())
  WITH CHECK (family_id = auth_family_id());

ALTER TABLE escalada_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "escalada_categories_all"
  ON escalada_categories FOR ALL
  USING (family_id = auth_family_id())
  WITH CHECK (family_id = auth_family_id());

ALTER TABLE action_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "action_assignments_all"
  ON action_assignments FOR ALL
  USING (family_id = auth_family_id())
  WITH CHECK (family_id = auth_family_id());

-- ------------------------------------------------------------
-- Tabelas ligadas à missão
-- ------------------------------------------------------------
ALTER TABLE mission_guardians ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mission_guardians_all"
  ON mission_guardians FOR ALL
  USING (EXISTS (
    SELECT 1 FROM missions m
    WHERE m.id = mission_guardians.mission_id AND m.family_id = auth_family_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM missions m
    WHERE m.id = mission_guardians.mission_id AND m.family_id = auth_family_id()
  ));

ALTER TABLE mission_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mission_actions_all"
  ON mission_actions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM missions m
    WHERE m.id = mission_actions.mission_id AND m.family_id = auth_family_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM missions m
    WHERE m.id = mission_actions.mission_id AND m.family_id = auth_family_id()
  ));

ALTER TABLE energy_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "energy_events_select"
  ON energy_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM missions m
    WHERE m.id = energy_events.mission_id AND m.family_id = auth_family_id()
  ));
CREATE POLICY "energy_events_insert"
  ON energy_events FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM missions m
    WHERE m.id = energy_events.mission_id AND m.family_id = auth_family_id()
  ));

ALTER TABLE cooperation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cooperation_events_select"
  ON cooperation_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM missions m
    WHERE m.id = cooperation_events.mission_id AND m.family_id = auth_family_id()
  ));
CREATE POLICY "cooperation_events_insert"
  ON cooperation_events FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM missions m
    WHERE m.id = cooperation_events.mission_id AND m.family_id = auth_family_id()
  ));

-- ------------------------------------------------------------
-- Confirmações (ligadas à ação → missão)
-- ------------------------------------------------------------
ALTER TABLE action_confirmations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "action_confirmations_all"
  ON action_confirmations FOR ALL
  USING (EXISTS (
    SELECT 1 FROM mission_actions ma
    JOIN missions m ON m.id = ma.mission_id
    WHERE ma.id = action_confirmations.mission_action_id
      AND m.family_id = auth_family_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM mission_actions ma
    JOIN missions m ON m.id = ma.mission_id
    WHERE ma.id = action_confirmations.mission_action_id
      AND m.family_id = auth_family_id()
  ));

-- ------------------------------------------------------------
-- Garante os grants básicos (PostgREST usa anon/authenticated).
-- Com RLS ligado, anon não passa por nenhuma política: lê nada.
-- ------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
