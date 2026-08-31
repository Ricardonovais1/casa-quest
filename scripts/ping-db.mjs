// Gera atividade real no banco Supabase para evitar pausa por inatividade.
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

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

const { count, error } = await supabase
  .from('families')
  .select('*', { count: 'exact', head: true });

if (error) {
  console.error('❌ Falha ao consultar o banco:', error.message);
  process.exit(1);
}

console.log(`✅ Banco respondeu. Registros em "families": ${count}`);
console.log(`   Timestamp: ${new Date().toISOString()}`);
