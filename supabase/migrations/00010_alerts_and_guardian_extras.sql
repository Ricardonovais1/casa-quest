-- ============================================================
-- Casa Quest — Migration 00010: alertas de desempenho + extras do guardião
--
-- 1. ALERTA DE DESEMPENHO
--    Quando um guardião fica em 70% da meta ou abaixo, os adultos da
--    casa recebem um e-mail acolhedor com o que fazer no app e fora
--    dele. Para não virar spam, cada envio fica registrado: um alerta
--    por guardião a cada poucos dias, dentro da mesma missão.
--
-- 2. EXTRAS DO GUARDIÃO
--    Missão extra e escalada viram um conceito só ("evento extra") e o
--    próprio guardião pode registrar pelo link dele, sem esperar
--    aprovação. Tropeço continua sendo só dos adultos — por isso a
--    coluna que marca quem registrou.
--
-- Idempotente: pode rodar de novo com segurança.
-- Requer a 00007 (RLS por família) e a 00008 (papéis).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Configuração do alerta, por família
-- ------------------------------------------------------------
ALTER TABLE families
  ADD COLUMN IF NOT EXISTS performance_alerts_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS performance_alert_threshold INT NOT NULL DEFAULT 70;

COMMENT ON COLUMN families.performance_alerts_enabled IS
  'Quando true, os adultos recebem e-mail quando um guardião cai até o limite de energia.';
COMMENT ON COLUMN families.performance_alert_threshold IS
  'Energia (em % da meta) em que o alerta dispara. Padrão 70: "igual ou abaixo de 70%".';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'families'::regclass AND conname = 'families_alert_threshold_range'
  ) THEN
    ALTER TABLE families
      ADD CONSTRAINT families_alert_threshold_range
      CHECK (performance_alert_threshold BETWEEN 10 AND 100);
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. Histórico de alertas enviados (evita repetir o mesmo aviso)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS performance_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  guardian_id UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,

  -- Retrato do momento do envio, para o histórico fazer sentido depois.
  energy_percentage INT NOT NULL,
  threshold_percentage INT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('atencao', 'recuperacao', 'critico')),

  -- Para quem foi (e se saiu mesmo).
  recipients TEXT[] NOT NULL DEFAULT '{}',
  delivered BOOLEAN NOT NULL DEFAULT false,
  error TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_performance_alerts_lookup
  ON performance_alerts (guardian_id, mission_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_performance_alerts_family
  ON performance_alerts (family_id, created_at DESC);

ALTER TABLE performance_alerts ENABLE ROW LEVEL SECURITY;

-- Leitura para a própria família; a escrita é só do servidor (service role,
-- que ignora RLS) — nenhuma política de INSERT/UPDATE de propósito.
DROP POLICY IF EXISTS "performance_alerts_select" ON performance_alerts;
CREATE POLICY "performance_alerts_select" ON performance_alerts FOR SELECT
  USING (family_id = auth_family_id());

-- ------------------------------------------------------------
-- 3. Quem registrou o evento extra
-- ------------------------------------------------------------
-- O guardião passa a registrar as próprias missões extras/escaladas.
-- Guardar a autoria mantém a diferença visível no painel ("registrado
-- por Ana") e deixa auditável que tropeço nunca vem do guardião.
ALTER TABLE mission_actions
  ADD COLUMN IF NOT EXISTS recorded_by_guardian_id UUID REFERENCES guardians(id) ON DELETE SET NULL;

COMMENT ON COLUMN mission_actions.recorded_by_guardian_id IS
  'Quem registrou o evento extra: um adulto da casa ou o próprio guardião (autonomia). NULL para as ações geradas pelo ciclo diário.';

CREATE INDEX IF NOT EXISTS idx_mission_actions_recorded_by
  ON mission_actions (recorded_by_guardian_id);
