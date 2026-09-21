'use client';

// ============================================================
// Casa Quest — Dashboard: Família
//
// A casa inteira numa tela: o conselho (Mor + Conselheiros) e um card
// por guardião que abre com tudo o que se quer saber dele — o dia de
// hoje, a rodada da distribuição, a energia e o link de acesso.
//
// É a única porta para "Gerenciar guardiões": o menu não tem mais
// entrada própria para eles, porque quem vai cadastrar ou gerar link
// já está aqui olhando para a casa.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useFamily, type GuardianData } from '@/hooks/use-family';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader, Notice, PageSkeleton, StatusPill, inputClass } from '@/components/ui/page';
import { GenderSelect, type GenderValue } from '@/components/ui/gender-select';
import { GuardianAccessLink } from '@/components/guardians/guardian-access-link';
import { describeSchedule } from '@/lib/scheduling';
import { dayEndOf } from '@/lib/day-range';
import { extrasEnabled } from '@/lib/extra-events';
import { roleLabel, roleEmoji, roleOf, roleDescription } from '@/lib/roles';
import { formatDate, cn } from '@/lib/utils';
import type { FamilyOverview, OverviewGuardian } from '@/lib/family-overview';
import type { InviteState } from '@/lib/advisor-invite';

interface AdvisorInvite {
  id: string;
  name: string;
  email: string | null;
  inviteState: InviteState;
  invitedAt: string | null;
}

export default function FamilyPage() {
  const { family, kids, adults, me, canManage, schemaHasRoles, loading, error, reload } = useFamily();
  const [overview, setOverview] = useState<FamilyOverview | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error' | 'warning'; text: string } | null>(null);
  /**
   * O link de aceite do último convite. Aparece SEMPRE, não só quando o
   * e-mail falha: o link não queima ao ser aberto, e mandar pelo WhatsApp
   * costuma chegar antes do que a caixa de entrada.
   */
  const [inviteLink, setInviteLink] = useState<{ url: string; sent: boolean; reason: string } | null>(null);

  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [invName, setInvName] = useState('');
  const [invEmail, setInvEmail] = useState('');
  const [invGender, setInvGender] = useState<GenderValue>(null);
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  /** Estado real do convite de cada conselheiro (vem de auth.users). */
  const [inviteStates, setInviteStates] = useState<Record<string, AdvisorInvite>>({});
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  const loadInviteStates = useCallback(async () => {
    try {
      const res = await fetch('/api/families/adults', { cache: 'no-store' });
      if (!res.ok) return;
      const body = await res.json();
      const byId: Record<string, AdvisorInvite> = {};
      for (const a of (body?.data?.adults ?? []) as AdvisorInvite[]) byId[a.id] = a;
      setInviteStates(byId);
    } catch {
      // Sem isto a tela só perde o selo de "convite pendente".
    }
  }, []);

  const loadOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/families/overview', { cache: 'no-store' });
      if (!res.ok) return;
      const body = await res.json();
      setOverview(body.data as FamilyOverview);
    } catch {
      // A tela funciona sem o retrato: os cards abrem vazios.
    }
  }, []);

  useEffect(() => {
    if (!family) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial; o estado só muda depois do await
    loadOverview();
    loadInviteStates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family?.id]);

  /** O que fazer com a resposta de um convite — vale para o envio e o reenvio. */
  function applyInviteResult(data: {
    channel?: string;
    inviteUrl?: string;
    emailError?: string;
    message?: string;
  } | null) {
    const sent = data?.channel === 'sent';
    if (data?.inviteUrl) {
      setInviteLink({ url: data.inviteUrl, sent, reason: data?.emailError ?? '' });
    }
    // Quando o e-mail falha, o quadro do link já explica — um aviso acima repetiria.
    if (sent || !data?.inviteUrl) {
      setNotice({
        kind: sent ? 'success' : 'warning',
        text: data?.message || 'Convite enviado.',
      });
    }
    loadInviteStates();
    reload();
  }

  async function invite() {
    setInviting(true);
    setNotice(null);
    setInviteLink(null);
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
        applyInviteResult(body?.data ?? null);
        setInvName('');
        setInvEmail('');
        setInvGender(null);
        setShowInvite(false);
      }
    } catch {
      setNotice({ kind: 'error', text: 'Sem conexão com o servidor.' });
    }
    setInviting(false);
  }

  /**
   * Gera um convite novo e manda por e-mail — e devolve o link para o Mor
   * mandar por onde quiser. Sempre disponível: é a saída de emergência de
   * quem ficou sem conseguir entrar.
   */
  async function resendInvite(g: GuardianData) {
    setResendingId(g.id);
    setNotice(null);
    setInviteLink(null);
    try {
      const res = await fetch(`/api/families/adults/${g.id}/invite`, { method: 'POST' });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setNotice({ kind: 'error', text: body?.error?.message || 'Não foi possível reenviar o convite.' });
      } else {
        applyInviteResult(body?.data ?? null);
      }
    } catch {
      setNotice({ kind: 'error', text: 'Sem conexão com o servidor.' });
    }
    setResendingId(null);
  }

  /**
   * O link tem de ser copiado INTEIRO. Por isso há botão: selecionar à mão
   * numa caixa rolável já rendeu um link cortado no meio.
   */
  async function copyInviteLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink.url);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    } catch {
      setNotice({ kind: 'error', text: 'Não foi possível copiar. Selecione o link inteiro e copie à mão.' });
    }
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

  function refreshAll() {
    reload();
    loadOverview();
    loadInviteStates();
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

  const activeKids = kids.filter((g) => g.is_active);
  const activeAdults = adults.filter((g) => g.is_active);
  const byId = new Map((overview?.guardians ?? []).map((g) => [g.id, g]));

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

      {inviteLink && (
        <Notice kind={inviteLink.sent ? 'success' : 'warning'}>
          <p className="font-semibold">
            {inviteLink.sent ? 'Convite enviado. Este é o link dele:' : 'O e-mail de convite não saiu.'}
          </p>
          {!inviteLink.sent && inviteLink.reason && (
            <p className="mt-0.5 text-xs opacity-80">{inviteLink.reason}</p>
          )}
          <p className="mt-1 text-xs">
            Mande este link para a pessoa — ela cria a senha e já entra na família. Vale 14 dias e
            pode ser aberto quantas vezes precisar.
          </p>
          {/* break-all, não overflow: o link tem de aparecer inteiro. */}
          <code className="mt-1 block rounded bg-white/70 px-2 py-1 text-[11px] break-all">
            {inviteLink.url}
          </code>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button size="sm" variant="secondary" onClick={copyInviteLink}>
              {copiedInvite ? 'Copiado ✓' : 'Copiar link'}
            </Button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `Seu convite para o Casa Quest — abra este link para criar sua senha e entrar: ${inviteLink.url}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
            >
              Enviar por WhatsApp
            </a>
          </div>
        </Notice>
      )}

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
              A pessoa recebe um e-mail com o link, cria a senha e já entra nesta família — ela não
              cadastra casa nenhuma. O link também aparece aqui para você mandar por WhatsApp.
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
            // Pendente = tem convite em aberto. Aceitar é ter criado a senha
            // em /convite/<token>, não existir em auth.users.
            const invite = inviteStates[g.id];
            const pending =
              role === 'conselheiro' &&
              (invite ? invite.inviteState === 'pending' : !g.user_id);
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
                  <div className="flex items-center gap-1.5">
                    {/* Sempre disponível, não só quando "pendente": foi
                        justamente um estado calculado errado que deixou a
                        conselheira desta casa sem nenhuma forma de entrar. */}
                    {removingId !== g.id && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={resendingId === g.id}
                        onClick={() => resendInvite(g)}
                      >
                        {resendingId === g.id
                          ? 'Enviando…'
                          : pending
                            ? 'Reenviar convite'
                            : 'Enviar link de acesso'}
                      </Button>
                    )}
                    {removingId === g.id ? (
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
                    )}
                  </div>
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
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900">🦸 Guardiões</h2>
          <p className="text-xs text-gray-500">
            {overview?.mission
              ? `Missão ${overview.mission.name} em andamento`
              : 'Nenhuma missão em andamento'}
          </p>
        </div>

        {kids.length === 0 ? (
          <Card>
            <p className="py-2 text-sm text-gray-500">
              Nenhum guardião cadastrado.{' '}
              {canManage && (
                <Link href="/dashboard/guardioes" className="font-semibold text-indigo-600">Cadastrar</Link>
              )}
            </p>
          </Card>
        ) : (
          kids.map((g) => (
            <GuardianCard
              key={g.id}
              guardian={g}
              data={byId.get(g.id) ?? null}
              periodUntil={overview?.periodUntil ?? null}
              onChange={refreshAll}
            />
          ))
        )}
      </div>

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
          <Row label="Fim do dia" value={dayEndOf(family)} />
          <Row label="Tolerância para atrasos" value={`${family.tolerance_minutes} min`} />
          <Row label="Confirmação padrão" value={family.quorum_fixed === 0 ? 'Vale na hora' : 'Um adulto confirma'} />
          <Row label="Duração padrão da missão" value={`${family.mission_duration_days} dias`} />
          <Row label="Rodízio da distribuição" value={family.rotation_interval_months === 1 ? '1 mês' : `${family.rotation_interval_months} meses`} />
          <Row
            label="Missões extras"
            value={extrasEnabled(family) ? `Ativas (+${family.recovery_value} energia ao compensar)` : 'Inativas'}
          />
          <Row label="Auxílio" value={family.auxilio_enabled ? 'Ativo' : 'Inativo'} />
          <Row
            label="Aviso quando a energia cai"
            value={
              family.performance_alerts_enabled === false
                ? 'Desligado'
                : `Em ${family.performance_alert_threshold ?? 70}% ou menos`
            }
          />
          <Row label="Conselheiros decidem" value={family.equal_powers ? 'Sim (poderes iguais)' : 'Não'} />
          <Row label="Conselheiros veem a mesada" value={family.advisors_see_reward === false ? 'Não' : 'Sim'} />
        </div>
      </Card>
    </div>
  );
}

/**
 * Um guardião, recolhido. Fechado mostra o essencial (nome, quanto do
 * dia já foi, energia); aberto traz o dia, a rodada, a energia detalhada
 * e o link de acesso — tudo o que antes obrigava a trocar de tela.
 */
function GuardianCard({
  guardian,
  data,
  periodUntil,
  onChange,
}: {
  guardian: GuardianData;
  data: OverviewGuardian | null;
  periodUntil: string | null;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const today = data?.today;
  const scheduled = (today?.actions ?? []).filter((a) => a.status !== 'cancelled');
  const done = today?.done ?? 0;
  const pct = scheduled.length ? Math.round((done / scheduled.length) * 100) : 0;
  const energy = data?.energy ?? null;

  return (
    <Card padding="none" className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-lg">
          🦸
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-gray-900">{guardian.name}</span>
            {!guardian.is_active && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                Inativo
              </span>
            )}
            {energy && (
              <span className={cn('rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold', energy.qualitative.color)}>
                {energy.qualitative.emoji} {energy.percentage}%
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-xs text-gray-500">
            {roleLabel(guardian)}
            {guardian.age ? ` · ${guardian.age} anos` : ''}
            {scheduled.length > 0 && ` · ${done} de ${scheduled.length} feitas hoje`}
          </span>
        </span>
        <span aria-hidden className={cn('shrink-0 text-xs text-gray-400 transition-transform', open && 'rotate-180')}>
          ▼
        </span>
      </button>

      {scheduled.length > 0 && (
        <div className="mx-4 mb-3 h-1.5 rounded-full bg-gray-100">
          <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}

      {open && (
        <div className="space-y-4 border-t border-gray-100 px-4 py-4">
          {/* Hoje */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              ☀️ Atividades de hoje
            </h3>
            {!today || today.actions.length === 0 ? (
              <p className="mt-1 text-xs text-gray-400">Nada programado para hoje.</p>
            ) : (
              <ul className="mt-1 divide-y divide-gray-100">
                {today.actions.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 py-1.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="text-sm leading-none">{a.categoryEmoji}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-gray-800">{a.name}</span>
                        <span className="block text-[11px] text-gray-400">{a.whenLabel}</span>
                      </span>
                    </span>
                    <StatusPill status={a.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Distribuição */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              🤝 Distribuição do período
              {periodUntil && ` · até ${formatDate(periodUntil)}`}
            </h3>
            {!data || data.assignments.length === 0 ? (
              <p className="mt-1 text-xs text-gray-400">Nenhuma atividade da casa nesta rodada.</p>
            ) : (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {data.assignments.map((a) => (
                  <span
                    key={a.id}
                    className="rounded-full bg-gray-50 px-2 py-0.5 text-[11px] text-gray-700 ring-1 ring-gray-200"
                    title={describeSchedule(a.frequency)}
                  >
                    {a.name}
                    {a.points > 0 ? ` · +${a.points}` : ''}
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Energia */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              ⚡ Nível de energia
            </h3>
            {!energy ? (
              <p className="mt-1 text-xs text-gray-400">
                A energia só existe dentro de uma missão em andamento.
              </p>
            ) : (
              <div className="mt-1.5">
                <div className="h-2.5 rounded-full bg-gray-100">
                  <div
                    className={cn(
                      'h-2.5 rounded-full transition-all',
                      energy.percentage >= 90
                        ? 'bg-emerald-500'
                        : energy.percentage >= 70
                          ? 'bg-yellow-400'
                          : energy.percentage >= 50
                            ? 'bg-orange-400'
                            : 'bg-red-500'
                    )}
                    style={{ width: `${Math.min(100, Math.max(0, energy.percentage))}%` }}
                  />
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
                  <span className={cn('font-semibold', energy.qualitative.color)}>
                    {energy.qualitative.emoji} {energy.qualitative.label} · {energy.percentage}%
                  </span>
                  <span>🔥 {energy.streakDays} {energy.streakDays === 1 ? 'dia' : 'dias'} sem falta</span>
                  <span>✓ {energy.counts.done} feitas</span>
                  <span>✕ {energy.counts.missed} faltas</span>
                  <span>🏆 {energy.counts.recoveries} compensações</span>
                </div>
              </div>
            )}
          </section>

          {/* Link */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              🔗 Link de acesso
            </h3>
            <GuardianAccessLink guardian={guardian} onChange={onChange} variant="compact" />
          </section>
        </div>
      )}
    </Card>
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
