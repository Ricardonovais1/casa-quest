'use client';

// ============================================================
// Casa Quest — Mor Dashboard: Visão geral
// Resumo do dia, missão em andamento e primeiros passos.
// ============================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useFamily } from '@/hooks/use-family';
import { getSupabaseBrowserClient } from '@/infrastructure/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader, Notice, PageSkeleton } from '@/components/ui/page';
import { localDayRangeUtc, friendlyDate } from '@/lib/day-range';
import { formatDate } from '@/lib/utils';

interface Mission {
  id: string;
  name: string;
  start_at: string;
  end_at: string;
  status: string;
}

export default function DashboardPage() {
  const { family, guardians, morGuardian, loading, error } = useFamily();
  const [mission, setMission] = useState<Mission | null>(null);
  const [today, setToday] = useState({ total: 0, done: 0, awaiting: 0, missed: 0 });
  const [templateCount, setTemplateCount] = useState<number | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    if (!family) return;
    const tz = family.timezone || 'America/Sao_Paulo';

    async function loadStats() {
      // Generate today's actions / sweep misses before counting.
      await fetch('/api/families/sync', { method: 'POST' }).catch(() => null);

      const [{ data: missions }, { count: templates }] = await Promise.all([
        supabase
          .from('missions')
          .select('id, name, start_at, end_at, status')
          .eq('family_id', family!.id)
          .eq('status', 'active')
          .order('start_at', { ascending: false })
          .limit(1),
        supabase
          .from('action_templates')
          .select('*', { count: 'exact', head: true })
          .eq('family_id', family!.id)
          .eq('is_active', true),
      ]);

      setTemplateCount(templates ?? 0);

      const active = missions?.[0] ?? null;
      setMission(active);

      if (active) {
        const { startUtc, endUtc } = localDayRangeUtc(tz);
        const [{ data: rows }, { count: awaiting }] = await Promise.all([
          supabase
            .from('mission_actions')
            .select('status')
            .eq('mission_id', active.id)
            .gte('due_at', startUtc)
            .lt('due_at', endUtc),
          supabase
            .from('mission_actions')
            .select('*', { count: 'exact', head: true })
            .eq('mission_id', active.id)
            .eq('status', 'marked_done'),
        ]);
        const list = rows ?? [];
        setToday({
          total: list.length,
          done: list.filter((r) => r.status === 'confirmed').length,
          awaiting: awaiting ?? 0,
          missed: list.filter((r) => r.status === 'missed').length,
        });
      }
      setStatsLoading(false);
    }

    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family?.id]);

  if (loading) return <PageSkeleton blocks={2} />;

  if (error || !family) {
    return (
      <div className="space-y-6">
        <PageHeader title="Visão geral" />
        <Notice kind="error">{error || 'Família não encontrada'}</Notice>
      </div>
    );
  }

  const kids = guardians.filter((g) => !g.is_mor);
  const activeKids = kids.filter((g) => g.is_active);
  const kidsWithLink = activeKids.filter((g) => !!g.access_token);
  const tz = family.timezone || 'America/Sao_Paulo';
  const { date } = localDayRangeUtc(tz);

  const steps = [
    { title: 'Família criada', description: family.name, done: true, href: '/dashboard/config' },
    {
      title: 'Guardiões cadastrados',
      description: activeKids.length ? activeKids.map((g) => g.name).join(', ') : 'Cadastre cada criança ou adolescente',
      done: activeKids.length > 0,
      href: '/dashboard/guardioes',
    },
    {
      title: 'Ações definidas',
      description: templateCount ? `${templateCount} ações ativas` : 'Use as ações sugeridas ou crie as suas',
      done: (templateCount ?? 0) > 0,
      href: '/dashboard/acoes',
    },
    {
      title: 'Links de acesso enviados',
      description:
        activeKids.length === 0
          ? 'Depois de cadastrar os guardiões'
          : `${kidsWithLink.length} de ${activeKids.length} guardiões com link`,
      done: activeKids.length > 0 && kidsWithLink.length === activeKids.length,
      href: '/dashboard/guardioes',
    },
    {
      title: 'Missão em andamento',
      description: mission ? mission.name : 'Defina o período e a mesada-alvo',
      done: !!mission,
      href: '/dashboard/missoes',
    },
  ];
  const allDone = steps.every((s) => s.done);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Olá, ${morGuardian?.name?.split(' ')[0] || 'Guardião-Mor'}!`}
        subtitle={friendlyDate(date)}
        actions={
          <Link href="/dashboard/hoje">
            <Button>☀️ Abrir o dia de hoje</Button>
          </Link>
        }
      />

      {/* Mission */}
      {mission ? (
        <MissionCard mission={mission} today={date} stats={today} loading={statsLoading} />
      ) : (
        <Card className="border-indigo-200 bg-indigo-50/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-indigo-900">Nenhuma missão em andamento</p>
              <p className="text-xs text-indigo-700">
                As ações do dia só aparecem para os guardiões durante uma missão.
              </p>
            </div>
            <Link href="/dashboard/missoes">
              <Button size="sm">Criar missão</Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Guardiões" value={String(activeKids.length)} icon="🦸" tone="bg-indigo-50 text-indigo-700" subtitle="ativos" />
        <StatCard title="Ações de hoje" value={mission ? `${today.done}/${today.total}` : '—'} icon="✅" tone="bg-emerald-50 text-emerald-700" subtitle="feitas" />
        <StatCard title="Aguardando você" value={mission ? String(today.awaiting) : '—'} icon="⏳" tone="bg-amber-50 text-amber-700" subtitle="confirmações" href="/dashboard/hoje" />
        <StatCard title="Faltas hoje" value={mission ? String(today.missed) : '—'} icon="✕" tone="bg-red-50 text-red-700" subtitle="após a tolerância" />
      </div>

      {/* Setup checklist */}
      {!allDone && (
        <Card>
          <CardHeader>
            <CardTitle>🚀 Primeiros passos</CardTitle>
            <CardDescription>Cinco passos e a casa está rodando.</CardDescription>
          </CardHeader>
          <div className="space-y-1">
            {steps.map((s, i) => (
              <Step key={s.title} number={i + 1} {...s} />
            ))}
          </div>
        </Card>
      )}

      {/* How it works (compact) */}
      <Card>
        <CardHeader>
          <CardTitle>Como a Casa Quest funciona no dia a dia</CardTitle>
        </CardHeader>
        <ol className="grid gap-3 text-sm text-gray-600 sm:grid-cols-3">
          <li className="rounded-lg bg-gray-50 p-3">
            <p className="font-semibold text-gray-900">1. Cada guardião abre o seu link</p>
            <p className="mt-1 text-xs">Sem senha. As ações do dia aparecem e ele marca &quot;Fiz!&quot;.</p>
          </li>
          <li className="rounded-lg bg-gray-50 p-3">
            <p className="font-semibold text-gray-900">2. Você confirma em &quot;Hoje&quot;</p>
            <p className="mt-1 text-xs">O que passou da tolerância vira falta sozinho. Você pode reverter.</p>
          </li>
          <li className="rounded-lg bg-gray-50 p-3">
            <p className="font-semibold text-gray-900">3. A energia conta a história</p>
            <p className="mt-1 text-xs">No fim da missão, a energia sugere a mesada. Só você vê o valor.</p>
          </li>
        </ol>
      </Card>
    </div>
  );
}

function MissionCard({
  mission,
  today,
  stats,
  loading,
}: {
  mission: Mission;
  today: string;
  stats: { total: number; done: number; awaiting: number; missed: number };
  loading: boolean;
}) {
  const total = Math.round((Date.parse(mission.end_at) - Date.parse(mission.start_at)) / 86_400_000) + 1;
  const day = Math.min(total, Math.max(1, Math.round((Date.parse(today) - Date.parse(mission.start_at)) / 86_400_000) + 1));
  const pct = Math.round((day / total) * 100);
  const daysLeft = Math.max(0, total - day);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">Missão em andamento</p>
          <h2 className="text-lg font-bold text-gray-900">🎯 {mission.name}</h2>
          <p className="text-xs text-gray-500">
            {formatDate(mission.start_at)} a {formatDate(mission.end_at)} · dia {day} de {total}
            {daysLeft === 0 ? ' · último dia' : ` · faltam ${daysLeft} dia${daysLeft === 1 ? '' : 's'}`}
          </p>
        </div>
        <Link href="/dashboard/energia">
          <Button size="sm" variant="secondary">⚡ Ver energia</Button>
        </Link>
      </div>
      <div className="mt-3 h-2 rounded-full bg-gray-100">
        <div className="h-2 rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      {!loading && stats.total > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          Hoje: {stats.done} feita{stats.done === 1 ? '' : 's'} de {stats.total}
          {stats.awaiting > 0 && ` · ${stats.awaiting} aguardando confirmação`}
          {stats.missed > 0 && ` · ${stats.missed} falta${stats.missed === 1 ? '' : 's'}`}
        </p>
      )}
    </Card>
  );
}

function StatCard({
  title, value, icon, tone, subtitle, href,
}: {
  title: string; value: string; icon: string; tone: string; subtitle?: string; href?: string;
}) {
  const body = (
    <div className="rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">{title}</span>
        <span className={`rounded-lg px-2 py-1 text-lg leading-none ${tone}`}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
      {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Step({
  number, title, description, done, href,
}: {
  number: number; title: string; description: string; done: boolean; href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-gray-50"
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          done ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'
        }`}
      >
        {done ? '✓' : number}
      </span>
      <div className="min-w-0">
        <p className={`text-sm font-medium ${done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
          {title}
        </p>
        <p className="truncate text-xs text-gray-500">{description}</p>
      </div>
    </Link>
  );
}
