// ============================================================
// Casa Quest — Remove as ações de teste criadas durante a
// verificação do botão "Fiz! ✓".
//
// Uso:  node scripts/remove-test-actions.mjs
// ============================================================

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const TEST_ACTION_IDS = [
  '156dec77-7350-4042-8303-7bf5667ca9dd', // Lira — Esvaziar lava-louças
  '246133b9-31f4-4a9b-9fe5-5457f25bf3be', // Lira — Arrumar a cama
  'd17ded5f-3e4f-4377-9d56-f02e9f3f512e', // Rosa — Alimentar o gato
];

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await supabase
  .from('mission_actions')
  .delete()
  .in('id', TEST_ACTION_IDS)
  .select('id');

if (error) {
  console.error('❌', error.message);
  process.exit(1);
}

console.log(`✅ ${data.length} ação(ões) de teste removida(s).`);
