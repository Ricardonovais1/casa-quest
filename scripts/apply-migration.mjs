// ============================================================
// Casa Quest — Aplica uma migração SQL no projeto Supabase
//
// Usa a Management API, que precisa de um "personal access token"
// (https://supabase.com/dashboard/account/tokens).
//
// Uso:
//   SUPABASE_TOKEN=sbp_xxx node scripts/apply-migration.mjs 00006
//   SUPABASE_TOKEN=sbp_xxx node scripts/apply-migration.mjs 00006 00007
//
// Alternativa sem token: abra o SQL Editor do Supabase e cole o
// conteúdo do arquivo em supabase/migrations/.
// ============================================================

import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const REF = process.env.SUPABASE_PROJECT_REF || 'fzragvgjmwiqdnmnebgr';
const TOKEN = process.env.SUPABASE_TOKEN;

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = join(__dirname, '..', 'supabase', 'migrations');

const wanted = process.argv.slice(2);
if (wanted.length === 0) {
  console.log('Informe o(s) número(s) da migração. Ex: node scripts/apply-migration.mjs 00006');
  console.log('Disponíveis:');
  for (const f of readdirSync(dir).sort()) console.log('  ' + f);
  process.exit(1);
}

if (!TOKEN) {
  console.log('Token não definido. Use: SUPABASE_TOKEN=sbp_xxx node scripts/apply-migration.mjs ' + wanted.join(' '));
  process.exit(1);
}

for (const prefix of wanted) {
  const file = readdirSync(dir).find((f) => f.startsWith(prefix));
  if (!file) {
    console.log(`❌ Nenhuma migração começa com "${prefix}"`);
    process.exit(1);
  }

  const sql = readFileSync(join(dir, file), 'utf8');
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  console.log(`${res.ok ? '✅' : '❌'} ${file}: ${res.status}`);
  if (!res.ok) {
    console.log(await res.text());
    process.exit(1);
  }
}

console.log('\nPronto. Rode `node scripts/verify-family-flow.mjs` para validar o fluxo completo.');
