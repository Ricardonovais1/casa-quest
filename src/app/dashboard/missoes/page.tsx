'use client';

// ============================================================
// Casa Quest — Dashboard: Missions CRUD
// ============================================================

import { useState, useEffect } from 'react';
import { useFamily } from '@/hooks/use-family';
import { getSupabaseBrowserClient } from '@/infrastructure/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDate, formatCurrency } from '@/lib/utils';

interface Mission {
  id: string;
  name: string;
  start_at: string;
  end_at: string;
  target_reward_amount: number;
  status: string;
  created_at: string;
}

export default function MissionsPage() {
  const { family, guardians, loading: familyLoading } = useFamily();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [duration, setDuration] = useState(15);
  const [targetReward, setTargetReward] = useState('50');

  const supabase = getSupabaseBrowserClient();

  async function loadMissions() {
    if (!family) return;
    const { data } = await supabase
      .from('missions')
      .select('*')
      .eq('family_id', family.id)
      .order('created_at', { ascending: false });
    if (data) setMissions(data);
    setLoading(false);
  }

  // Captured once per mount — "dias restantes" only needs day-level precision,
  // and reading the clock during render is non-deterministic.
  const [now] = useState(() => Date.now());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data load on mount; state is only set after the await resolves
    if (family) loadMissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family]);

  function resetForm() {
    setName('');
    setStartDate(new Date().toISOString().split('T')[0]!);
    setDuration(15);
    setTargetReward('50');
    setShowForm(false);
  }

  async function handleCreate() {
    if (!family || !name.trim() || !startDate) return;
    setSaving(true);

    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + duration);

    const res = await fetch('/api/missions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        targetRewardAmount: parseFloat(targetReward) || 50,
      }),
    });

    if (res.ok) {
      resetForm();
      loadMissions();
    } else {
      const err = await res.json();
      alert('Erro: ' + (err.error?.message || 'Falha ao criar missão'));
    }
    setSaving(false);
  }

  async function handleActivate(missionId: string) {
    const supabase = getSupabaseBrowserClient();
    const nonMorGuardians = guardians.filter(g => !g.is_mor && g.is_active);

    if (nonMorGuardians.length === 0) {
      alert('Adicione pelo menos um Guardião ativo antes de iniciar uma missão.');
      return;
    }

    // Get active action templates
    const { data: templates } = await supabase
      .from('action_templates')
      .select('*')
      .eq('family_id', family!.id)
      .eq('is_active', true)
      .eq('action_type', 'basic');

    if (!templates || templates.length === 0) {
      alert('Crie pelo menos uma ação básica antes de iniciar uma missão.');
      return;
    }

    // Update mission status
    await supabase
      .from('missions')
      .update({ status: 'active' })
      .eq('id', missionId);

    // Ensure mission_guardians entries exist
    for (const g of nonMorGuardians) {
      const { data: existing } = await supabase
        .from('mission_guardians')
        .select('id')
        .eq('mission_id', missionId)
        .eq('guardian_id', g.id)
        .maybeSingle();

      if (!existing) {
        await supabase.from('mission_guardians').insert({
          mission_id: missionId,
          guardian_id: g.id,
          initial_energy: 100,
          current_energy: 100,
        });

        // Initial energy event
        await supabase.from('energy_events').insert({
          guardian_id: g.id,
          mission_id: missionId,
          event_type: 'initial_energy',
          amount: 100,
          metadata: { reason: 'mission_start' },
        });
      }
    }

    // Generate today's action instances
    const today = new Date().toISOString().split('T')[0]!;
    for (const g of nonMorGuardians) {
      for (const t of templates) {
        await supabase.from('mission_actions').insert({
          mission_id: missionId,
          guardian_id: g.id,
          action_template_id: t.id,
          due_at: `${today}T${t.default_due_time}:00`,
          status: 'pending',
        });
      }
    }

    loadMissions();
  }

  function getStatusBadge(status: string) {
    const map: Record<string, { label: string; color: string }> = {
      draft: { label: 'Rascunho', color: 'bg-gray-100 text-gray-700' },
      active: { label: 'Em andamento', color: 'bg-emerald-100 text-emerald-700' },
      completed: { label: 'Concluída', color: 'bg-blue-100 text-blue-700' },
      cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-700' },
    };
    const s = map[status] || { label: status, color: 'bg-gray-100' };
    return (
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.color}`}>
        {s.label}
      </span>
    );
  }

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
          <h1 className="text-2xl font-bold text-gray-900">Missões</h1>
          <p className="mt-1 text-sm text-gray-500">
            {missions.length} missão{missions.length !== 1 ? 'es' : ''}
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(!showForm); }}>
          {showForm ? 'Cancelar' : '+ Nova Missão'}
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Nova Missão</CardTitle>
            <CardDescription>Defina o período e o valor-alvo da mesada</CardDescription>
          </CardHeader>
          <div className="space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome da missão (ex: Missão Julho)"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus
            />
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-500">Início</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-500">Duração</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                >
                  <option value={7}>7 dias</option>
                  <option value={15}>15 dias</option>
                  <option value={30}>30 dias</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Mesada-alvo (R$)</label>
              <input
                type="number"
                value={targetReward}
                onChange={(e) => setTargetReward(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                placeholder="50.00"
                step="0.01"
                min="0"
              />
            </div>
            <Button onClick={handleCreate} loading={saving} disabled={!name.trim() || !startDate}>
              Criar Missão
            </Button>
          </div>
        </Card>
      )}

      {/* Missions list */}
      <div className="space-y-3">
        {missions.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <span className="text-4xl">🚀</span>
              <p className="mt-2 text-sm font-medium text-gray-700">Nenhuma missão</p>
              <p className="mt-1 text-xs text-gray-500">Crie sua primeira missão para começar!</p>
            </div>
          </Card>
        ) : (
          missions.map((m) => {
            const daysLeft = Math.max(0, Math.ceil(
              (new Date(m.end_at).getTime() - now) / (1000 * 60 * 60 * 24)
            ));
            const totalDays = Math.ceil(
              (new Date(m.end_at).getTime() - new Date(m.start_at).getTime()) / (1000 * 60 * 60 * 24)
            );

            return (
              <Card key={m.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">{m.name}</h3>
                      {getStatusBadge(m.status)}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {formatDate(m.start_at)} → {formatDate(m.end_at)}
                      {m.status === 'active' && ` • Dia ${totalDays - daysLeft} de ${totalDays}`}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      Mesada-alvo: {formatCurrency(m.target_reward_amount)}
                    </p>
                  </div>

                  {m.status === 'draft' && (
                    <button
                      onClick={() => handleActivate(m.id)}
                      className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-400 transition-colors"
                    >
                      ▶ Iniciar
                    </button>
                  )}
                </div>

                {/* Progress bar for active missions */}
                {m.status === 'active' && (
                  <div className="mt-3">
                    <div className="h-1.5 rounded-full bg-gray-200">
                      <div
                        className="h-1.5 rounded-full bg-indigo-500 transition-all"
                        style={{ width: `${Math.round(((totalDays - daysLeft) / totalDays) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-gray-400">
                      {daysLeft} dia{daysLeft !== 1 ? 's' : ''} restante{daysLeft !== 1 ? 's' : ''}
                    </p>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
