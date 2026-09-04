-- ============================================================
-- Casa Quest — Migration 00009: horário opcional + fim do dia
--
-- PROBLEMA: toda ação nascia com horário (20:00 do catálogo). Na vida
-- real são variáveis demais — a criança chega da escola em horas
-- diferentes, o dia muda. Marcar hora para tudo cria falta onde não
-- havia problema nenhum.
--
-- DECISÃO: horário passa a ser opcional. `default_due_time` NULL = "sem
-- hora marcada": a ação vale o dia inteiro e só vira falta quando o dia
-- fecha, no `day_end_time` da família (22:00 por padrão, o Mor muda em
-- Configurações). Quem quiser marcar uma hora continua podendo — aí
-- valem o horário e a tolerância, como antes.
--
-- Idempotente: pode rodar de novo com segurança.
-- ============================================================

-- ------------------------------------------------------------
-- Fim do dia por família
-- ------------------------------------------------------------
ALTER TABLE families
  ADD COLUMN IF NOT EXISTS day_end_time TIME NOT NULL DEFAULT '22:00';

COMMENT ON COLUMN families.day_end_time IS
  'Hora em que o dia fecha: o que estava pendente e não tem hora marcada vira falta.';

-- ------------------------------------------------------------
-- Horário deixa de ser obrigatório nas ações
-- ------------------------------------------------------------
ALTER TABLE action_templates
  ALTER COLUMN default_due_time DROP DEFAULT;

COMMENT ON COLUMN action_templates.default_due_time IS
  'Hora marcada da ação. NULL = sem hora: vale o dia todo e fecha no day_end_time da família.';

-- As ações que ainda estão no 20:00 do catálogo nunca tiveram esse
-- horário escolhido de propósito — ficam sem hora marcada. Quem tem
-- outro horário (07:00, por exemplo) foi escolha de alguém e continua.
UPDATE action_templates
   SET default_due_time = NULL
 WHERE default_due_time = '20:00';
