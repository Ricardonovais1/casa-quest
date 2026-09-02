'use client';

// ============================================================
// Casa Quest — Dashboard: Hoje (o painel diário do Guardião-Mor)
//
// Sincroniza o dia (gera ações, marca faltas), lista o que cada
// guardião tem para hoje, confirma o que foi marcado como feito e
// registra eventos extras (tropeços, missões extras, escaladas).
// ============================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useFamily } from '@/hooks/use-family';
import { getSupabaseBrowserClient } from '@/infrastructure/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  PageHeader,
  EmptyState,
  Notice,
  StatusPill,
  PageSkeleton,
  inputClass,
} from '@/components/ui/page';
import { localDayRangeUtc, localTimeString, friendlyDate } from '@/lib/day-range';
import { categoryMeta } from '@/lib/default-actions';
import { cn } from '@/lib/utils';

interface Mission {
  id: string;
  name: string;
  start_at: string;
  end_at: string;
  status: string;
}

interface TodayAction {
  id: string;
  guardian_id: string;
  status: string;
  due_at: string;
  completed_at: string | null;
  recovers_action_id: string | null;
  escalada_points_earned: number | null;
  name: string;
  category: string;
  points: number;
}

interface ExtraTemplate {
  id: string;
  name: string;
  category: string;
  points: number;
}

type ExtraKind = 'tropeco' | 'recovery' | 'escalada';

const EXTRA_KINDS: { value: ExtraKind; label: string; emoji: string; help: string; categories: string[] }[] = [
  {
    value: 'tropeco',
    label: 'Tropeço',
    emoji: '⚠️',
    help: 'Algo que deixou de fazer. Vira uma falta na energia.',
    categories: ['tropecos'],
  },
  {
    value: 'recovery',
    label: 'Missão extra',
    emoji: '🏆',
    help: 'Compensa uma falta. Devolve energia.',
    categories: ['missoes'],
  },
  {
    value: 'escalada',
    label: 'Escalada',
    emoji: '⬆️',
    help: 'Foi além do combinado. Energia extra.',
    categories: ['gentilezas', 'autoaperfeicoamento', 'rendimento_escolar'],
  },
];

function flattenTemplate(rel: unknown): { name: string; category: string; points: number } {
  const t = (Array.isArray(rel) ? rel[0] : rel) as
    | { name: string; category: string; points: number | null }
    | null
    | undefined;
  return { name: t?.name ?? 'Ação', category: t?.category ?? 'habitos', points: t?.points ?? 0 };
}

export default function TodayPage() {
  const { family, guardians, kids: allKids, loading: familyLoading, error: familyError } = useFamily();
  const supabase = getSupabaseBrowserClient();

  const [mission, setMission] = useState<Mission | null>(null);
  const [actions, setActions] = useState<TodayAction[]>([]);
  const [awaiting, setAwaiting] = useState<TodayAction[]>([]);
  const [templates, setTemplates] = useState<ExtraTemplate[]>([]);
  /** action id → first name of the adult who decided */
  const [decidedBy, setDecidedBy] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  // Extra event form
  const [extraGuardian, setExtraGuardian] = useState('');
  const [extraKind, setExtraKind] = useState<ExtraKind>('tropeco');
  const [extraTemplate, setExtraTemplate] = useState('');
  const [extraBusy, setExtraBusy] = useState(false);

  const tz = family?.timezone || 'America/Sao_Paulo';
  const kids = useMemo(() => allKids.filter((g) => g.is_active), [allKids]);

  const load = useCallback(async () => {
    if (!family) return;

    const { data: m } = await supabase
      .from('missions')
      .select('id, name, start_at, end_at, status')
      .eq('family_id', family.id)
      .eq('status', 'active')
      .order('start_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    setMission(m ?? null);

    if (m) {
      const { startUtc, endUtc } = localDayRangeUtc(tz);
      const [{ data: rows }, { data: waiting }] = await Promise.all([
        supabase
          .from('mission_actions')
          .select(
            'id, guardian_id, status, due_at, completed_at, recovers_action_id, escalada_points_earned, action_templates(name, category, points)'
          )
          .eq('mission_id', m.id)
          .gte('due_at', startUtc)
          .lt('due_at', endUtc)
          .order('due_at', { ascending: true }),
        supabase
          .from('mission_actions')
          .select(
            'id, guardian_id, status, due_at, completed_at, recovers_action_id, escalada_points_earned, action_templates(name, category, points)'
          )
          .eq('mission_id', m.id)
          .eq('status', 'marked_done')
          .order('due_at', { ascending: true }),
      ]);

      const map = (r: NonNullable<typeof rows>[number]): TodayAction => ({
        id: r.id,
        guardian_id: r.guardian_id,
        status: String(r.status),
        due_at: r.due_at,
        completed_at: r.completed_at,
        recovers_action_id: r.recovers_action_id,
        escalada_points_earned: r.escalada_points_earned,
        ...flattenTemplate(r.action_templates),
      });

      // Stable order: by due time, then name — so a row never jumps after a decision.
      const byDueThenName = (a: TodayAction, b: TodayAction) =>
        a.due_at.localeCompare(b.due_at) || a.name.localeCompare(b.name, 'pt-BR');
      setActions((rows ?? []).map(map).sort(byDueThenName));
      setAwaiting((waiting ?? []).map(map).sort(byDueThenName));

      // Who confirmed / rejected each action ("por Marina").
      const ids = (rows ?? []).map((r) => r.id);
      if (ids.length > 0) {
        const { data: confs } = await supabase
          .from('action_confirmations')
          .select('mission_action_id, guardian_id')
          .in('mission_action_id', ids);
        const byId: Record<string, string> = {};
        for (const c of confs ?? []) {
          const who = guardians.find((g) => g.id === c.guardian_id);
          if (who) byId[c.mission_action_id] = who.name.split(' ')[0]!;
        }
        setDecidedBy(byId);
      } else {
        setDecidedBy({});
      }
    } else {
      setActions([]);
      setAwaiting([]);
    }

    const { data: extras } = await supabase
      .from('action_templates')
      .select('id, name, category, points')
      .eq('family_id', family.id)
      .eq('is_active', true)
      .in('category', ['tropecos', 'missoes', 'gentilezas', 'autoaperfeicoamento', 'rendimento_escolar'])
      .order('name');
    setTemplates((extras ?? []) as ExtraTemplate[]);

    setLoading(false);
  }, [family, supabase, tz, guardians]);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/families/sync', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setNotice({ kind: 'error', text: body?.error?.message || 'Não foi possível atualizar o dia.' });
      }
    } catch {
      setNotice({ kind: 'error', text: 'Sem conexão com o servidor.' });
    }
    await load();
    setSyncing(false);
  }, [load]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data load on mount; state is only set after the awaits resolve
    if (family) sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family?.id]);

  // Default the extra-event form to the first guardian without an effect.
  const selectedExtraGuardian = extraGuardian || kids[0]?.id || '';

  async function decide(id: string, decision: 'confirm' | 'reject' | 'done' | 'missed' | 'reopen') {
    setBusyId(id);
    setNotice(null);
    try {
      const res = await fetch(`/api/mission-actions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setNotice({ kind: 'error', text: body?.error?.message || 'Não foi possível registrar.' });
      }
    } catch {
      setNotice({ kind: 'error', text: 'Sem conexão com o servidor.' });
    }
    await load();
    setBusyId(null);
  }

  async function registerExtra() {
    if (!selectedExtraGuardian || !extraTemplate) return;
    setExtraBusy(true);
    setNotice(null);
    try {
      const res = await fetch('/api/mission-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guardianId: selectedExtraGuardian, templateId: extraTemplate, kind: extraKind }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setNotice({ kind: 'error', text: body?.error?.message || 'Não foi possível registrar.' });
      } else {
        const who = kids.find((k) => k.id === selectedExtraGuardian)?.name ?? 'guardião';
        setNotice({ kind: 'success', text: `Registrado: ${body?.data?.name} para ${who}.` });
        setExtraTemplate('');
      }
    } catch {
      setNotice({ kind: 'error', text: 'Sem conexão com o servidor.' });
    }
    await load();
    setExtraBusy(false);
  }

  const { date: today } = localDayRangeUtc(tz);

  const summary = useMemo(() => {
    const s = { done: 0, awaiting: 0, missed: 0, pending: 0 };
    for (const a of actions) {
      if (a.status === 'confirmed') s.done++;
      else if (a.status === 'marked_done') s.awaiting++;
      else if (a.status === 'missed') s.missed++;
      else if (a.status === 'pending') s.pending++;
    }
    return s;
  }, [actions]);

  const extraOptions = templates.filter((t) =>
    EXTRA_KINDS.find((k) => k.value === extraKind)!.categories.includes(t.category)
  );

  if (familyLoading || (loading && !familyError)) return <PageSkeleton blocks={3} />;

  if (familyError || !family) {
    return (
      <div className="space-y-6">
        <PageHeader title="Hoje" />
        <Notice kind="error">{familyError || 'Família não encontrada'}</Notice>
      </div>
    );
  }

  const missionDay = mission
    ? Math.max(1, Math.round((Date.parse(today) - Date.parse(mission.start_at)) / 86_400_000) + 1)
    : 0;
  const missionTotal = mission
    ? Math.round((Date.parse(mission.end_at) - Date.parse(mission.start_at)) / 86_400_000) + 1
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={friendlyDate(today)}
        subtitle={
          mission
            ? `${mission.name} · dia ${missionDay} de ${missionTotal}`
            : 'Nenhuma missão em andamento'
        }
        actions={
          <Button variant="secondary" onClick={sync} loading={syncing}>
            ↻ Atualizar
          </Button>
        }
      />

      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

      {!mission ? (
        <EmptyState
          icon="🎯"
          title="Sem missão em andamento"
          description="As ações do dia só aparecem enquanto uma missão está ativa. Crie uma e inicie para começar a acompanhar."
          action={
            <Link href="/dashboard/missoes">
              <Button>Ir para Missões</Button>
            </Link>
          }
        />
      ) : kids.length === 0 ? (
        <EmptyState
          icon="🦸"
          title="Nenhum guardião ativo"
          description="Cadastre as crianças e adolescentes da casa para gerar as ações do dia."
          action={
            <Link href="/dashboard/guardioes">
              <Button>Cadastrar guardiões</Button>
            </Link>
          }
        />
      ) : (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Feitas" value={summary.done} tone="emerald" />
            <Stat label="Aguardando você" value={awaiting.length} tone="amber" />
            <Stat label="Pendentes" value={summary.pending} tone="gray" />
            <Stat label="Faltas" value={summary.missed} tone="red" />
          </div>

          {/* Awaiting confirmation (any day) */}
          {awaiting.length > 0 && (
            <Card className="border-amber-200">
              <CardHeader>
                <CardTitle>⏳ Aguardando sua confirmação ({awaiting.length})</CardTitle>
                <CardDescription>
                  O guardião marcou &quot;Fiz!&quot;. Confirme se foi feita mesmo.
                </CardDescription>
              </CardHeader>
              <div className="divide-y divide-gray-100">
                {awaiting.map((a) => {
                  const who = guardians.find((g) => g.id === a.guardian_id)?.name ?? '—';
                  const cat = categoryMeta(a.category);
                  return (
                    <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {cat?.emoji ?? '📋'} {a.name}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {who} · {localTimeString(tz, a.due_at)}
                          {a.due_at < localDayRangeUtc(tz).startUtc ? ' · dia anterior' : ''}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="sm" onClick={() => decide(a.id, 'confirm')} loading={busyId === a.id}>
                          Confirmar
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => decide(a.id, 'reject')}
                          disabled={busyId === a.id}
                        >
                          Não foi feita
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Per guardian */}
          {kids.map((g) => {
            const mine = actions.filter((a) => a.guardian_id === g.id);
            const done = mine.filter((a) => a.status === 'confirmed').length;
            const scheduled = mine.filter((a) => a.status !== 'cancelled');
            const pct = scheduled.length ? Math.round((done / scheduled.length) * 100) : 0;
            return (
              <Card key={g.id}>
                <CardHeader className="mb-2">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base">🦸 {g.name}</CardTitle>
                    <span className="text-xs font-medium text-gray-500">
                      {done} de {scheduled.length} feitas
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-gray-100">
                    <div
                      className="h-1.5 rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </CardHeader>

                {mine.length === 0 ? (
                  <p className="py-2 text-xs text-gray-400">Nada programado para hoje.</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {mine.map((a) => (
                      <ActionRow
                        key={a.id}
                        action={a}
                        tz={tz}
                        busy={busyId === a.id}
                        decidedBy={decidedBy[a.id]}
                        onDecide={(d) => decide(a.id, d)}
                      />
                    ))}
                  </div>
                )}
              </Card>
            );
          })}

          {/* Extra events */}
          <Card>
            <CardHeader>
              <CardTitle>➕ Registrar um evento extra</CardTitle>
              <CardDescription>
                Tropeços, missões extras e escaladas não têm horário — você registra quando acontecem.
              </CardDescription>
            </CardHeader>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-gray-500">Guardião</label>
                <select
                  value={selectedExtraGuardian}
                  onChange={(e) => setExtraGuardian(e.target.value)}
                  className={cn(inputClass, 'mt-1')}
                >
                  {kids.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Tipo</label>
                <div className="mt-1 grid grid-cols-3 gap-1 rounded-lg bg-gray-100 p-1">
                  {EXTRA_KINDS.map((k) => (
                    <button
                      key={k.value}
                      type="button"
                      onClick={() => { setExtraKind(k.value); setExtraTemplate(''); }}
                      className={cn(
                        'rounded-md px-2 py-1.5 text-xs font-semibold transition-colors',
                        extraKind === k.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                      )}
                    >
                      {k.emoji} {k.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <p className="mt-2 text-xs text-gray-500">
              {EXTRA_KINDS.find((k) => k.value === extraKind)!.help}
            </p>

            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1">
                <label className="text-xs font-medium text-gray-500">Ação</label>
                <select
                  value={extraTemplate}
                  onChange={(e) => setExtraTemplate(e.target.value)}
                  className={cn(inputClass, 'mt-1')}
                >
                  <option value="">Escolha…</option>
                  {extraOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}{t.points ? ` (${t.points > 0 ? '+' : ''}${t.points})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <Button onClick={registerExtra} loading={extraBusy} disabled={!extraTemplate || !selectedExtraGuardian}>
                Registrar
              </Button>
            </div>

            {extraOptions.length === 0 && (
              <p className="mt-2 text-xs text-amber-600">
                Nenhuma ação desse tipo cadastrada.{' '}
                <Link href="/dashboard/acoes" className="font-semibold underline">
                  Adicionar em Ações
                </Link>
                .
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'amber' | 'gray' | 'red' }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    gray: 'bg-gray-50 text-gray-700',
    red: 'bg-red-50 text-red-700',
  };
  return (
    <div className={cn('rounded-xl px-4 py-3', tones[tone])}>
      <p className="text-2xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-xs font-medium opacity-80">{label}</p>
    </div>
  );
}

function ActionRow({
  action,
  tz,
  busy,
  decidedBy,
  onDecide,
}: {
  action: TodayAction;
  tz: string;
  busy: boolean;
  decidedBy?: string;
  onDecide: (d: 'confirm' | 'reject' | 'done' | 'missed' | 'reopen') => void;
}) {
  const cat = categoryMeta(action.category);
  const isExtra = ['tropecos', 'missoes', 'gentilezas', 'autoaperfeicoamento', 'rendimento_escolar'].includes(
    action.category
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-base">{cat?.emoji ?? '📋'}</span>
        <div className="min-w-0">
          <p className={cn('truncate text-sm font-medium', action.status === 'missed' ? 'text-gray-500' : 'text-gray-900')}>
            {action.name}
          </p>
          <p className="text-[11px] text-gray-400">
            {isExtra ? `${cat?.label ?? 'Extra'} · registrada ${localTimeString(tz, action.due_at)}` : `até ${localTimeString(tz, action.due_at)}`}
            {action.escalada_points_earned ? ` · +${action.escalada_points_earned} energia` : ''}
            {action.recovers_action_id ? ' · compensa uma falta' : ''}
            {decidedBy && (action.status === 'confirmed' || action.status === 'missed') ? ` · por ${decidedBy}` : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <StatusPill status={action.status} />
        {action.status === 'pending' && (
          <>
            <IconButton title="Marcar como feita" onClick={() => onDecide('done')} disabled={busy}>✓</IconButton>
            <IconButton title="Marcar como não feita" onClick={() => onDecide('missed')} disabled={busy} danger>✕</IconButton>
          </>
        )}
        {action.status === 'marked_done' && (
          <>
            <IconButton title="Confirmar" onClick={() => onDecide('confirm')} disabled={busy}>✓</IconButton>
            <IconButton title="Não foi feita" onClick={() => onDecide('reject')} disabled={busy} danger>✕</IconButton>
          </>
        )}
        {action.status === 'missed' && !isExtra && (
          <IconButton title="Na verdade foi feita" onClick={() => onDecide('done')} disabled={busy}>✓</IconButton>
        )}
        {(action.status === 'confirmed' || action.status === 'missed') && (
          <IconButton title="Desfazer" onClick={() => onDecide('reopen')} disabled={busy} subtle>↶</IconButton>
        )}
      </div>
    </div>
  );
}

function IconButton({
  children,
  title,
  onClick,
  disabled,
  danger,
  subtle,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  subtle?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold transition-colors disabled:opacity-40',
        subtle
          ? 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
          : danger
            ? 'bg-red-50 text-red-600 hover:bg-red-100'
            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
      )}
    >
      {children}
    </button>
  );
}
