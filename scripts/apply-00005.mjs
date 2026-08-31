import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const REF = 'fzragvgjmwiqdnmnebgr';
const TOKEN = process.env.SUPABASE_TOKEN;

if (!TOKEN) {
  console.log('Token não definido. Use: SUPABASE_TOKEN=xxx node scripts/apply-00005.mjs');
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(
  join(__dirname, '..', 'supabase', 'migrations', '00005_guardian_access_token.sql'),
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

console.log(`${res.ok ? '✅' : '❌'} Migração 00005: ${res.status}`);
if (!res.ok) {
  console.log(await res.text());
  process.exit(1);
}

console.log('✅ Coluna "access_token" adicionada em guardians.');
console.log('   Os links antigos (só com hash) não são recuperáveis:');
console.log('   gere um novo link para cada guardião no painel.');
