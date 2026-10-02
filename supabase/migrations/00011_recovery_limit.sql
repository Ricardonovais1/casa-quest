-- ============================================================
-- Casa Quest — Migration 00011: limite da compensação por missões extras
--
-- Até aqui, as extras compensavam as faltas até zerá-las, nunca além.
-- Agora a casa escolhe: só uma parte das faltas (ex.: 50%), todas (100,
-- o comportamento de sempre) ou sem limite (1000), quando as extras
-- podem levar a energia acima de 100.
--
-- Idempotente. Casas existentes ficam em 100 (nada muda para elas).
-- ============================================================
ALTER TABLE families
  ADD COLUMN IF NOT EXISTS recovery_limit_percent INT NOT NULL DEFAULT 100;

COMMENT ON COLUMN families.recovery_limit_percent IS
  'Máximo da energia perdida em faltas que as extras podem devolver (%). 100 = só até compensar; 1000 = sem limite (pode passar de 100).';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'families'::regclass AND conname = 'families_recovery_limit_range'
  ) THEN
    ALTER TABLE families
      ADD CONSTRAINT families_recovery_limit_range
      CHECK (recovery_limit_percent BETWEEN 0 AND 1000);
  END IF;
END $$;
