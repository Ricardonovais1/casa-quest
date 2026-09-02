-- ============================================================
-- Casa Quest — Migration 00006: Daily cycle
--
-- 1. Idempotência da geração diária: uma ação por (missão, guardião,
--    template, horário). Duas aberturas simultâneas do app não podem
--    duplicar a lista do dia.
-- 2. Índice para a varredura de faltas (pendentes por missão).
-- 3. Frequência padrão em português, igual ao catálogo.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_mission_actions_daily
  ON mission_actions (mission_id, guardian_id, action_template_id, due_at);

CREATE INDEX IF NOT EXISTS idx_mission_actions_mission_status
  ON mission_actions (mission_id, status);

ALTER TABLE action_templates
  ALTER COLUMN frequency SET DEFAULT 'diária';

-- Ações antigas criadas com o padrão em inglês.
UPDATE action_templates SET frequency = 'diária' WHERE frequency = 'daily';
