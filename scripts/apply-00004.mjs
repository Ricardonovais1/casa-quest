import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const REF = 'fzragvgjmwiqdnmnebgr';
const TOKEN = process.env.SUPABASE_TOKEN;

if (!TOKEN) {
  console.log('Token não definido. Use: SUPABASE_TOKEN=xxx node scripts/apply-00004.mjs');
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(
  join(__dirname, '..', 'supabase', 'migrations', '00004_action_assignments.sql'),
  'utf8'
);

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

console.log(`${res.ok ? '✅' : '❌'} Migração 00004: ${res.status}`);
if (!res.ok) {
  console.log(await res.text());
} else {
  console.log('✅ Tabela "action_assignments" e "rotation_interval_months" aplicadas.');
}
