'use client';

// ============================================================
// Casa Quest — Dashboard: Energia (visão do Guardião-Mor)
// Energia real de cada guardião na missão + prévia da mesada.
// A mesada nunca aparece para os guardiões — só aqui.
// ============================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader, EmptyState, Notice, PageSkeleton } from '@/components/ui/page';
import { EnergyMeter } from '@/components/energy/energy-meter';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { GuardianEnergy } from '@/lib/guardian-energy';

interface Summary {
  mission: {
    id: string;
    name: string;
    start_at: string;
    end_at: string;
    status: string;
    target_reward_amount: number;
  } | null;
  guardians: {
    guardian: { id: string; name: string; age: number | null; isActive: boolean };
    energy: GuardianEnergy;
    reward: {
      target: number;
      tierPercent: number;
      base: number;
      cooperationBonus: number;
      total: number;
      finalRecorded: number | null;
    } | null;
  }[];
  canSeeMoney?: boolean;
}

export default function EnergyPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/energy/summary', { cache: 'no-store' });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error?.message || 'Não foi possível carregar a energia.');
      } else {
        setData(body.data as Summary);
      }
    } catch {
      setError('Sem conexão com o servidor.');
    }
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data load on mount; state is only set after the await resolves
    load();
  }, []);

  if (loading) return <PageSkeleton blocks={2} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Energia"
        subtitle={
          data?.mission
            ? `${data.mission.name} · ${formatDate(data.mission.start_at)} a ${formatDate(data.mission.end_at)}${data.mission.status === 'completed' ? ' · encerrada' : ''}`
            : 'Acompanhe o compromisso de cada guardião'
        }
        actions={
          <Button variant="secondary" onClick={load}>
            ↻ Atualizar
          </Button>
        }
      />

      {error && <Notice kind="error">{error}</Notice>}

      {!data?.mission ? (
        <EmptyState
          icon="⚡"
          title="Nenhuma missão para medir"
          description="A energia é calculada dentro de uma missão. Crie e inicie uma para começar."
          action={
            <Link href="/dashboard/missoes">
              <Button>Ir para Missões</Button>
            </Link>
          }
        />
      ) : data.guardians.length === 0 ? (
        <EmptyState
          icon="🦸"
          title="Nenhum guardião nesta missão"
          description="Os guardiões entram na missão quando ela é iniciada."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.guardians.map(({ guardian, energy, reward }) => (
            <Card key={guardian.id}>
              <div className="flex items-start gap-4">
                <EnergyMeter percentage={energy.percentage} qualitative={energy.qualitative} size="sm" showLabel={false} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate text-base font-semibold text-gray-900">🦸 {guardian.name}</h3>
                    <span className={`shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold ${energy.qualitative.color}`}>
                      {energy.qualitative.emoji} {energy.qualitative.label}
                    </span>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600">
                    <Fact label="Constância" value={`${energy.streakDays} ${energy.streakDays === 1 ? 'dia' : 'dias'} 🔥`} />
                    <Fact label="Cooperação" value={`${energy.cooperationScore} pts 🤝`} />
                    <Fact label="Feitas" value={String(energy.counts.done)} />
                    <Fact label="Faltas" value={String(energy.counts.missed)} />
                    <Fact label="Compensações" value={String(energy.counts.recoveries)} />
                    <Fact label="Escalada" value={`+${energy.counts.escaladaPoints}`} />
                  </dl>
                </div>
              </div>

              {/* Money is for whoever manages (and advisors, if the family allows) */}
              {reward && (
              <div className="mt-4 rounded-lg bg-indigo-50 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-indigo-900">
                    {data.mission!.status === 'completed' ? 'Mesada final' : 'Mesada se terminasse hoje'}
                  </span>
                  <span className="text-sm font-bold text-indigo-900">
                    {formatCurrency(reward.finalRecorded ?? reward.total)}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-indigo-700">
                  {reward.tierPercent}% de {formatCurrency(reward.target)}
                  {reward.cooperationBonus > 0 ? ` + ${formatCurrency(reward.cooperationBonus)} de cooperação` : ''}
                  {' · '}os guardiões nunca veem este valor
                </p>
              </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>📊 Como a energia é calculada</CardTitle>
          <CardDescription>
            Todo guardião começa a missão com 100 de energia. Ela não é dinheiro: é uma medida de compromisso.
          </CardDescription>
        </CardHeader>
        <div className="grid gap-2 text-xs text-gray-600 sm:grid-cols-2">
          <Rule icon="✕" text="Uma falta isolada tira 1. Faltas em dias seguidos na mesma ação pesam mais: 2 dias tiram 3, 3 dias tiram 7." />
          <Rule icon="🔁" text="Faltar em várias ações diferentes (tropeços incluídos) soma uma penalidade extra de reincidência." />
          <Rule icon="🏆" text={`Cada missão extra devolve energia (${'+2'} por padrão, ajustável em Configurações), até compensar as faltas.`} />
          <Rule icon="⬆️" text="Escaladas (gentilezas, estudo, ir além) somam energia extra e podem passar de 100." />
          <Rule icon="🤝" text="Cooperação é outra medida: ajudar os outros não muda a energia, mas dá bônus na mesada." />
          <Rule icon="💰" text="Mesada: 90%+ de energia vale 100% do valor-alvo; 70–89% vale 80%; 50–69% vale 60%; 30–49% vale 40%; abaixo, 20%." />
        </div>
      </Card>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-gray-400">{label}</dt>
      <dd className="font-medium text-gray-800">{value}</dd>
    </div>
  );
}

function Rule({ icon, text }: { icon: string; text: string }) {
  return (
    <p className="flex gap-2 rounded-lg bg-gray-50 px-3 py-2">
      <span className="shrink-0">{icon}</span>
      <span>{text}</span>
    </p>
  );
}
