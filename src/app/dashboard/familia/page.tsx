'use client';

// ============================================================
// Casa Quest — Dashboard: Família
// Membros, links de acesso e as atividades de cada guardião na rodada.
// ============================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useFamily } from '@/hooks/use-family';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader, Notice, PageSkeleton } from '@/components/ui/page';
import type { AssignmentRow } from '@/lib/distribution';
import { GuardianAccessLink } from '@/components/guardians/guardian-access-link';
import { describeSchedule } from '@/lib/scheduling';
import { formatDate } from '@/lib/utils';

export default function FamilyPage() {
  const { family, guardians, loading, error, reload } = useFamily();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);

  useEffect(() => {
    if (!family) return;
    fetch('/api/families/distribution', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => body && setAssignments(body.data.assignments as AssignmentRow[]))
      .catch(() => null);
  }, [family]);

  if (loading) return <PageSkeleton blocks={2} />;

  if (error || !family) {
    return (
      <div className="space-y-6">
        <PageHeader title="Família" />
        <Notice kind="error">{error || 'Família não encontrada'}</Notice>
        <Button onClick={reload} variant="secondary">Tentar novamente</Button>
      </div>
    );
  }

  const periodUntil = assignments[0]?.valid_until;
  const kids = guardians.filter((g) => !g.is_mor);

  return (
    <div className="space-y-6">
      <PageHeader
        title={family.name}
        subtitle={`${guardians.length} membro${guardians.length !== 1 ? 's' : ''} · ${kids.filter((g) => g.is_active).length} guardiã${kids.filter((g) => g.is_active).length === 1 ? 'o' : 'es'} ativo${kids.filter((g) => g.is_active).length === 1 ? '' : 's'}`}
        actions={
          <Link href="/dashboard/guardioes">
            <Button variant="secondary">Gerenciar guardiões</Button>
          </Link>
        }
      />

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle>👨‍👩‍👧‍👦 Membros e links</CardTitle>
          <CardDescription>
            Cada guardião entra pelo próprio link, sem senha. Mande pelo WhatsApp e peça para salvar na tela inicial.
          </CardDescription>
        </CardHeader>
        <div className="divide-y divide-gray-100">
          {guardians.map((g) => {
            const mine = assignments.filter((a) => a.guardian_id === g.id);
            return (
              <div key={g.id} className="py-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-lg ${
                      g.is_mor ? 'bg-indigo-100' : 'bg-emerald-100'
                    }`}
                  >
                    {g.is_mor ? '👑' : '🦸'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {g.name}
                      {g.is_mor && (
                        <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                          Guardião-Mor
                        </span>
                      )}
                      {!g.is_active && (
                        <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                          Inativo
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {g.is_mor ? 'Configura, confirma e decide a mesada' : 'Guardião'}
                      {g.age ? ` · ${g.age} anos` : ''}
                    </p>
                  </div>
                </div>

                {!g.is_mor && <GuardianAccessLink guardian={g} onChange={reload} variant="compact" />}

                {!g.is_mor && mine.length > 0 && (
                  <div className="mt-2 rounded-lg bg-gray-50 p-2">
                    <p className="text-[11px] font-semibold text-gray-500">
                      🤝 Atividades da casa nesta rodada
                      {periodUntil && ` · até ${formatDate(periodUntil)}`}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {mine.map((a) => (
                        <span
                          key={a.id}
                          className="rounded-full bg-white px-2 py-0.5 text-[11px] text-gray-700 ring-1 ring-gray-200"
                          title={describeSchedule(a.frequency)}
                        >
                          {a.action_name}
                          {a.points > 0 ? ` · +${a.points}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Settings summary */}
      <Card>
        <CardHeader>
          <CardTitle>⚙️ Regras da casa</CardTitle>
          <CardDescription>
            Resumo do que está valendo.{' '}
            <Link href="/dashboard/config" className="font-semibold text-indigo-600">
              Alterar
            </Link>
          </CardDescription>
        </CardHeader>
        <div className="space-y-2 text-sm">
          <Row label="Fuso horário" value={family.timezone || 'America/Sao_Paulo'} />
          <Row label="Tolerância para atrasos" value={`${family.tolerance_minutes} min`} />
          <Row label="Confirmação padrão" value={family.quorum_fixed === 0 ? 'Vale na hora' : 'Guardião-Mor confirma'} />
          <Row label="Duração padrão da missão" value={`${family.mission_duration_days} dias`} />
          <Row label="Rodízio da distribuição" value={family.rotation_interval_months === 1 ? '1 mês' : `${family.rotation_interval_months} meses`} />
          <Row label="Missões extras" value={family.recovery_enabled ? `Ativas (+${family.recovery_value} energia)` : 'Inativas'} />
          <Row label="Auxílio" value={family.auxilio_enabled ? 'Ativo' : 'Inativo'} />
          <Row label="Escalada" value={family.escalada_enabled ? 'Ativa' : 'Inativa'} />
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-medium text-gray-900">{value}</span>
    </div>
  );
}
