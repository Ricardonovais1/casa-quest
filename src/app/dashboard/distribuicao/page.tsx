'use client';

// ============================================================
// Casa Quest — Dashboard: Distribution of collaborative actions
// Equânime (points-based), rotating, with manual/auto/scheduled.
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import { useFamily } from '@/hooks/use-family';
import { getSupabaseBrowserClient } from '@/infrastructure/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ensureCurrentDistribution,
  computePeriod,
  type AssignmentRow,
} from '@/lib/distribution';
import { ROTATION_INTERVAL_OPTIONS } from '@/lib/constants';
import { formatDate } from '@/lib/utils';

interface CollabTemplate {
  id: string;
  name: string;
  points: number;
  frequency: string | null;
}

export default function DistributionPage() {
  const { family, guardians, loading: familyLoading } = useFamily();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [templates, setTemplates] = useState<CollabTemplate[]>([]);
  const [manualMap, setManualMap] = useState<Record<string, string>>({});
  const [interval, setIntervalMonths] = useState<number>(1);

  const supabase = getSupabaseBrowserClient();
  const nonMorGuardians = guardians.filter((g) => !g.is_mor && g.is_active);

  async function load() {
    if (!family) return;
    setIntervalMonths(family.rotation_interval_months ?? 1);
    const { assignments: rows } = await ensureCurrentDistribution(supabase, family.id);
    setAssignments(rows);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data load on mount; state is only set after the await resolves
    if (family) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family]);

  async function enterManual() {
    if (!family) return;
    const { data } = await supabase
      .from('action_templates')
      .select('id, name, points, frequency')
      .eq('family_id', family.id)
      .eq('category', 'cooperacao')
      .eq('is_active', true);
    const t = (data ?? []) as CollabTemplate[];
    setTemplates(t);

    const map: Record<string, string> = {};
    for (const a of assignments) map[a.action_template_id] = a.guardian_id;
    setManualMap(map);
    setManualMode(true);
  }

  async function handleAuto() {
    if (!family) return;
    setBusy('auto');
    const { assignments: rows } = await ensureCurrentDistribution(supabase, family.id, {
      force: true,
      seed: Math.floor(Math.random() * 100000),
    });
    setAssignments(rows);
    setManualMode(false);
    setBusy(null);
  }

  async function handleManualSave() {
    if (!family) return;
    setBusy('manual');
    const today = new Date().toISOString().split('T')[0]!;
    const { validFrom, validUntil } = computePeriod(interval);

    await supabase
      .from('action_assignments')
      .delete()
      .eq('family_id', family.id)
      .gte('valid_until', today);

    const rows = templates
      .filter((t) => manualMap[t.id])
      .map((t) => ({
        family_id: family.id,
        action_template_id: t.id,
        guardian_id: manualMap[t.id]!,
        valid_from: validFrom,
        valid_until: validUntil,
      }));

    if (rows.length > 0) {
      await supabase.from('action_assignments').insert(rows);
    }

    const { assignments: refreshed } = await ensureCurrentDistribution(supabase, family.id);
    setAssignments(refreshed);
    setManualMode(false);
    setBusy(null);
  }

  async function handleIntervalChange(value: number) {
    if (!family) return;
    setIntervalMonths(value);
    await supabase
      .from('families')
      .update({ rotation_interval_months: value })
      .eq('id', family.id);
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

  if (familyLoading || loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="h-40 rounded-xl bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Distribuição</h1>
          <p className="mt-1 text-sm text-gray-500">
            {period
              ? `Vigente de ${formatDate(period.valid_from)} até ${formatDate(period.valid_until)}`
              : 'Distribuição equânime das atividades colaborativas'}
          </p>
        </div>
        <Button onClick={handleAuto} loading={busy === 'auto'}>
          🔄 Redistribuir automaticamente
        </Button>
      </div>

      {/* Rotation interval */}
      <Card>
        <CardHeader>
          <CardTitle>⏳ Rotação programada</CardTitle>
          <CardDescription>
            A cada quanto tempo as atividades colaborativas são redistribuídas automaticamente?
          </CardDescription>
        </CardHeader>
        <div className="flex gap-2">
          {ROTATION_INTERVAL_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => handleIntervalChange(n)}
              className={`rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${
                interval === n
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {n === 1 ? '1 mês' : `${n} meses`}
            </button>
          ))}
        </div>
      </Card>

      {/* Manual mode */}
      {manualMode ? (
        <Card>
          <CardHeader>
            <CardTitle>✋ Distribuição manual</CardTitle>
            <CardDescription>
              Escolha quem faz cada atividade neste período
            </CardDescription>
          </CardHeader>
          <div className="space-y-2">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 py-1">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{t.name}</p>
                  <p className="text-[11px] text-gray-400">
                    {t.frequency ? `${t.frequency} • ` : ''}
                    {t.points > 0 ? `+${t.points}` : t.points} pontos
                  </p>
                </div>
                <select
                  value={manualMap[t.id] ?? ''}
                  onChange={(e) =>
                    setManualMap((prev) => ({ ...prev, [t.id]: e.target.value }))
                  }
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">—</option>
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
      ) : (
        <Button variant="secondary" onClick={enterManual}>
          ✋ Redistribuir manualmente
        </Button>
      )}

      {/* Current distribution grouped by guardian */}
      {grouped.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <span className="text-4xl">🤝</span>
            <p className="mt-2 text-sm font-medium text-gray-700">
              Nenhuma atividade colaborativa ativa
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Adicione atividades de categoria Colaboração em &quot;Ações&quot; para distribuí-las.
            </p>
          </div>
        </Card>
      ) : (
        grouped.map((g) => (
          <Card key={g.name}>
            <CardHeader>
              <CardTitle>
                🦸 {g.name} <span className="text-gray-400">· {g.total} pts</span>
              </CardTitle>
              <CardDescription>
                {g.actions.length} atividade{g.actions.length !== 1 ? 's' : ''} no período
              </CardDescription>
            </CardHeader>
            <div className="divide-y divide-gray-100">
              {g.actions.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-800">{a.action_name}</span>
                  <span className="text-[11px] text-gray-400">
                    {a.frequency ? `${a.frequency} · ` : ''}
                    {a.points > 0 ? `+${a.points}` : a.points}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
