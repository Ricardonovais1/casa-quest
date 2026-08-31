// ============================================================
// Casa Quest — Regenera os links de acesso dos guardiões
//
// Usado uma vez após a migração 00005: os tokens antigos só tinham
// hash salvo, então eram irrecuperáveis. Este script gera tokens novos
// e guarda o texto puro, deixando os links visíveis no painel do Mor.
//
// Uso:  node scripts/regenerate-guardian-links.mjs [baseUrl]
// ============================================================

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'crypto';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const baseUrl = (process.argv[2] || env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
  .replace(/\/+$/, '');

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: guardians, error } = await supabase
  .from('guardians')
  .select('id, name, access_token')
  .eq('is_mor', false)
  .eq('is_active', true)
  .order('name');

if (error) {
  console.error('❌ Erro ao ler guardiões:', error.message);
  if (/access_token/.test(error.message)) {
    console.error('   → A migração 00005 ainda não foi aplicada.');
  }
  process.exit(1);
}

const TTL_DAYS = 90;
console.log(`Base: ${baseUrl}\n`);

for (const g of guardians) {
  if (g.access_token) {
    console.log(`⏭️  ${g.name}: já tem link recuperável, pulando.`);
    continue;
  }

  const token = randomUUID();
  const hash = createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TTL_DAYS);

  const { error: upErr } = await supabase
    .from('guardians')
    .update({
      access_token: token,
      access_token_hash: hash,
      token_expires_at: expiresAt.toISOString(),
    })
    .eq('id', g.id);

  if (upErr) {
    console.error(`❌ ${g.name}: ${upErr.message}`);
    continue;
  }

  console.log(`✅ ${g.name}`);
  console.log(`   ${baseUrl}/g/${token}`);
  console.log(`   expira em ${expiresAt.toLocaleDateString('pt-BR')}\n`);
}
