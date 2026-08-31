// ============================================================
// Casa Quest — Guardian Dashboard (Token-based access)
// ============================================================

import { createServiceClient } from '@/infrastructure/supabase/server';
import { notFound } from 'next/navigation';
import { ensureCurrentDistribution } from '@/lib/distribution';
import { resolveGuardianToken } from '@/lib/guardian-token';
import { localDayRangeUtc } from '@/lib/day-range';
import { getGuardianEnergy } from '@/lib/guardian-energy';
import { formatDate } from '@/lib/utils';
import {
  GuardianActionCard,
  type GuardianAction,
} from '@/components/guardians/guardian-action-card';

interface GuardianPageProps {
  params: Promise<{ token: string }>;
}

export default async function GuardianPage({ params }: GuardianPageProps) {
  const { token } = await params;
  const supabase = await createServiceClient();

  const auth = await resolveGuardianToken(supabase, token);

  if (!auth.ok && auth.reason === 'not_found') {
    notFound();
  }

  if (!auth.ok) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <span className="text-4xl">⏰</span>
          <h1 className="mt-4 text-xl font-bold text-gray-900">Link expirado</h1>
          <p className="mt-2 text-sm text-gray-500">
            Peça ao seu Guardião-Mor para gerar um novo link de acesso.
          </p>
        </div>
      </div>
    );
  }

  const { guardian } = auth;

  // Ensure an up-to-date distribution exists (auto-regenerates if expired),
  // then show this guardian's assigned collaborative actions.
  const { assignments } = await ensureCurrentDistribution(supabase, guardian.family_id);
  const myAssignments = assignments.filter((a) => a.guardian_id === guardian.id);
  const periodUntil = assignments[0]?.valid_until ?? null;

  // "Hoje" segue o fuso da família, não o UTC: às 21h em São Paulo o UTC já
  // virou o dia e a lista esvaziaria justo no horário das tarefas da noite.
  const { data: familyRow } = await supabase
    .from('families')
    .select('timezone, recovery_enabled, auxilio_enabled, escalada_enabled')
    .eq('id', guardian.family_id)
    .single();

  const { startUtc, endUtc } = localDayRangeUtc(
    familyRow?.timezone || 'America/Sao_Paulo'
  );

  const { data: todaysActions } = await supabase
    .from('mission_actions')
    .select('id, status, due_at, confirmation_status, action_templates(name, category)')
    .eq('guardian_id', guardian.id)
    .gte('due_at', startUtc)
    .lt('due_at', endUtc)
    .order('due_at', { ascending: true });

  // Real energy for the guardian's current mission. Without an active mission
  // there is nothing to measure, so the block is simply not shown.
  const { data: mission } = await supabase
    .from('missions')
    .select('id, start_at')
    .eq('family_id', guardian.family_id)
    .order('start_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const extraActions = [
    familyRow?.recovery_enabled && {
      icon: '🔄',
      label: 'Compensar',
      subtitle: 'Recuperar',
      color: 'border-orange-300 bg-orange-50',
    },
    familyRow?.auxilio_enabled && {
      icon: '🤝',
      label: 'Ajudar',
      subtitle: 'Auxílio',
      color: 'border-emerald-300 bg-emerald-50',
    },
    familyRow?.escalada_enabled && {
      icon: '⬆️',
      label: 'Ir Além',
      subtitle: 'Escalada',
      color: 'border-purple-300 bg-purple-50',
    },
  ].filter(Boolean) as {
    icon: string;
    label: string;
    subtitle: string;
    color: string;
  }[];

  const energy = mission
    ? await getGuardianEnergy(
        supabase,
        guardian.id,
        mission.id,
        guardian.family_id,
        new Date(mission.start_at)
      )
    : null;

  // Flatten the joined template into the shape the card expects. PostgREST
  // returns the relation as an object or a single-element array depending on
  // how it infers the relationship, so handle both.
  const actions: GuardianAction[] = (todaysActions ?? []).map((a) => {
    const rel = a.action_templates as
      | { name: string; category: string }
      | { name: string; category: string }[]
      | null;
    const template = Array.isArray(rel) ? rel[0] : rel;
    return {
      id: a.id,
      status: String(a.status),
      due_at: a.due_at,
      name: template?.name ?? 'Ação',
      category: template?.category ?? 'habitos',
    };
  });

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      {/* Top bar */}
      <div className="bg-white px-4 py-6 shadow-sm">
        <div className="mx-auto max-w-md">
          <h1 className="text-lg font-bold text-gray-900">
            Olá, {guardian.name}! 👋
          </h1>
          <p className="text-sm text-gray-500">Suas responsabilidades de hoje</p>
        </div>
      </div>

      {/* Energy indicator */}
      {energy && (
        <div className="mx-auto mt-4 max-w-md px-4">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">Compromisso</span>
              <span className={`rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold ${energy.qualitative.color}`}>
                {energy.qualitative.emoji} {energy.qualitative.label}
              </span>
            </div>
            <div className="mt-2">
              <div className="h-2 rounded-full bg-gray-200">
                <div
                  className="h-2 rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, energy.percentage))}%` }}
                />
              </div>
              <p className="mt-1 text-right text-[11px] text-gray-400">
                {energy.percentage}%
              </p>
            </div>
            <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
              <span>
                🔥 Constância: {energy.streakDays}{' '}
                {energy.streakDays === 1 ? 'dia' : 'dias'}
              </span>
              <span>🤝 Cooperação: {energy.cooperationScore} pts</span>
            </div>
          </div>
        </div>
      )}

      {/* Monthly responsibilities (distribution) */}
      {myAssignments.length > 0 && (
        <div className="mx-auto mt-4 max-w-md px-4">
          <h2 className="text-sm font-semibold text-gray-700">Suas responsabilidades do mês</h2>
          {periodUntil && (
            <p className="text-xs text-gray-400">Válido até {formatDate(periodUntil)}</p>
          )}
          <div className="mt-2 space-y-2">
            {myAssignments.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
              >
                <span className="text-sm font-medium text-gray-900">{a.action_name}</span>
                <span className="text-xs text-gray-400">{a.frequency || ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's actions */}
      <div className="mx-auto mt-4 max-w-md space-y-3 px-4">
        <h2 className="text-sm font-semibold text-gray-700">
          Ações de Hoje ({actions.length})
        </h2>

        {actions.length > 0 ? (
          actions.map((action) => (
            <GuardianActionCard key={action.id} action={action} token={token} />
          ))
        ) : (
          <div className="rounded-xl bg-white p-8 text-center shadow-sm">
            <span className="text-4xl">🎉</span>
            <p className="mt-2 text-sm text-gray-500">
              Nenhuma ação pendente para hoje!
            </p>
          </div>
        )}
      </div>

      {/* Extra actions — only the ones the family actually enabled.
          Os fluxos ainda não existem, então aparecem marcados como "em breve"
          em vez de botões que não fazem nada. */}
      {extraActions.length > 0 && (
        <div className="mx-auto mt-6 max-w-md px-4">
          <h2 className="text-sm font-semibold text-gray-700">Ações Extras</h2>
          <div className="mt-2 grid grid-cols-3 gap-3">
            {extraActions.map((extra) => (
              <ExtraActionCard key={extra.label} {...extra} />
            ))}
          </div>
          <p className="mt-2 text-center text-[11px] text-gray-400">
            Em breve — ainda não dá para registrar essas ações por aqui.
          </p>
        </div>
      )}

      {/* Bottom spacer for mobile nav */}
      <div className="h-20" />
    </main>
  );
}

function ExtraActionCard({
  icon,
  label,
  subtitle,
  color,
}: {
  icon: string;
  label: string;
  subtitle: string;
  color: string;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-1 rounded-xl border-2 border-dashed ${color} p-3 text-center opacity-60`}
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-xs font-semibold text-gray-900">{label}</span>
      <span className="text-[10px] text-gray-500">{subtitle}</span>
    </div>
  );
}
