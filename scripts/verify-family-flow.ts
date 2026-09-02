// ============================================================
// Casa Quest — Verificação ponta a ponta do fluxo de uma família
//
// Cria um usuário e uma família de teste, percorre o ciclo inteiro
// (onboarding → missão → ações do dia → "Fiz!" → confirmação → faltas
// → energia → encerramento) e apaga tudo no fim.
//
// Roda em dois modos:
//   • "client": usa a chave anon com a sessão do usuário de teste — é o
//     que o painel do Guardião-Mor faz no navegador. Com RLS ligado
//     (migração 00007) isso valida as políticas.
//   • "service": usa a service role — é o que as rotas de API e a página
//     do guardião fazem no servidor.
//
// Uso:  npx tsx scripts/verify-family-flow.ts
// ============================================================

import { readFileSync } from 'fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { syncFamilyDay, sweepOverdueActions, settleMission } from '../src/lib/daily-actions';
import { markActionDone } from '../src/lib/mark-action-done';
import { getGuardianEnergy } from '../src/lib/guardian-energy';
import { seedDefaultActions } from '../src/lib/default-actions';
import { ensureCurrentDistribution } from '../src/lib/distribution';
import { localDayRangeUtc, localDateString, addDays } from '../src/lib/day-range';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const client = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

const TZ = 'America/Sao_Paulo';
const stamp = Date.now();
const email = `verify-${stamp}@casaquest.fun`;
const password = `Verify-${stamp}!`;

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? '  ✅' : '  ❌'} ${label}${detail !== undefined && !ok ? ` → ${JSON.stringify(detail)}` : ''}`);
  if (!ok) failures++;
}
function section(title: string) {
  console.log(`\n${title}`);
}

let userId: string | null = null;
let familyId: string | null = null;

async function cleanup() {
  section('Limpeza');
  if (familyId) {
    const { error } = await admin.from('families').delete().eq('id', familyId);
    check('família de teste apagada (cascade)', !error, error?.message);
  }
  if (userId) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    check('usuário de teste apagado', !error, error?.message);
  }
}

async function main() {
  section(`Usuário de teste: ${email}`);
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Teste Mor' },
  });
  check('usuário criado', !createErr && !!created.user, createErr?.message);
  userId = created.user?.id ?? null;
  if (!userId) throw new Error('sem usuário');

  const { data: signed, error: signErr } = await client.auth.signInWithPassword({ email, password });
  check('login com senha', !signErr && !!signed.session, signErr?.message);

  // ── Onboarding (exatamente o que src/app/onboarding faz, com o client) ──
  section('Onboarding (client, como o navegador)');
  const { data: family, error: famErr } = await client
    .from('families')
    .insert({
      name: `Família Verify ${stamp}`,
      created_by: userId,
      timezone: TZ,
      quorum_type: 'fixed',
      quorum_fixed: 1,
      tolerance_minutes: 30,
      recovery_enabled: true,
      auxilio_enabled: true,
      escalada_enabled: true,
      mission_duration_days: 7,
    })
    .select()
    .single();
  check('família criada e retornada (SELECT após INSERT)', !famErr && !!family, famErr?.message);
  familyId = family?.id ?? null;
  if (!familyId) throw new Error('sem família');

  const { error: morErr } = await client.from('guardians').insert({
    family_id: familyId,
    name: 'Teste Mor',
    is_mor: true,
    email,
    user_id: userId,
  });
  check('guardião-mor criado', !morErr, morErr?.message);

  const { data: kids, error: kidsErr } = await client
    .from('guardians')
    .insert([
      { family_id: familyId, name: 'Ana', is_mor: false },
      { family_id: familyId, name: 'Bia', is_mor: false },
    ])
    .select('id, name');
  check('guardiões criados', !kidsErr && kids?.length === 2, kidsErr?.message);

  await seedDefaultActions(client as unknown as SupabaseClient, familyId);
  const { count: templateCount } = await client
    .from('action_templates')
    .select('*', { count: 'exact', head: true })
    .eq('family_id', familyId);
  check('catálogo de ações semeado', (templateCount ?? 0) > 20, templateCount);

  // Leitura como o hook useFamily
  const { data: mor } = await client
    .from('guardians')
    .select('*')
    .eq('user_id', userId)
    .eq('is_mor', true)
    .maybeSingle();
  check('useFamily: encontra o Mor', !!mor);
  const { data: famRead } = await client.from('families').select('*').eq('id', familyId).single();
  check('useFamily: lê a família', !!famRead);
  const { data: allG } = await client.from('guardians').select('*').eq('family_id', familyId);
  check('useFamily: lê todos os guardiões', allG?.length === 3, allG?.length);

  // Distribuição (service role, como a rota /api/families/distribution)
  const { assignments } = await ensureCurrentDistribution(admin, familyId);
  check('distribuição gerada', assignments.length > 0, assignments.length);
  const { data: clientAssignments, error: caErr } = await client
    .from('action_assignments')
    .select('id')
    .eq('family_id', familyId);
  check(
    'client lê action_assignments (precisa da política da migração 00007)',
    !caErr && (clientAssignments?.length ?? 0) === assignments.length,
    caErr?.message ?? clientAssignments?.length
  );
  const perKid = new Map<string, number>();
  for (const a of assignments) perKid.set(a.guardian_id, (perKid.get(a.guardian_id) ?? 0) + a.points);
  check('distribuição cobre os dois guardiões', perKid.size === 2, Array.from(perKid.entries()));

  // Ajusta a "Arrumar a cama" para vencer cedo (06:00), para testar a falta.
  await client
    .from('action_templates')
    .update({ default_due_time: '06:00', confirmation_mode: 'one_peer' })
    .eq('family_id', familyId)
    .eq('name', 'Arrumar a cama');

  // ── Missão (client cria o rascunho, como o formulário) ──
  section('Missão');
  const today = localDateString(TZ);
  const { data: mission, error: missionErr } = await client
    .from('missions')
    .insert({
      family_id: familyId,
      name: 'Missão Verify',
      start_at: today,
      end_at: addDays(today, 6),
      target_reward_amount: 50,
      status: 'draft',
    })
    .select()
    .single();
  check('missão criada (rascunho)', !missionErr && !!mission, missionErr?.message);

  // Ativação como a rota PATCH /api/missions/[id] (service role)
  const { error: mgErr } = await admin.from('mission_guardians').insert(
    kids!.map((k) => ({ mission_id: mission!.id, guardian_id: k.id, initial_energy: 100, current_energy: 100, target_reward: 50 }))
  );
  check('mission_guardians criados', !mgErr, mgErr?.message);
  await admin.from('missions').update({ status: 'active' }).eq('id', mission!.id);

  const sync1 = await syncFamilyDay(admin, familyId);
  check('sync: missão ativa', sync1.missionStatus === 'active', sync1);
  check('sync: gerou ações de hoje', sync1.generated > 0, sync1);

  const sync2 = await syncFamilyDay(admin, familyId);
  check('sync: segunda rodada não duplica', sync2.generated === 0, sync2);

  const { startUtc, endUtc } = localDayRangeUtc(TZ);
  const { data: todays } = await admin
    .from('mission_actions')
    .select('id, guardian_id, status, due_at, action_templates(name, category)')
    .eq('mission_id', mission!.id)
    .gte('due_at', startUtc)
    .lt('due_at', endUtc);
  const list = todays ?? [];
  const byKid = (id: string) => list.filter((a) => a.guardian_id === id);
  check('cada guardião tem ações de hoje', kids!.every((k) => byKid(k.id).length > 0), kids!.map((k) => byKid(k.id).length));

  const coopActions = list.filter((a) => {
    const t = (Array.isArray(a.action_templates) ? a.action_templates[0] : a.action_templates) as { category: string } | null;
    return t?.category === 'cooperacao';
  });
  const coopDuplicated = coopActions.some((a) => coopActions.filter((b) => b.due_at === a.due_at && b.guardian_id !== a.guardian_id && JSON.stringify(b.action_templates) === JSON.stringify(a.action_templates)).length > 0);
  check('colaboração só para quem está na distribuição', !coopDuplicated);

  const noTropeco = list.every((a) => {
    const t = (Array.isArray(a.action_templates) ? a.action_templates[0] : a.action_templates) as { category: string } | null;
    return t?.category !== 'tropecos' && t?.category !== 'missoes';
  });
  check('tropeços e missões extras não são gerados automaticamente', noTropeco);

  // Leitura como o painel "Hoje" (client)
  const { data: clientView, error: clientViewErr } = await client
    .from('mission_actions')
    .select('id, status, action_templates(name, category, points)')
    .eq('mission_id', mission!.id)
    .gte('due_at', startUtc)
    .lt('due_at', endUtc);
  check('painel Hoje lê as ações (client)', !clientViewErr && (clientView?.length ?? 0) === list.length, clientViewErr?.message);

  // ── Guardião marca "Fiz!" (service, como a rota por token) ──
  section('Fiz! e confirmação');
  const ana = kids![0]!;
  const anaBed = byKid(ana.id).find((a) => {
    const t = (Array.isArray(a.action_templates) ? a.action_templates[0] : a.action_templates) as { name: string } | null;
    return t?.name === 'Arrumar a cama';
  });
  check('Ana tem "Arrumar a cama" hoje', !!anaBed);
  if (anaBed) {
    const r1 = await markActionDone(admin, anaBed.id, ana.id);
    check('markActionDone → aguardando confirmação', r1.ok && r1.status === 'marked_done', r1);
    const r2 = await markActionDone(admin, anaBed.id, ana.id);
    check('marcar duas vezes é recusado', !r2.ok && r2.code === 'ALREADY_PROCESSED', r2);
    const wrong = await markActionDone(admin, anaBed.id, kids![1]!.id);
    check('outro guardião não marca a ação alheia', !wrong.ok && wrong.code === 'FORBIDDEN', wrong);

    // Mor confirma (client, como o painel — via RLS quando ligado)
    const { error: confErr } = await client
      .from('mission_actions')
      .update({ status: 'confirmed', completed_at: new Date().toISOString(), confirmation_status: 'confirmed' })
      .eq('id', anaBed.id);
    check('Mor confirma (client UPDATE)', !confErr, confErr?.message);
    const { error: auditErr } = await client
      .from('action_confirmations')
      .upsert({ mission_action_id: anaBed.id, guardian_id: mor!.id, decision: 'confirmed' }, { onConflict: 'mission_action_id,guardian_id' });
    check('registro de confirmação (client INSERT)', !auditErr, auditErr?.message);
  }

  // ── Faltas: varredura com relógio no futuro ──
  section('Faltas e energia');
  const bia = kids![1]!;
  const future = new Date(Date.now() + 2 * 86_400_000);
  const missed = await sweepOverdueActions(admin, mission!.id, 30, future);
  check('varredura marcou pendentes vencidas como falta', missed > 0, missed);

  const { data: biaMissed } = await admin
    .from('mission_actions')
    .select('id')
    .eq('mission_id', mission!.id)
    .eq('guardian_id', bia.id)
    .eq('status', 'missed');
  check('Bia tem faltas', (biaMissed?.length ?? 0) > 0);

  const energyBia = await getGuardianEnergy(admin, bia.id, mission!.id, familyId, new Date(`${today}T12:00:00Z`));
  check('energia da Bia caiu abaixo de 100', energyBia.finalEnergy < 100, energyBia.finalEnergy);
  check('energia da Bia conta as faltas', energyBia.counts.missed === (biaMissed?.length ?? 0), energyBia.counts);

  const energyAna = await getGuardianEnergy(admin, ana.id, mission!.id, familyId, new Date(`${today}T12:00:00Z`));
  check('Ana (1 feita, resto falta) tem energia menor que 100 e maior que a Bia', energyAna.finalEnergy < 100 && energyAna.finalEnergy >= energyBia.finalEnergy, { ana: energyAna.finalEnergy, bia: energyBia.finalEnergy });

  // Missão extra compensa uma falta
  const { data: recoveryTemplate } = await admin
    .from('action_templates')
    .select('id')
    .eq('family_id', familyId)
    .eq('category', 'missoes')
    .limit(1)
    .single();
  const { error: recErr } = await admin.from('mission_actions').insert({
    mission_id: mission!.id,
    guardian_id: bia.id,
    action_template_id: recoveryTemplate!.id,
    due_at: new Date().toISOString(),
    status: 'confirmed',
    completed_at: new Date().toISOString(),
    confirmation_status: 'not_required',
    recovers_action_id: biaMissed![0]!.id,
  });
  check('missão extra registrada', !recErr, recErr?.message);
  const energyBia2 = await getGuardianEnergy(admin, bia.id, mission!.id, familyId, new Date(`${today}T12:00:00Z`));
  check('missão extra devolveu energia', energyBia2.finalEnergy > energyBia.finalEnergy, { antes: energyBia.finalEnergy, depois: energyBia2.finalEnergy });

  // Resumo de energia (client lê mission_guardians)
  const { data: mgRead, error: mgReadErr } = await client.from('mission_guardians').select('guardian_id').eq('mission_id', mission!.id);
  check('client lê mission_guardians', !mgReadErr && mgRead?.length === 2, mgReadErr?.message);

  // ── Encerramento ──
  section('Encerramento');
  await settleMission(admin, familyId, { id: mission!.id, start_at: today, end_at: addDays(today, 6), target_reward_amount: 50, status: 'active' });
  const { data: done } = await admin.from('missions').select('status').eq('id', mission!.id).single();
  check('missão concluída', done?.status === 'completed', done);
  const { data: finals } = await admin.from('mission_guardians').select('final_energy, final_reward').eq('mission_id', mission!.id);
  check('energia e mesada finais gravadas', (finals ?? []).every((f) => f.final_energy != null && f.final_reward != null), finals);

  // ── Isolamento entre famílias (só faz sentido com RLS ligado) ──
  section('Isolamento (RLS)');
  const { data: otherFamilies } = await client.from('families').select('id');
  const onlyMine = (otherFamilies ?? []).every((f) => f.id === familyId);
  const rlsOn = onlyMine;
  check(rlsOn ? 'RLS ligado: só vejo a minha família' : 'RLS DESLIGADO: vejo famílias de outras pessoas (aplique a migração 00007)', rlsOn, otherFamilies?.length);
  const anonClient = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: anonRows } = await anonClient.from('guardians').select('id').limit(1);
  check(rlsOn ? 'anônimo não lê nada' : 'anônimo consegue ler guardiões (aplique a migração 00007)', (anonRows?.length ?? 0) === 0);
}

main()
  .catch((e) => {
    console.error('\n💥 Erro inesperado:', e instanceof Error ? e.message : e);
    failures++;
  })
  .finally(async () => {
    await cleanup();
    console.log(failures === 0 ? '\n🎉 Tudo certo.' : `\n⚠️  ${failures} verificação(ões) falharam.`);
    process.exit(failures === 0 ? 0 : 1);
  });
