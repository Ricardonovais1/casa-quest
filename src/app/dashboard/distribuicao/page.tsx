'use client';

// ============================================================
// Casa Quest — Dashboard: Distribuição das atividades colaborativas
// Equânime (por pontos), com rodízio a cada período. Automática,
// manual ou programada. Tudo via /api/families/distribution.
// ============================================================

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useFamily } from '@/hooks/use-family';
import { getSupabaseBrowserClient } from '@/infrastructure/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader, EmptyState, Notice, PageSkeleton, inputClass } from '@/components/ui/page';
import type { AssignmentRow } from '@/lib/distribution';
import { ROTATION_INTERVAL_OPTIONS } from '@/lib/constants';
import { describeSchedule } from '@/lib/scheduling';
import { formatDate, cn } from '@/lib/utils';

interface CollabTemplate {
  id: string;
  name: string;
  points: number;
  frequency: string | null;
}

export default function DistributionPage() {
  const { family, kids, canManage, loading: familyLoading } = useFamily();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [templates, setTemplates] = useState<CollabTemplate[]>([]);
  const [manualMap, setManualMap] = useState<Record<string, string>>({});
  const [interval, setIntervalMonths] = useState<number>(1);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const supabase = getSupabaseBrowserClient();
  const nonMorGuardians = kids.filter((g) => g.is_active);

  const load = useCallback(async () => {
    if (!family) return;
    setIntervalMonths(family.rotation_interval_months ?? 1);
    try {
      const res = await fetch('/api/families/distribution', { cache: 'no-store' });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setNotice({ kind: 'error', text: body?.error?.message || 'Não foi possível carregar a distribuição.' });
      } else {
        setAssignments(body.data.assignments as AssignmentRow[]);
      }
    } catch {
      setNotice({ kind: 'error', text: 'Sem conexão com o servidor.' });
    }
    setLoading(false);
  }, [family]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data load on mount; state is only set after the await resolves
    if (family) load();
  }, [family, load]);

  async function post(payload: Record<string, unknown>) {
    const res = await fetch('/api/families/distribution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.error?.message || 'Falha na operação');
    return body.data;
  }

  async function enterManual() {
    if (!family) return;
    const { data } = await supabase
      .from('action_templates')
      .select('id, name, points, frequency')
      .eq('family_id', family.id)
      .eq('category', 'cooperacao')
      .eq('is_active', true)
      .order('points', { ascending: false });
    setTemplates((data ?? []) as CollabTemplate[]);

    const map: Record<string, string> = {};
    for (const a of assignments) map[a.action_template_id] = a.guardian_id;
    setManualMap(map);
    setManualMode(true);
  }

  async function handleAuto() {
    setBusy('auto');
    setNotice(null);
    try {
      const data = await post({ mode: 'auto' });
      setAssignments(data.assignments);
      setManualMode(false);
      setNotice({ kind: 'success', text: 'Nova rodada sorteada com equilíbrio de pontos.' });
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : 'Erro' });
    }
    setBusy(null);
  }

  async function handleManualSave() {
    setBusy('manual');
    setNotice(null);
    try {
      const data = await post({
        mode: 'manual',
        assignments: templates
          .filter((t) => manualMap[t.id])
          .map((t) => ({ templateId: t.id, guardianId: manualMap[t.id] })),
      });
      setAssignments(data.assignments);
      setManualMode(false);
      setNotice({ kind: 'success', text: 'Distribuição salva.' });
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : 'Erro' });
    }
    setBusy(null);
  }

  async function handleIntervalChange(value: number) {
    setIntervalMonths(value);
    try {
      await post({ mode: 'interval', intervalMonths: value });
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : 'Erro' });
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; actions: AssignmentRow[]; total: number }>();
    for (const a of assignments) {
      if (!map.has(a.guardian_id)) {
        map.set(a.guardian_id, { name: a.guardian_name, actions: [], total: 0 });
      }
      const g = map.get(a.guardian_id)!;
      g.actions.push(a);
      g.total += a.points;
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [assignments]);

  const period = assignments[0];

  if (familyLoading || loading) return <PageSkeleton blocks={2} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Distribuição"
        subtitle={
          period
            ? `Rodada vigente de ${formatDate(period.valid_from)} até ${formatDate(period.valid_until)}`
            : 'As atividades de colaboração são divididas por pontos e rodam a cada período.'
        }
        actions={
          canManage ? (
          <>
            {!manualMode && (
              <Button variant="secondary" onClick={enterManual} disabled={nonMorGuardians.length === 0}>
                ✋ Ajustar manualmente
              </Button>
            )}
            <Button onClick={handleAuto} loading={busy === 'auto'} disabled={nonMorGuardians.length === 0}>
              🔄 Sortear de novo
            </Button>
          </>
          ) : undefined
        }
      />

      {!canManage && (
        <Notice kind="info">Só o Guardião-Mor sorteia ou ajusta a distribuição. Aqui você acompanha a rodada vigente.</Notice>
      )}

      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

      {/* Rotation interval */}
      <Card>
        <CardHeader>
          <CardTitle>⏳ Rodízio</CardTitle>
          <CardDescription>
            A cada quanto tempo as atividades trocam de mão? A troca acontece sozinha no fim do período.
          </CardDescription>
        </CardHeader>
        <div className="flex flex-wrap gap-2">
          {ROTATION_INTERVAL_OPTIONS.map((n) => (
            <button
              key={n}
              disabled={!canManage}
              onClick={() => handleIntervalChange(n)}
              className={cn(
                'rounded-lg px-5 py-2 text-sm font-semibold transition-colors',
                interval === n ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              {n === 1 ? '1 mês' : `${n} meses`}
            </button>
          ))}
        </div>
      </Card>

      {/* Manual mode */}
      {manualMode && (
        <Card>
          <CardHeader>
            <CardTitle>✋ Distribuição manual</CardTitle>
            <CardDescription>Escolha quem faz cada atividade nesta rodada. Vale até o fim do período.</CardDescription>
          </CardHeader>
          <div className="space-y-2">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 py-1">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{t.name}</p>
                  <p className="text-[11px] text-gray-400">
                    {describeSchedule(t.frequency)} · {t.points > 0 ? `+${t.points}` : t.points} pts
                  </p>
                </div>
                <select
                  value={manualMap[t.id] ?? ''}
                  onChange={(e) => setManualMap((prev) => ({ ...prev, [t.id]: e.target.value }))}
                  className={cn(inputClass, 'w-auto')}
                >
                  <option value="">Ninguém</option>
                  {nonMorGuardians.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleManualSave} loading={busy === 'manual'}>
              Salvar distribuição
            </Button>
            <Button variant="ghost" onClick={() => setManualMode(false)}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      {/* Current distribution grouped by guardian */}
      {nonMorGuardians.length === 0 ? (
        <EmptyState
          icon="🦸"
          title="Nenhum guardião ativo"
          description="Cadastre os guardiões para distribuir as atividades da casa."
          action={<Link href="/dashboard/guardioes"><Button>Cadastrar guardiões</Button></Link>}
        />
      ) : grouped.length === 0 ? (
        <EmptyState
          icon="🤝"
          title="Nenhuma atividade de colaboração ativa"
          description="Adicione atividades da categoria Colaboração em “Ações” para distribuí-las entre os guardiões."
          action={<Link href="/dashboard/acoes"><Button>Ir para Ações</Button></Link>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {grouped.map((g) => (
            <Card key={g.name}>
              <CardHeader>
                <CardTitle>
                  🦸 {g.name} <span className="font-normal text-gray-400">· {g.total} pts</span>
                </CardTitle>
                <CardDescription>
                  {g.actions.length} atividade{g.actions.length !== 1 ? 's' : ''} nesta rodada
                </CardDescription>
              </CardHeader>
              <div className="divide-y divide-gray-100">
                {g.actions.map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-800">{a.action_name}</span>
                    <span className="text-[11px] text-gray-400">
                      {describeSchedule(a.frequency)} · {a.points > 0 ? `+${a.points}` : a.points}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
