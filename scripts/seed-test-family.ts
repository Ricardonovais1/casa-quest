// ============================================================
// Casa Quest — Família de teste para abrir no navegador
//
// Cria um usuário confirmado, uma família com catálogo, dois guardiões,
// uma missão ativa e uma rodada de distribuição — e planta de propósito
// as repetições que os cartões novos precisam de mostrar:
//
//   • "Encher a lava-louça" (colaboração) = "Colocar louça" do catálogo
//   • "Esvaziar lava-louças" (hábito)     = "Tirar louça" do catálogo
//   • "Regar as plantas" entra DEPOIS do sorteio, e fica sem ninguém
//
// É o caso real do Ricardo, num lugar onde se pode mexer. Nunca se testa
// na família de verdade: abrir o painel dela roda o ciclo do dia.
//
// Uso:
//   npx tsx scripts/seed-test-family.ts            # cria e imprime o login
//   npx tsx scripts/seed-test-family.ts --delete   # apaga as que sobraram
// ============================================================

import { readFileSync } from 'fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { seedDefaultActions } from '../src/lib/default-actions';
import { ensureCurrentDistribution } from '../src/lib/distribution';
import { syncFamilyDay } from '../src/lib/daily-actions';
import { localDateString, addDays } from '../src/lib/day-range';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const TZ = 'America/Sao_Paulo';
const MARK = 'seed-teste';

async function removeAll() {
  const { data: families } = await admin.from('families').select('id, name').ilike('name', 'Casa de Teste%');
  for (const f of families ?? []) {
    await admin.from('families').delete().eq('id', f.id);
    console.log(`  apagada: ${f.name}`);
  }
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of data?.users ?? []) {
    if (u.email?.startsWith(MARK)) {
      await admin.auth.admin.deleteUser(u.id);
      console.log(`  apagado: ${u.email}`);
    }
  }
}

async function main() {
  if (process.argv.includes('--delete')) {
    console.log('Limpeza das famílias de teste');
    await removeAll();
    return;
  }

  const stamp = Date.now();
  const email = `${MARK}-${stamp}@casaquest.fun`;
  const password = `Teste-${stamp}!`;

  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Mor de Teste' },
  });
  if (userErr || !created.user) throw new Error(`usuário: ${userErr?.message}`);
  const userId = created.user.id;

  const { data: family, error: famErr } = await admin
    .from('families')
    .insert({
      name: `Casa de Teste ${stamp}`,
      created_by: userId,
      timezone: TZ,
      quorum_type: 'fixed',
      quorum_fixed: 1,
      tolerance_minutes: 30,
      recovery_enabled: true,
      auxilio_enabled: true,
      escalada_enabled: true,
      mission_duration_days: 30,
    })
    .select()
    .single();
  if (famErr || !family) throw new Error(`família: ${famErr?.message}`);
  const familyId = family.id as string;

  await admin.from('guardians').insert({
    family_id: familyId,
    name: 'Mor de Teste',
    is_mor: true,
    email,
    user_id: userId,
  });
  const { data: kids } = await admin
    .from('guardians')
    .insert([
      { family_id: familyId, name: 'Rosa de Teste', is_mor: false },
      { family_id: familyId, name: 'Aurora de Teste', is_mor: false },
    ])
    .select('id, name');

  await seedDefaultActions(admin as unknown as SupabaseClient, familyId);

  // As duas repetidas entram ANTES do sorteio, para ficarem com dono.
  await admin.from('action_templates').insert([
    { family_id: familyId, name: 'Encher a lava-louça', category: 'cooperacao', points: 1, frequency: 'diária' },
    { family_id: familyId, name: 'Esvaziar lava-louças', category: 'habitos', points: 1, frequency: 'diária' },
  ]);

  const { assignments } = await ensureCurrentDistribution(admin, familyId);

  // E esta entra DEPOIS: é a atividade sem ninguém que a revisão precisa.
  await admin
    .from('action_templates')
    .insert({ family_id: familyId, name: 'Regar as plantas', category: 'cooperacao', points: 2, frequency: '2×/semana' });

  const today = localDateString(TZ);
  const { data: mission, error: missionErr } = await admin
    .from('missions')
    .insert({
      family_id: familyId,
      name: 'Missão de Teste',
      start_at: today,
      end_at: addDays(today, 29),
      target_reward_amount: 50,
      status: 'draft',
    })
    .select()
    .single();
  if (missionErr || !mission) throw new Error(`missão: ${missionErr?.message}`);

  await admin.from('mission_guardians').insert(
    (kids ?? []).map((k) => ({
      mission_id: mission.id,
      guardian_id: k.id,
      initial_energy: 100,
      current_energy: 100,
      target_reward: 50,
    }))
  );
  await admin.from('missions').update({ status: 'active' }).eq('id', mission.id);

  const sync = await syncFamilyDay(admin, familyId);

  const { data: links } = await admin
    .from('guardians')
    .select('name, access_token')
    .eq('family_id', familyId)
    .eq('is_mor', false);

  console.log('\nFamília de teste pronta');
  console.log(`  família   ${family.name} (${familyId})`);
  console.log(`  e-mail    ${email}`);
  console.log(`  senha     ${password}`);
  console.log(`  rodada    ${assignments.length} atribuições · ${sync.generated} ações geradas hoje`);
  for (const g of links ?? []) console.log(`  link      ${g.name}: /g/${g.access_token}`);
  console.log('\n  Apagar depois:  npx tsx scripts/seed-test-family.ts --delete');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
