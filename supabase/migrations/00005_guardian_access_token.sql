-- ============================================================
-- Casa Quest — Guardian access token (recoverable)
--
-- PROBLEMA: o token só era guardado como SHA-256 (`access_token_hash`),
-- então o link em texto puro aparecia uma única vez e era perdido.
-- Do painel do Guardião-Mor sobrava apenas "Link ativo" + "Revogar",
-- sem nenhum link clicável ou copiável.
--
-- DECISÃO: guardar também o token em texto puro. O link dá acesso apenas
-- à lista de tarefas de um guardião da própria família, e a RLS de
-- `guardians` já restringe leitura a `family_id = auth_family_id()`.
-- O hash continua existindo para o lookup indexado em /g/[token].
-- ============================================================

ALTER TABLE guardians
  ADD COLUMN IF NOT EXISTS access_token TEXT;

COMMENT ON COLUMN guardians.access_token IS
  'Token de acesso em texto puro, para o Guardião-Mor reexibir/compartilhar o link. O lookup usa access_token_hash.';
