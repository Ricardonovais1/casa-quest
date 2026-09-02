'use client';

// ============================================================
// Casa Quest — Dashboard: Família
// Adultos da casa (Mor + Conselheiros), guardiões com links de acesso
// e as atividades de cada guardião na rodada.
// ============================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useFamily, type GuardianData } from '@/hooks/use-family';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader, Notice, PageSkeleton, inputClass } from '@/components/ui/page';
import { GenderSelect, type GenderValue } from '@/components/ui/gender-select';
import type { AssignmentRow } from '@/lib/distribution';
import { GuardianAccessLink } from '@/components/guardians/guardian-access-link';
import { describeSchedule } from '@/lib/scheduling';
import { roleLabel, roleEmoji, roleOf, roleDescription } from '@/lib/roles';
import { formatDate, cn } from '@/lib/utils';

export default function FamilyPage() {
  const { family, kids, adults, me, canManage, schemaHasRoles, loading, error, reload } = useFamily();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [invName, setInvName] = useState('');
  const [invEmail, setInvEmail] = useState('');
  const [invGender, setInvGender] = useState<GenderValue>(null);
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!family) return;
    fetch('/api/families/distribution', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => body && setAssignments(body.data.assignments as AssignmentRow[]))
      .catch(() => null);
  }, [family]);

  async function invite() {
    setInviting(true);
    setNotice(null);
    try {
      const res = await fetch('/api/families/adults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: invName, email: invEmail, gender: invGender }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setNotice({ kind: 'error', text: body?.error?.message || 'Não foi possível convidar.' });
      } else {
        setNotice({ kind: 'success', text: body?.data?.message || 'Convite enviado.' });
        setInvName('');
        setInvEmail('');
        setInvGender(null);
        setShowInvite(false);
        reload();
      }
    } catch {
      setNotice({ kind: 'error', text: 'Sem conexão com o servidor.' });
    }
    setInviting(false);
  }

  async function removeAdult(g: GuardianData) {
    setNotice(null);
    const res = await fetch(`/api/families/adults/${g.id}`, { method: 'DELETE' });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setNotice({ kind: 'error', text: body?.error?.message || 'Não foi possível remover.' });
    } else {
      setNotice({ kind: 'success', text: `${g.name} saiu do conselho da casa.` });
      reload();
    }
    setRemovingId(null);
  }

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
  const activeKids = kids.filter((g) => g.is_active);
  const activeAdults = adults.filter((g) => g.is_active);

  return (
    <div className="space-y-6">
      <PageHeader
        title={family.name}
        subtitle={`${activeAdults.length} adulto${activeAdults.length === 1 ? '' : 's'} · ${activeKids.length} guardiã${activeKids.length === 1 ? 'o' : 'es'}`}
        actions={
          canManage ? (
            <Link href="/dashboard/guardioes">
              <Button variant="secondary">Gerenciar guardiões</Button>
            </Link>
          ) : undefined
        }
      />

      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

      {/* Adults */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>🧭 Conselho da casa</CardTitle>
              <CardDescription>
                O Guardião-Mor decide regras e mesada. Conselheiros confirmam ações, registram tropeços e extras e acompanham a energia.
              </CardDescription>
            </div>
            {canManage && !showInvite && (
              <Button size="sm" variant="secondary" onClick={() => setShowInvite(true)}>
                + Convidar adulto
              </Button>
            )}
          </div>
        </CardHeader>

        {showInvite && (
          <div className="mb-4 space-y-3 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
            {!schemaHasRoles && (
              <Notice kind="warning">
                Para convidar adultos é preciso aplicar a migração 00008 (papéis) no Supabase.
              </Notice>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-gray-500">Nome</label>
                <input
                  type="text"
                  value={invName}
                  onChange={(e) => setInvName(e.target.value)}
                  placeholder="Como a família chama"
                  className={cn(inputClass, 'mt-1')}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">E-mail</label>
                <input
                  type="email"
                  value={invEmail}
                  onChange={(e) => setInvEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className={cn(inputClass, 'mt-1')}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Como chamar</label>
              <GenderSelect
                value={invGender}
                onChange={setInvGender}
                labels={{ f: 'Conselheira', m: 'Conselheiro' }}
                className="mt-1"
              />
            </div>
            <p className="text-[11px] text-gray-500">
              A pessoa recebe um e-mail para definir a senha. Se já tiver conta no Casa Quest, entra na família na hora.
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={invite} loading={inviting} disabled={!invName.trim() || !invEmail.trim()}>
                Enviar convite
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowInvite(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        <div className="divide-y divide-gray-100">
          {activeAdults.map((g) => {
            const role = roleOf(g);
            const pending = role === 'conselheiro' && !g.user_id;
            return (
              <div key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="flex items-center gap-3">
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-full text-lg', role === 'mor' ? 'bg-indigo-100' : 'bg-sky-100')}>
                    {roleEmoji(role)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {g.name}
                      {me?.id === g.id && <span className="ml-2 text-[10px] font-medium text-gray-400">você</span>}
                      {pending && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                          convite pendente
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {roleLabel(g)} · {roleDescription(role)}
                    </p>
                  </div>
                </div>
                {canManage && role === 'conselheiro' && (
                  removingId === g.id ? (
                    <span className="flex items-center gap-1.5 text-xs">
                      <Button size="sm" variant="danger" onClick={() => removeAdult(g)}>Remover</Button>
                      <Button size="sm" variant="ghost" onClick={() => setRemovingId(null)}>Voltar</Button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRemovingId(g.id)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
                    >
                      Remover
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>

        {family.equal_powers && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            Poderes iguais ligados: conselheiros também decidem regras, missões e mesada.
          </p>
        )}
      </Card>

      {/* Kids */}
      <Card>
        <CardHeader>
          <CardTitle>🦸 Guardiões e links</CardTitle>
          <CardDescription>
            Cada guardião entra pelo próprio link, sem senha. Mande pelo WhatsApp e peça para salvar na tela inicial.
          </CardDescription>
        </CardHeader>
        {kids.length === 0 ? (
          <p className="py-2 text-sm text-gray-500">
            Nenhum guardião cadastrado.{' '}
            {canManage && (
              <Link href="/dashboard/guardioes" className="font-semibold text-indigo-600">Cadastrar</Link>
            )}
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {kids.map((g) => {
              const mine = assignments.filter((a) => a.guardian_id === g.id);
              return (
                <div key={g.id} className="py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-lg">🦸</div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {g.name}
                        {!g.is_active && (
                          <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                            Inativo
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        {roleLabel(g)}
                        {g.age ? ` · ${g.age} anos` : ''}
                      </p>
                    </div>
                  </div>

                  <GuardianAccessLink guardian={g} onChange={reload} variant="compact" />

                  {mine.length > 0 && (
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
        )}
      </Card>

      {/* Settings summary */}
      <Card>
        <CardHeader>
          <CardTitle>⚙️ Regras da casa</CardTitle>
          <CardDescription>
            Resumo do que está valendo.{' '}
            {canManage && (
              <Link href="/dashboard/config" className="font-semibold text-indigo-600">Alterar</Link>
            )}
          </CardDescription>
        </CardHeader>
        <div className="space-y-2 text-sm">
          <Row label="Fuso horário" value={family.timezone || 'America/Sao_Paulo'} />
          <Row label="Tolerância para atrasos" value={`${family.tolerance_minutes} min`} />
          <Row label="Confirmação padrão" value={family.quorum_fixed === 0 ? 'Vale na hora' : 'Um adulto confirma'} />
          <Row label="Duração padrão da missão" value={`${family.mission_duration_days} dias`} />
          <Row label="Rodízio da distribuição" value={family.rotation_interval_months === 1 ? '1 mês' : `${family.rotation_interval_months} meses`} />
          <Row label="Missões extras" value={family.recovery_enabled ? `Ativas (+${family.recovery_value} energia)` : 'Inativas'} />
          <Row label="Auxílio" value={family.auxilio_enabled ? 'Ativo' : 'Inativo'} />
          <Row label="Escalada" value={family.escalada_enabled ? 'Ativa' : 'Inativa'} />
          <Row label="Conselheiros decidem" value={family.equal_powers ? 'Sim (poderes iguais)' : 'Não'} />
          <Row label="Conselheiros veem a mesada" value={family.advisors_see_reward === false ? 'Não' : 'Sim'} />
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
