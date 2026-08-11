'use client';

// ============================================================
// Casa Quest — Mor Dashboard: Overview with real data
// ============================================================

import { useEffect, useState } from 'react';
import { useFamily } from '@/hooks/use-family';
import { getSupabaseBrowserClient } from '@/infrastructure/supabase/client';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function DashboardPage() {
  const { family, guardians, loading, error } = useFamily();
  const [activeMission, setActiveMission] = useState<{
    id: string; name: string; start_at: string; end_at: string;
    target_reward_amount: number; status: string;
  } | null>(null);
  const [pendingConfirmations, setPendingConfirmations] = useState(0);
  const [todayActions, setTodayActions] = useState(0);

  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    if (!family) return;

    async function loadStats() {
      // Active mission
      const { data: missions } = await supabase
        .from('missions')
        .select('*')
        .eq('family_id', family!.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1);

      if (missions && missions.length > 0) {
        setActiveMission(missions[0]!);

        // Pending confirmations
        const { count } = await supabase
          .from('mission_actions')
          .select('*', { count: 'exact', head: true })
          .eq('mission_id', missions[0]!.id)
          .eq('status', 'marked_done');

        setPendingConfirmations(count || 0);

        // Today's actions
        const today = new Date().toISOString().split('T')[0]!;
        const { count: todayCount } = await supabase
          .from('mission_actions')
          .select('*', { count: 'exact', head: true })
          .eq('mission_id', missions[0]!.id)
          .gte('due_at', `${today}T00:00:00`)
          .lte('due_at', `${today}T23:59:59`);

        setTodayActions(todayCount || 0);
      }
    }

    loadStats();
  }, [family]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  const nonMorGuardians = guardians.filter(g => !g.is_mor);
  const hasGuardians = nonMorGuardians.length > 0;
  const hasActions = true; // Will check from DB
  const hasMission = !!activeMission;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {family?.name || 'Dashboard'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {activeMission
            ? `Missão ativa: ${activeMission.name}`
            : 'Nenhuma missão ativa'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Missão"
          value={activeMission ? 'Ativa' : 'Nenhuma'}
          icon="🎯"
          color="bg-blue-50 text-blue-700"
          subtitle={activeMission ? `${activeMission.name}` : undefined}
        />
        <StatCard
          title="Ações Hoje"
          value={String(todayActions)}
          icon="✅"
          color="bg-emerald-50 text-emerald-700"
          subtitle="pendentes"
        />
        <StatCard
          title="Confirmações"
          value={String(pendingConfirmations)}
          icon="👀"
          color="bg-amber-50 text-amber-700"
          subtitle="aguardando"
        />
        <StatCard
          title="Guardiões"
          value={String(nonMorGuardians.length)}
          icon="🦸"
          color="bg-indigo-50 text-indigo-700"
          subtitle="ativos"
        />
      </div>

      {/* Setup checklist */}
      <Card>
        <CardHeader>
          <CardTitle>🚀 Checklist de configuração</CardTitle>
        </CardHeader>
        <div className="space-y-3">
          <Step
            number={1}
            title="Configure sua família"
            description="Nome, regras e tolerâncias"
            done={!!family}
            href="/dashboard/config"
          />
          <Step
            number={2}
            title="Adicione Guardiões"
            description="Cadastre cada criança ou adolescente"
            done={hasGuardians}
            href="/dashboard/guardioes"
          />
          <Step
            number={3}
            title="Crie templates de ações"
            description="Defina as responsabilidades diárias"
            done={false}
            href="/dashboard/acoes"
          />
          <Step
            number={4}
            title="Inicie uma Missão"
            description="Defina o período e o valor-alvo da mesada"
            done={hasMission}
            href="/dashboard/missoes"
          />
        </div>
      </Card>
    </div>
  );
}

function StatCard({
  title, value, icon, color, subtitle,
}: {
  title: string; value: string; icon: string; color: string; subtitle?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">{title}</span>
        <span className={`rounded-lg px-2 py-1 text-lg ${color}`}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
      {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
    </div>
  );
}

function Step({
  number, title, description, done, href,
}: {
  number: number; title: string; description: string; done: boolean; href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-lg p-2 hover:bg-gray-50 transition-colors"
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
          done ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'
        }`}
      >
        {done ? '✓' : number}
      </span>
      <div>
        <p className={`text-sm font-medium ${done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
          {title}
        </p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </Link>
  );
}
