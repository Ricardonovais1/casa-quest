// ============================================================
// Casa Quest — Guardian Dashboard (Token-based access)
// A tela do guardião: o que fazer hoje, como está o compromisso.
// Nunca mostra dinheiro.
// ============================================================

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createServiceClient } from '@/infrastructure/supabase/server';
import { ensureCurrentDistribution } from '@/lib/distribution';
import { resolveGuardianToken } from '@/lib/guardian-token';
import { localDayRangeUtc, localTimeString, friendlyDate } from '@/lib/day-range';
import { getGuardianEnergy } from '@/lib/guardian-energy';
import { syncFamilyDay, missDeadline } from '@/lib/daily-actions';
import { describeSchedule } from '@/lib/scheduling';
import { categoryMeta } from '@/lib/default-actions';
import { isAdult } from '@/lib/roles';
import { formatDate } from '@/lib/utils';
import {
  GuardianActionCard,
  type GuardianAction,
} from '@/components/guardians/guardian-action-card';
import { InstallPrompt } from '@/components/pwa/install-prompt';

export const dynamic = 'force-dynamic';

interface GuardianPageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: GuardianPageProps): Promise<Metadata> {
  const { token } = await params;
  return {
    title: 'Minhas ações de hoje',
    robots: { index: false, follow: false },
    // Installing from this page must reopen this page, not the landing.
    manifest: `/api/manifest?start=${encodeURIComponent(`/g/${token}`)}`,
  };
}

const EXTRA_CATEGORIES = ['tropecos', 'missoes', 'gentilezas', 'autoaperfeicoamento', 'rendimento_escolar'];

export default async function GuardianPage({ params }: GuardianPageProps) {
  const { token } = await params;
  const supabase = await createServiceClient();

  const auth = await resolveGuardianToken(supabase, token);

  if (!auth.ok && auth.reason === 'not_found') {
    notFound();
  }

  if (!auth.ok) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="max-w-sm text-center">
          <span className="text-5xl">⏰</span>
          <h1 className="mt-4 text-xl font-bold text-gray-900">Este link venceu</h1>
          <p className="mt-2 text-sm text-gray-500">
            Peça ao seu Guardião-Mor um link novo. Ele gera em segundos no painel da família.
          </p>
        </div>
      </main>
    );
  }

  const { guardian } = auth;
  const now = new Date();

  // Opening the page is what makes the day exist: generate today's actions
  // and record yesterday's misses if the cron has not run yet.
  await syncFamilyDay(supabase, guardian.family_id, now).catch(() => null);

  const [{ data: familyRow }, { data: members }, { assignments }] = await Promise.all([
    supabase
      .from('families')
      .select('name, timezone, tolerance_minutes, recovery_enabled, auxilio_enabled, escalada_enabled')
      .eq('id', guardian.family_id)
      .single(),
    supabase
      .from('guardians')
      .select('*')
      .eq('family_id', guardian.family_id)
      .eq('is_active', true)
      .order('is_mor', { ascending: false }),
    ensureCurrentDistribution(supabase, guardian.family_id),
  ]);

  const tz = familyRow?.timezone || 'America/Sao_Paulo';
  const tolerance = familyRow?.tolerance_minutes ?? 30;
  // The adults of the house — who the child should tell about extras.
  const adultNames = (members ?? []).filter(isAdult).map((a) => a.name.split(' ')[0]);
  const morName =
    adultNames.length === 0
      ? 'um adulto da casa'
      : adultNames.length === 1
        ? adultNames[0]!
        : `${adultNames.slice(0, -1).join(', ')} ou ${adultNames[adultNames.length - 1]}`;

  const myAssignments = assignments.filter((a) => a.guardian_id === guardian.id);
  const periodUntil = assignments[0]?.valid_until ?? null;

  const { date, startUtc, endUtc } = localDayRangeUtc(tz, now);

  const { data: mission } = await supabase
    .from('missions')
    .select('id, name, start_at, end_at')
    .eq('family_id', guardian.family_id)
    .eq('status', 'active')
    .order('start_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: todaysActions } = mission
    ? await supabase
        .from('mission_actions')
        .select('id, status, due_at, created_at, completed_at, action_templates(name, category, confirmation_mode)')
        .eq('guardian_id', guardian.id)
        .eq('mission_id', mission.id)
        .gte('due_at', startUtc)
        .lt('due_at', endUtc)
        .order('due_at', { ascending: true })
    : { data: [] };

  const energy = mission
    ? await getGuardianEnergy(
        supabase,
        guardian.id,
        mission.id,
        guardian.family_id,
        new Date(`${mission.start_at}T12:00:00Z`),
        now
      )
    : null;

  // Flatten the joined template into the shape the card expects. PostgREST
  // returns the relation as an object or a single-element array depending on
  // how it infers the relationship, so handle both.
  const actions = (todaysActions ?? []).map((a) => {
    const rel = a.action_templates as
      | { name: string; category: string; confirmation_mode: string | null }
      | { name: string; category: string; confirmation_mode: string | null }[]
      | null;
    const template = Array.isArray(rel) ? rel[0] : rel;
    const category = template?.category ?? 'habitos';
    const meta = categoryMeta(category);
    const deadline = missDeadline(a.due_at, a.created_at ?? a.due_at, tolerance);

    const action: GuardianAction = {
      id: a.id,
      status: String(a.status),
      name: template?.name ?? 'Ação',
      categoryLabel: meta?.label ?? category,
      categoryEmoji: meta?.emoji ?? '📋',
      dueLabel: localTimeString(tz, a.due_at),
      deadlineLabel: localTimeString(tz, new Date(deadline)),
      isLate: now.getTime() > Date.parse(a.due_at) && now.getTime() <= deadline,
      isOverdue: now.getTime() > deadline,
      completedLabel: a.completed_at ? localTimeString(tz, a.completed_at) : null,
      isExtra: EXTRA_CATEGORIES.includes(category),
    };
    return {
      action,
      needsConfirmation: (template?.confirmation_mode ?? 'none') !== 'none',
    };
  });

  // Pending first, then waiting, then the rest — what still needs doing on top.
  const order: Record<string, number> = { pending: 0, marked_done: 1, confirmed: 2, missed: 3, cancelled: 4 };
  actions.sort((x, y) => (order[x.action.status] ?? 9) - (order[y.action.status] ?? 9));

  const scheduled = actions.filter((a) => !a.action.isExtra && a.action.status !== 'cancelled');
  const doneCount = scheduled.filter((a) => a.action.status === 'confirmed').length;
  const pendingCount = scheduled.filter((a) => a.action.status === 'pending').length;
  const allDone = scheduled.length > 0 && pendingCount === 0 && scheduled.every((a) => a.action.status !== 'marked_done');

  const extras = [
    familyRow?.recovery_enabled && {
      icon: '🏆',
      label: 'Missão extra',
      text: 'Fez uma tarefa grande além do combinado? Recupera energia perdida.',
    },
    familyRow?.escalada_enabled && {
      icon: '⬆️',
      label: 'Escalada',
      text: 'Gentileza, estudo, algo a mais? Sobe a energia acima de 100.',
    },
    familyRow?.auxilio_enabled && {
      icon: '🤝',
      label: 'Ajudar alguém',
      text: 'Fez a tarefa de outro guardião? Conta como cooperação.',
    },
  ].filter(Boolean) as { icon: string; label: string; text: string }[];

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <header className="bg-gradient-to-br from-indigo-600 to-purple-600 px-4 pb-8 pt-6 text-white">
        <div className="mx-auto max-w-md">
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-100">
            {familyRow?.name ?? 'Casa Quest'}
          </p>
          <h1 className="mt-1 text-2xl font-bold">Oi, {guardian.name.split(' ')[0]}! 👋</h1>
          <p className="mt-1 text-sm text-indigo-100">{friendlyDate(date)}</p>

          {mission && scheduled.length > 0 && (
            <div className="mt-4 rounded-xl bg-white/15 p-3 backdrop-blur">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">
                  {allDone ? '🎉 Tudo feito por hoje!' : `${doneCount} de ${scheduled.length} feitas`}
                </span>
                <span className="text-xs text-indigo-100">
                  {pendingCount > 0 ? `${pendingCount} pra fazer` : ''}
                </span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-white/20">
                <div
                  className="h-2 rounded-full bg-white transition-all"
                  style={{ width: `${Math.round((doneCount / scheduled.length) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto -mt-4 max-w-md space-y-5 px-4">
        {/* Energy */}
        {energy && (
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">⚡ Sua energia</span>
              <span className={`rounded-full bg-gray-100 px-3 py-1 text-xs font-bold ${energy.qualitative.color}`}>
                {energy.qualitative.emoji} {energy.qualitative.label}
              </span>
            </div>
            <div className="mt-3 h-2.5 rounded-full bg-gray-100">
              <div
                className={`h-2.5 rounded-full transition-all ${
                  energy.percentage >= 90 ? 'bg-emerald-500' : energy.percentage >= 70 ? 'bg-yellow-400' : energy.percentage >= 50 ? 'bg-orange-400' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, energy.percentage))}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
              <span>🔥 {energy.streakDays} {energy.streakDays === 1 ? 'dia' : 'dias'} sem falta</span>
              <span>🤝 cooperação {energy.cooperationScore}</span>
              <span className="font-semibold text-gray-700">{energy.percentage}%</span>
            </div>
          </section>
        )}

        {/* Today's actions */}
        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold text-gray-700">
            {mission ? `Hoje (${scheduled.length})` : 'Hoje'}
          </h2>

          {!mission ? (
            <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
              <span className="text-4xl">🛋️</span>
              <p className="mt-2 text-sm font-medium text-gray-700">Nenhuma missão rolando agora</p>
              <p className="mt-1 text-xs text-gray-500">
                Quando {morName} iniciar uma missão, suas ações do dia aparecem aqui.
              </p>
            </div>
          ) : actions.length === 0 ? (
            <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
              <span className="text-4xl">🌤️</span>
              <p className="mt-2 text-sm font-medium text-gray-700">Nada programado para hoje</p>
              <p className="mt-1 text-xs text-gray-500">Aproveita o dia!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {actions.map(({ action, needsConfirmation }) => (
                <GuardianActionCard
                  key={action.id}
                  action={action}
                  token={token}
                  needsConfirmation={needsConfirmation}
                />
              ))}
            </div>
          )}
        </section>

        {/* Period responsibilities (distribution) */}
        {myAssignments.length > 0 && (
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700">🤝 Suas tarefas da casa neste período</h2>
            {periodUntil && (
              <p className="text-xs text-gray-400">Até {formatDate(periodUntil)}. Depois, a rodada muda.</p>
            )}
            <ul className="mt-3 divide-y divide-gray-100">
              {myAssignments.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-gray-800">{a.action_name}</span>
                  <span className="text-xs text-gray-400">{describeSchedule(a.frequency)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Extras */}
        {mission && extras.length > 0 && (
          <section className="rounded-2xl border border-dashed border-gray-300 bg-white/60 p-4">
            <h2 className="text-sm font-semibold text-gray-700">Fez algo a mais?</h2>
            <p className="mt-1 text-xs text-gray-500">
              Conta pra {morName}: essas coisas são registradas no painel e mudam a sua energia.
            </p>
            <ul className="mt-3 space-y-2">
              {extras.map((e) => (
                <li key={e.label} className="flex gap-2 text-xs text-gray-600">
                  <span className="text-base leading-none">{e.icon}</span>
                  <span>
                    <strong className="text-gray-800">{e.label}.</strong> {e.text}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <InstallPrompt compact />

        <p className="px-2 pt-2 text-center text-[11px] text-gray-400">
          Casa Quest · este link é só seu, não compartilhe.
        </p>
      </div>
    </main>
  );
}
