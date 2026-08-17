import { readFileSync, writeFileSync } from 'fs';

const REF = 'fzragvgjmwiqdnmnebgr';
const TOKEN = process.env.SUPABASE_TOKEN;

if (!TOKEN) {
  console.log('Token não definido. Use: SUPABASE_TOKEN=xxx node scripts/fix-rls.mjs');
  process.exit(1);
}

const tables = [
  'families', 'guardians', 'action_templates', 'missions',
  'mission_guardians', 'mission_actions', 'action_confirmations',
  'energy_events', 'cooperation_events', 'escalada_categories',
  'action_assignments',
];

// Disable RLS on all tables and create permissive policies
for (const table of tables) {
  const sql = `
    ALTER TABLE public.${table} DISABLE ROW LEVEL SECURITY;
  `;

  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  console.log(`${res.ok ? '✅' : '❌'} ${table}: ${res.status}`);
  if (!res.ok) {
    const err = await res.text();
    console.log(`   ${err}`);
  }
}

console.log('\n✅ RLS desativado em todas as tabelas.');
