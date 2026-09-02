-- ============================================================
-- Casa Quest — Migration 00008: Papéis (Mor · Conselheiro · Guardião)
--
-- Em quase toda casa há dois adultos. O segundo entra como
-- "Conselheiro(a)": participa da gestão do dia a dia (confirma ações,
-- registra tropeços e extras, acompanha energia) mas não decide regras,
-- missões nem mesada — a não ser que a família ligue "poderes iguais".
--
-- Requer a 00007 (RLS por família): esta migração redefine as políticas
-- de escrita para levar o papel em conta.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Colunas
-- ------------------------------------------------------------
ALTER TABLE guardians
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'guardiao'
    CHECK (role IN ('mor', 'conselheiro', 'guardiao')),
  ADD COLUMN IF NOT EXISTS gender TEXT
    CHECK (gender IN ('m', 'f'));

COMMENT ON COLUMN guardians.role IS
  'mor = decide regras e mesada; conselheiro = adulto da gestão diária; guardiao = criança/adolescente (acesso por link)';
COMMENT ON COLUMN guardians.gender IS
  'Opcional, só para flexionar os rótulos (Conselheira, Guardiã-Mor). m ou f.';

UPDATE guardians SET role = 'mor' WHERE is_mor = true AND role <> 'mor';

ALTER TABLE families
  ADD COLUMN IF NOT EXISTS equal_powers BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS advisors_see_reward BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN families.equal_powers IS
  'Quando true, conselheiros têm os mesmos poderes do Guardião-Mor.';
COMMENT ON COLUMN families.advisors_see_reward IS
  'Quando true, conselheiros veem os valores de mesada.';

-- ------------------------------------------------------------
-- 2. is_mor e role sempre coerentes, escreva o app o que escrever
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION guardians_sync_role()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_mor THEN
      NEW.role := 'mor';
    ELSIF NEW.role = 'mor' THEN
      NEW.is_mor := true;
    END IF;
  ELSE
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      NEW.is_mor := (NEW.role = 'mor');
    ELSIF NEW.is_mor IS DISTINCT FROM OLD.is_mor THEN
      NEW.role := CASE
        WHEN NEW.is_mor THEN 'mor'
        WHEN NEW.role = 'mor' THEN 'guardiao'
        ELSE NEW.role
      END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS guardians_sync_role ON guardians;
CREATE TRIGGER guardians_sync_role
  BEFORE INSERT OR UPDATE ON guardians
  FOR EACH ROW EXECUTE FUNCTION guardians_sync_role();

-- ------------------------------------------------------------
-- 3. Helpers de autorização
-- ------------------------------------------------------------
-- Papel do usuário autenticado dentro da família dele.
CREATE OR REPLACE FUNCTION auth_role()
RETURNS TEXT AS $$
  SELECT role FROM public.guardians
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Adulto da casa (Mor ou Conselheiro).
CREATE OR REPLACE FUNCTION auth_is_adult()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(auth_role() IN ('mor', 'conselheiro'), false);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Pode decidir regras, missões, mesada, cadastros.
CREATE OR REPLACE FUNCTION auth_can_manage()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    auth_role() = 'mor'
    OR (
      auth_role() = 'conselheiro'
      AND EXISTS (
        SELECT 1 FROM public.families f
        WHERE f.id = auth_family_id() AND f.equal_powers = true
      )
    ),
    false
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------
-- 4. Políticas de escrita com papel (leitura continua por família)
-- ------------------------------------------------------------
-- FAMILIES: só quem gerencia altera regras (bootstrap do criador mantido)
DROP POLICY IF EXISTS "family_update" ON families;
CREATE POLICY "family_update"
  ON families FOR UPDATE
  USING ((id = auth_family_id() AND auth_can_manage()) OR created_by = auth.uid())
  WITH CHECK ((id = auth_family_id() AND auth_can_manage()) OR created_by = auth.uid());

-- GUARDIANS: gerenciar cadastros é do Mor; qualquer adulto edita o próprio registro
DROP POLICY IF EXISTS "guardian_insert" ON guardians;
CREATE POLICY "guardian_insert"
  ON guardians FOR INSERT
  WITH CHECK (
    (family_id = auth_family_id() AND auth_can_manage())
    OR (
      is_mor = true
      AND user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM families f
        WHERE f.id = guardians.family_id AND f.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "guardian_update" ON guardians;
CREATE POLICY "guardian_update"
  ON guardians FOR UPDATE
  USING (
    family_id = auth_family_id()
    AND (auth_can_manage() OR user_id = auth.uid())
  )
  WITH CHECK (
    family_id = auth_family_id()
    AND (auth_can_manage() OR user_id = auth.uid())
  );

DROP POLICY IF EXISTS "guardian_delete" ON guardians;
CREATE POLICY "guardian_delete"
  ON guardians FOR DELETE
  USING (family_id = auth_family_id() AND auth_can_manage() AND is_mor = false);

-- Tabelas de configuração: leitura para a família, escrita para quem gerencia
DROP POLICY IF EXISTS "action_templates_all" ON action_templates;
CREATE POLICY "action_templates_select" ON action_templates FOR SELECT
  USING (family_id = auth_family_id());
CREATE POLICY "action_templates_write" ON action_templates FOR ALL
  USING (family_id = auth_family_id() AND auth_can_manage())
  WITH CHECK (family_id = auth_family_id() AND auth_can_manage());

DROP POLICY IF EXISTS "missions_all" ON missions;
CREATE POLICY "missions_select" ON missions FOR SELECT
  USING (family_id = auth_family_id());
CREATE POLICY "missions_write" ON missions FOR ALL
  USING (family_id = auth_family_id() AND auth_can_manage())
  WITH CHECK (family_id = auth_family_id() AND auth_can_manage());

DROP POLICY IF EXISTS "escalada_categories_all" ON escalada_categories;
CREATE POLICY "escalada_categories_select" ON escalada_categories FOR SELECT
  USING (family_id = auth_family_id());
CREATE POLICY "escalada_categories_write" ON escalada_categories FOR ALL
  USING (family_id = auth_family_id() AND auth_can_manage())
  WITH CHECK (family_id = auth_family_id() AND auth_can_manage());

DROP POLICY IF EXISTS "action_assignments_all" ON action_assignments;
CREATE POLICY "action_assignments_select" ON action_assignments FOR SELECT
  USING (family_id = auth_family_id());
CREATE POLICY "action_assignments_write" ON action_assignments FOR ALL
  USING (family_id = auth_family_id() AND auth_can_manage())
  WITH CHECK (family_id = auth_family_id() AND auth_can_manage());

DROP POLICY IF EXISTS "mission_guardians_all" ON mission_guardians;
CREATE POLICY "mission_guardians_select" ON mission_guardians FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM missions m
    WHERE m.id = mission_guardians.mission_id AND m.family_id = auth_family_id()
  ));
CREATE POLICY "mission_guardians_write" ON mission_guardians FOR ALL
  USING (auth_can_manage() AND EXISTS (
    SELECT 1 FROM missions m
    WHERE m.id = mission_guardians.mission_id AND m.family_id = auth_family_id()
  ))
  WITH CHECK (auth_can_manage() AND EXISTS (
    SELECT 1 FROM missions m
    WHERE m.id = mission_guardians.mission_id AND m.family_id = auth_family_id()
  ));

-- O dia a dia (confirmar, registrar) é de qualquer adulto da casa
DROP POLICY IF EXISTS "mission_actions_all" ON mission_actions;
CREATE POLICY "mission_actions_select" ON mission_actions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM missions m
    WHERE m.id = mission_actions.mission_id AND m.family_id = auth_family_id()
  ));
CREATE POLICY "mission_actions_write" ON mission_actions FOR ALL
  USING (auth_is_adult() AND EXISTS (
    SELECT 1 FROM missions m
    WHERE m.id = mission_actions.mission_id AND m.family_id = auth_family_id()
  ))
  WITH CHECK (auth_is_adult() AND EXISTS (
    SELECT 1 FROM missions m
    WHERE m.id = mission_actions.mission_id AND m.family_id = auth_family_id()
  ));

DROP POLICY IF EXISTS "action_confirmations_all" ON action_confirmations;
CREATE POLICY "action_confirmations_select" ON action_confirmations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM mission_actions ma
    JOIN missions m ON m.id = ma.mission_id
    WHERE ma.id = action_confirmations.mission_action_id
      AND m.family_id = auth_family_id()
  ));
CREATE POLICY "action_confirmations_write" ON action_confirmations FOR ALL
  USING (auth_is_adult() AND EXISTS (
    SELECT 1 FROM mission_actions ma
    JOIN missions m ON m.id = ma.mission_id
    WHERE ma.id = action_confirmations.mission_action_id
      AND m.family_id = auth_family_id()
  ))
  WITH CHECK (auth_is_adult() AND EXISTS (
    SELECT 1 FROM mission_actions ma
    JOIN missions m ON m.id = ma.mission_id
    WHERE ma.id = action_confirmations.mission_action_id
      AND m.family_id = auth_family_id()
  ));
