'use client';

// ============================================================
// Casa Quest — Dashboard: Missões
// Criar, iniciar, encerrar e cancelar missões (períodos de mesada).
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { useFamily } from '@/hooks/use-family';
import { getSupabaseBrowserClient } from '@/infrastructure/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader, EmptyState, Notice, PageSkeleton, inputClass } from '@/components/ui/page';
import { formatDate, formatCurrency, cn } from '@/lib/utils';
import { localDateString, addDays } from '@/lib/day-range';

interface Mission {
  id: string;
  name: string;
  start_at: string;
  end_at: string;
  target_reward_amount: number;
  status: string;
  created_at: string;
}

interface Result {
  mission_id: string;
  guardian_id: string;
  final_energy: number | null;
  final_reward: number | null;
}

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function suggestName(dateStr: string): string {
  const month = Number(dateStr.slice(5, 7)) - 1;
  return `Missão de ${MONTHS[month] ?? ''}`.trim();
}

export default function MissionsPage() {
  const { family, guardians, loading: familyLoading } = useFamily();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [confirming, setConfirming] = useState<{ id: string; action: 'complete' | 'cancel' } | null>(null);

  // Form
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [duration, setDuration] = useState(15);
  const [targetReward, setTargetReward] = useState('50');

  const supabase = getSupabaseBrowserClient();
  const tz = family?.timezone || 'America/Sao_Paulo';
  const today = localDateString(tz);

  const loadMissions = useCallback(async () => {
    if (!family) return;
    const { data } = await supabase
      .from('missions')
      .select('*')
      .eq('family_id', family.id)
      .order('created_at', { ascending: false });
    const list = (data ?? []) as Mission[];
    setMissions(list);

    const completed = list.filter((m) => m.status === 'completed').map((m) => m.id);
    if (completed.length > 0) {
      const { data: rows } = await supabase
        .from('mission_guardians')
        .select('mission_id, guardian_id, final_energy, final_reward')
        .in('mission_id', completed);
      setResults((rows ?? []) as Result[]);
    }
    setLoading(false);
  }, [family, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data load on mount; state is only set after the await resolves
    if (family) loadMissions();
  }, [family, loadMissions]);

  function openForm() {
    const start = today;
    setName(suggestName(start));
    setStartDate(start);
    setDuration(family?.mission_duration_days || 15);
    setTargetReward('50');
    setNotice(null);
    setShowForm(true);
  }

  async function handleCreate() {
    if (!family || !name.trim() || !startDate) return;
    setSaving(true);
    setNotice(null);

    const endDate = addDays(startDate, duration - 1);

    const res = await fetch('/api/missions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        startAt: `${startDate}T12:00:00.000Z`,
        endAt: `${endDate}T12:00:00.000Z`,
        targetRewardAmount: parseFloat(targetReward) || 50,
      }),
    });

    if (res.ok) {
      setShowForm(false);
      setNotice({ kind: 'success', text: 'Missão criada como rascunho. Inicie quando estiver pronto.' });
      loadMissions();
    } else {
      const err = await res.json().catch(() => null);
      setNotice({ kind: 'error', text: err?.error?.message || 'Falha ao criar missão' });
    }
    setSaving(false);
  }

  async function lifecycle(id: string, action: 'activate' | 'complete' | 'cancel') {
    setBusyId(id);
    setNotice(null);
    setConfirming(null);
    try {
      const res = await fetch(`/api/missions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setNotice({ kind: 'error', text: body?.error?.message || 'Não foi possível atualizar a missão.' });
      } else if (action === 'activate') {
        const generated = body?.data?.sync?.generated ?? 0;
        setNotice({
          kind: 'success',
          text: `Missão iniciada! ${generated > 0 ? `${generated} ações geradas para hoje.` : 'As ações de hoje aparecem no painel "Hoje".'}`,
        });
      } else if (action === 'complete') {
        setNotice({ kind: 'success', text: 'Missão encerrada. Veja a mesada sugerida em Energia.' });
      }
    } catch {
      setNotice({ kind: 'error', text: 'Sem conexão com o servidor.' });
    }
    await loadMissions();
    setBusyId(null);
  }

  if (familyLoading || loading) return <PageSkeleton blocks={2} />;

  const activeMission = missions.find((m) => m.status === 'active');
  const kids = guardians.filter((g) => !g.is_mor);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Missões"
        subtitle="Uma missão é um período com mesada-alvo. A energia de cada guardião define quanto da mesada ele recebe."
        actions={
          <Button onClick={showForm ? () => setShowForm(false) : openForm}>
            {showForm ? 'Cancelar' : '+ Nova missão'}
          </Button>
        }
      />

      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Nova missão</CardTitle>
            <CardDescription>Ela começa como rascunho. Só passa a gerar ações quando você iniciar.</CardDescription>
          </CardHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500">Nome</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Missão de setembro"
                className={cn(inputClass, 'mt-1')}
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-500">Início</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={cn(inputClass, 'mt-1')}
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-500">Duração</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                  className={cn(inputClass, 'mt-1')}
                >
                  <option value={7}>7 dias</option>
                  <option value={15}>15 dias</option>
                  <option value={30}>30 dias</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Mesada-alvo por guardião (R$)</label>
              <input
                type="number"
                value={targetReward}
                onChange={(e) => setTargetReward(e.target.value)}
                className={cn(inputClass, 'mt-1')}
                placeholder="50.00"
                step="0.01"
                min="0"
              />
              <p className="mt-1 text-[11px] text-gray-400">
                Os guardiões nunca veem este valor — só a energia deles.
              </p>
            </div>
            {startDate && (
              <p className="text-xs text-gray-500">
                Termina em {formatDate(addDays(startDate, duration - 1))}.
              </p>
            )}
            <Button onClick={handleCreate} loading={saving} disabled={!name.trim() || !startDate}>
              Criar missão
            </Button>
          </div>
        </Card>
      )}

      {missions.length === 0 ? (
        <EmptyState
          icon="🚀"
          title="Nenhuma missão ainda"
          description="Crie a primeira: escolha o período e a mesada-alvo. Depois é só iniciar."
          action={<Button onClick={openForm}>Criar a primeira missão</Button>}
        />
      ) : (
        <div className="space-y-3">
          {missions.map((m) => {
            const total = Math.round((Date.parse(m.end_at) - Date.parse(m.start_at)) / 86_400_000) + 1;
            const day = Math.min(total, Math.max(0, Math.round((Date.parse(today) - Date.parse(m.start_at)) / 86_400_000) + 1));
            const myResults = results.filter((r) => r.mission_id === m.id);
            const isConfirming = confirming?.id === m.id;

            return (
              <Card key={m.id} className={cn(m.status === 'active' && 'border-emerald-200')}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">{m.name}</h3>
                      <StatusBadge status={m.status} />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {formatDate(m.start_at)} a {formatDate(m.end_at)} · {total} dias
                      {m.status === 'active' && ` · dia ${day} de ${total}`}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      Mesada-alvo: {formatCurrency(m.target_reward_amount)} por guardião
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {m.status === 'draft' && (
                      <>
                        <Button
                          size="sm"
                          variant="auxilio"
                          onClick={() => lifecycle(m.id, 'activate')}
                          loading={busyId === m.id}
                          disabled={!!activeMission}
                          title={activeMission ? 'Encerre a missão em andamento antes' : undefined}
                        >
                          ▶ Iniciar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => lifecycle(m.id, 'cancel')} disabled={busyId === m.id}>
                          Excluir
                        </Button>
                      </>
                    )}
                    {m.status === 'active' && !isConfirming && (
                      <Button size="sm" variant="secondary" onClick={() => setConfirming({ id: m.id, action: 'complete' })}>
                        Encerrar agora
                      </Button>
                    )}
                  </div>
                </div>

                {isConfirming && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <span className="flex-1">
                      Encerrar calcula a energia final e a mesada sugerida. Não dá para reabrir. Continuar?
                    </span>
                    <Button size="sm" variant="danger" onClick={() => lifecycle(m.id, 'complete')} loading={busyId === m.id}>
                      Encerrar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                      Voltar
                    </Button>
                  </div>
                )}

                {m.status === 'active' && (
                  <div className="mt-3">
                    <div className="h-1.5 rounded-full bg-gray-200">
                      <div
                        className="h-1.5 rounded-full bg-indigo-500 transition-all"
                        style={{ width: `${Math.round((day / total) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-gray-400">
                      {total - day === 0 ? 'Último dia' : `${total - day} dia${total - day === 1 ? '' : 's'} restante${total - day === 1 ? '' : 's'}`}
                      {' · encerra sozinha no dia seguinte ao fim'}
                    </p>
                  </div>
                )}

                {m.status === 'completed' && myResults.length > 0 && (
                  <div className="mt-3 rounded-lg bg-gray-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Resultado</p>
                    <div className="mt-1 divide-y divide-gray-200">
                      {myResults.map((r) => {
                        const g = kids.find((k) => k.id === r.guardian_id);
                        if (!g) return null;
                        return (
                          <div key={r.guardian_id} className="flex items-center justify-between py-1.5 text-sm">
                            <span className="text-gray-800">🦸 {g.name}</span>
                            <span className="text-xs text-gray-500">
                              energia {r.final_energy != null ? Math.round(Number(r.final_energy)) : '—'} ·{' '}
                              <strong className="text-gray-900">{r.final_reward != null ? formatCurrency(Number(r.final_reward)) : '—'}</strong>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    draft: { label: 'Rascunho', color: 'bg-gray-100 text-gray-700' },
    active: { label: 'Em andamento', color: 'bg-emerald-100 text-emerald-700' },
    completed: { label: 'Concluída', color: 'bg-blue-100 text-blue-700' },
    cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-700' },
  };
  const s = map[status] || { label: status, color: 'bg-gray-100' };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.color}`}>{s.label}</span>
  );
}
