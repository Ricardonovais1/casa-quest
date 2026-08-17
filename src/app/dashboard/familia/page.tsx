'use client';

// ============================================================
// Casa Quest — Dashboard: Family Management
// Shows members + each guardian's assigned collaborative actions.
// ============================================================

import { useEffect, useState } from 'react';
import { useFamily } from '@/hooks/use-family';
import { getSupabaseBrowserClient } from '@/infrastructure/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ensureCurrentDistribution, type AssignmentRow } from '@/lib/distribution';
import { formatDate } from '@/lib/utils';

export default function FamilyPage() {
  const { family, guardians, morGuardian, loading, error, reload } = useFamily();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);

  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    if (!family) return;
    ensureCurrentDistribution(supabase, family.id).then(({ assignments: rows }) =>
      setAssignments(rows)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="h-40 rounded-xl bg-gray-100" />
        <div className="h-40 rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (error || !family) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Família</h1>
        <Card>
          <div className="text-center py-8">
            <span className="text-4xl">⚠️</span>
            <p className="mt-2 text-sm text-red-600">{error || 'Família não encontrada'}</p>
            <Button onClick={reload} variant="secondary" className="mt-4">Tentar novamente</Button>
          </div>
        </Card>
      </div>
    );
  }

  const periodUntil = assignments[0]?.valid_until;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{family.name}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {guardians.length} membro{guardians.length !== 1 ? 's' : ''} na família
        </p>
      </div>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle>👨‍👩‍👧‍👦 Membros</CardTitle>
          <CardDescription>
            Guardião-Mor e Guardiões da família
          </CardDescription>
        </CardHeader>
        <div className="divide-y divide-gray-100">
          {guardians.map((g) => {
            const mine = assignments.filter((a) => a.guardian_id === g.id);
            return (
              <div key={g.id} className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full text-lg ${
                      g.is_mor ? 'bg-indigo-100' : 'bg-emerald-100'
                    }`}>
                      {g.is_mor ? '👑' : '🦸'}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {g.name}
                        {g.is_mor && (
                          <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                            Mor
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        {g.is_mor ? 'Guardião-Mor' : 'Guardião'}
                        {g.age ? ` • ${g.age} anos` : ''}
                        {!g.is_active && ' • Inativo'}
                      </p>
                    </div>
                  </div>
                  {!g.is_mor && g.access_token_hash && (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-medium text-emerald-700">
                      🔗 Link ativo
                    </span>
                  )}
                </div>

                {/* Assigned collaborative actions */}
                {!g.is_mor && mine.length > 0 && (
                  <div className="mt-2 rounded-lg bg-gray-50 p-2">
                    <p className="text-[11px] font-semibold text-gray-500">
                      🤝 Colaboração do mês
                      {periodUntil && ` — até ${formatDate(periodUntil)}`}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {mine.map((a) => (
                        <span
                          key={a.id}
                          className="rounded-full bg-white px-2 py-0.5 text-[11px] text-gray-700 ring-1 ring-gray-200"
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
          <CardTitle>⚙️ Configurações atuais</CardTitle>
          <CardDescription>
            Regras que definem como a Casa Quest funciona
          </CardDescription>
        </CardHeader>
        <div className="space-y-2 text-sm">
          <Row label="Tolerância para atrasos" value={`${family.tolerance_minutes} min`} />
          <Row label="Tipo de quórum" value={family.quorum_type === 'dynamic' ? 'Dinâmico' : 'Fixo'} />
          <Row label="Duração da missão" value={`${family.mission_duration_days} dias`} />
          <Row label="Rotação da distribuição" value={`${family.rotation_interval_months === 1 ? '1 mês' : `${family.rotation_interval_months} meses`}`} />
          <Row label="Recuperação" value={family.recovery_enabled ? `✅ Ativa (+${family.recovery_value})` : '❌ Inativa'} />
          <Row label="Auxílio" value={family.auxilio_enabled ? '✅ Ativo' : '❌ Inativo'} />
          <Row label="Escalada" value={family.escalada_enabled ? '✅ Ativa' : '❌ Inativa'} />
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}
