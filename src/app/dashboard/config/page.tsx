'use client';

// ============================================================
// Casa Quest — Dashboard: Configurações
// Regras da casa (quem gerencia), conselho (poderes iguais, mesada
// visível) e a conta de quem está logado.
// ============================================================

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFamily, type FamilyData, type GuardianData } from '@/hooks/use-family';
import { getSupabaseBrowserClient } from '@/infrastructure/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader, Notice, PageSkeleton, inputClass } from '@/components/ui/page';
import { GenderSelect, type GenderValue } from '@/components/ui/gender-select';
import { roleLabel, roleOf } from '@/lib/roles';
import { cn } from '@/lib/utils';

const TIMEZONES = [
  { value: 'America/Sao_Paulo', label: 'Brasília / São Paulo (UTC−3)' },
  { value: 'America/Fortaleza', label: 'Fortaleza / Nordeste (UTC−3)' },
  { value: 'America/Bahia', label: 'Bahia (UTC−3)' },
  { value: 'America/Belem', label: 'Belém (UTC−3)' },
  { value: 'America/Manaus', label: 'Manaus / Amazonas (UTC−4)' },
  { value: 'America/Cuiaba', label: 'Cuiabá (UTC−4)' },
  { value: 'America/Campo_Grande', label: 'Campo Grande (UTC−4)' },
  { value: 'America/Porto_Velho', label: 'Porto Velho (UTC−4)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco / Acre (UTC−5)' },
  { value: 'America/Noronha', label: 'Fernando de Noronha (UTC−2)' },
  { value: 'Europe/Lisbon', label: 'Lisboa' },
  { value: 'UTC', label: 'UTC' },
];

export default function SettingsPage() {
  const { family, me, canManage, schemaHasRoles, loading, error, reload } = useFamily();

  if (loading) return <PageSkeleton blocks={3} />;

  if (error || !family || !me) {
    return (
      <div className="space-y-6">
        <PageHeader title="Configurações" />
        <Notice kind="error">{error || 'Erro ao carregar'}</Notice>
      </div>
    );
  }

  return (
    <Suspense fallback={<PageSkeleton blocks={3} />}>
      <SettingsForm
        key={`${family.id}:${me.id}`}
        family={family}
        me={me}
        canManage={canManage}
        schemaHasRoles={schemaHasRoles}
        reload={reload}
      />
    </Suspense>
  );
}

function SettingsForm({
  family,
  me,
  canManage,
  schemaHasRoles,
  reload,
}: {
  family: FamilyData;
  me: GuardianData;
  canManage: boolean;
  schemaHasRoles: boolean;
  reload: () => void;
}) {
  const searchParams = useSearchParams();
  const cameFromReset = searchParams.get('reset') === '1';

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Family rules
  const [name, setName] = useState(family.name);
  const [timezone, setTimezone] = useState(family.timezone || 'America/Sao_Paulo');
  const [tolerance, setTolerance] = useState(family.tolerance_minutes);
  const [confirmation, setConfirmation] = useState<0 | 1>(family.quorum_fixed === 0 ? 0 : 1);
  const [missionDays, setMissionDays] = useState(family.mission_duration_days);
  const [recoveryEnabled, setRecoveryEnabled] = useState(family.recovery_enabled);
  const [recoveryValue, setRecoveryValue] = useState(family.recovery_value);
  const [auxilioEnabled, setAuxilioEnabled] = useState(family.auxilio_enabled);
  const [escaladaEnabled, setEscaladaEnabled] = useState(family.escalada_enabled);
  const [equalPowers, setEqualPowers] = useState(!!family.equal_powers);
  const [advisorsSeeReward, setAdvisorsSeeReward] = useState(family.advisors_see_reward !== false);

  // Me
  const [myName, setMyName] = useState(me.name);
  const [myGender, setMyGender] = useState<GenderValue>(me.gender ?? null);
  const [meBusy, setMeBusy] = useState(false);
  const [meMsg, setMeMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  // Account
  const [newPassword, setNewPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const tzOptions = TIMEZONES.some((t) => t.value === timezone)
    ? TIMEZONES
    : [{ value: timezone, label: timezone }, ...TIMEZONES];

  const role = roleOf(me);
  const myLabels = role === 'mor' ? { f: 'Guardiã-Mor', m: 'Guardião-Mor' } : { f: 'Conselheira', m: 'Conselheiro' };

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setSaveError(null);

    const supabase = getSupabaseBrowserClient();
    const payload: Record<string, unknown> = {
      name: name.trim() || family.name,
      timezone,
      tolerance_minutes: tolerance,
      quorum_type: 'fixed',
      quorum_fixed: confirmation,
      mission_duration_days: missionDays,
      recovery_enabled: recoveryEnabled,
      recovery_value: recoveryValue,
      auxilio_enabled: auxilioEnabled,
      escalada_enabled: escaladaEnabled,
    };
    if (schemaHasRoles) {
      payload.equal_powers = equalPowers;
      payload.advisors_see_reward = advisorsSeeReward;
    }

    const { error: updateError } = await supabase.from('families').update(payload).eq('id', family.id);

    if (updateError) {
      setSaveError(updateError.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      reload();
    }
    setSaving(false);
  }

  async function handleSaveMe() {
    setMeBusy(true);
    setMeMsg(null);
    const supabase = getSupabaseBrowserClient();
    const payload: Record<string, unknown> = { name: myName.trim() || me.name };
    if (schemaHasRoles) payload.gender = myGender;
    const { error: meError } = await supabase.from('guardians').update(payload).eq('id', me.id);
    setMeMsg(meError ? { kind: 'error', text: meError.message } : { kind: 'success', text: 'Salvo.' });
    if (!meError) reload();
    setMeBusy(false);
  }

  async function handlePassword() {
    if (newPassword.length < 6) {
      setPasswordMsg({ kind: 'error', text: 'A senha precisa ter pelo menos 6 caracteres.' });
      return;
    }
    setPasswordBusy(true);
    setPasswordMsg(null);
    const supabase = getSupabaseBrowserClient();
    const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordMsg(pwError ? { kind: 'error', text: pwError.message } : { kind: 'success', text: 'Senha atualizada.' });
    if (!pwError) setNewPassword('');
    setPasswordBusy(false);
  }

  const chip = (active: boolean, color = 'bg-indigo-600') =>
    cn(
      'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
      active ? `${color} text-white` : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        subtitle={canManage ? 'As regras da sua Casa Quest. Mudanças valem a partir de agora.' : 'Sua conta e como te chamamos.'}
        actions={
          canManage ? (
            <Button onClick={handleSave} loading={saving}>
              {saved ? '✓ Salvo!' : 'Salvar regras'}
            </Button>
          ) : undefined
        }
      />

      {saveError && <Notice kind="error">Erro ao salvar: {saveError}</Notice>}
      {cameFromReset && (
        <Notice kind="info">Você entrou pelo link de redefinição. Defina a nova senha no fim desta página.</Notice>
      )}
      {!canManage && (
        <Notice kind="info">
          As regras da casa (tolerância, missões, mesada) são definidas pelo Guardião-Mor. Se a família ligar
          &quot;poderes iguais&quot;, você também poderá alterá-las.
        </Notice>
      )}

      {canManage && (
        <>
          {/* Identity */}
          <Card>
            <CardHeader>
              <CardTitle>🏠 Família</CardTitle>
              <CardDescription>Nome e fuso horário. O fuso define quando um dia começa e termina.</CardDescription>
            </CardHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-gray-500">Nome</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={cn(inputClass, 'mt-1')} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Fuso horário</label>
                <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={cn(inputClass, 'mt-1')}>
                  {tzOptions.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {/* Council */}
          <Card>
            <CardHeader>
              <CardTitle>🧭 Conselho da casa</CardTitle>
              <CardDescription>
                Conselheiros confirmam ações, registram tropeços e extras e acompanham a energia. Convide em Família.
              </CardDescription>
            </CardHeader>
            {!schemaHasRoles && (
              <Notice kind="warning" className="mb-3">
                Estas opções ficam ativas depois de aplicar a migração 00008 (papéis) no Supabase.
              </Notice>
            )}
            <div className="space-y-3">
              <ToggleRow
                enabled={equalPowers}
                setEnabled={setEqualPowers}
                disabled={!schemaHasRoles}
                title="Poderes iguais"
                text="Conselheiros também decidem regras, missões e mesada, como o Guardião-Mor."
              />
              <ToggleRow
                enabled={advisorsSeeReward}
                setEnabled={setAdvisorsSeeReward}
                disabled={!schemaHasRoles}
                title="Conselheiros veem a mesada"
                text="Desligado, eles veem a energia dos guardiões mas não os valores em dinheiro."
              />
            </div>
          </Card>

          {/* Tolerance */}
          <Card>
            <CardHeader>
              <CardTitle>⏰ Tolerância para atrasos</CardTitle>
              <CardDescription>
                Cada ação tem um horário. Quantos minutos depois dele ainda vale, antes de virar falta?
              </CardDescription>
            </CardHeader>
            <div className="flex flex-wrap gap-2">
              {[15, 30, 60, 120].map((t) => (
                <button key={t} onClick={() => setTolerance(t)} className={chip(tolerance === t)}>
                  {t < 60 ? `${t} min` : `${t / 60}h`}
                </button>
              ))}
            </div>
          </Card>

          {/* Quorum */}
          <Card>
            <CardHeader>
              <CardTitle>⚖️ Confirmação de ações</CardTitle>
              <CardDescription>
                Padrão para novas ações. Cada ação pode ter a própria regra em &quot;Ações&quot;.
              </CardDescription>
            </CardHeader>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 0 as const, label: 'Vale na hora' },
                { value: 1 as const, label: 'Um adulto confirma' },
              ].map((opt) => (
                <button key={opt.value} onClick={() => setConfirmation(opt.value)} className={chip(confirmation === opt.value)}>
                  {opt.label}
                </button>
              ))}
            </div>
          </Card>

          {/* Mission Duration */}
          <Card>
            <CardHeader>
              <CardTitle>📅 Duração padrão das missões</CardTitle>
              <CardDescription>Sugerida ao criar uma missão nova.</CardDescription>
            </CardHeader>
            <div className="flex flex-wrap gap-2">
              {[7, 15, 30].map((d) => (
                <button key={d} onClick={() => setMissionDays(d)} className={chip(missionDays === d)}>
                  {d} dias
                </button>
              ))}
            </div>
          </Card>

          {/* Recovery */}
          <Card>
            <CardHeader>
              <CardTitle>🏆 Missões extras (recuperação)</CardTitle>
              <CardDescription>Tarefas maiores que devolvem energia perdida com faltas.</CardDescription>
            </CardHeader>
            <div className="flex flex-wrap items-center gap-4">
              <Toggle enabled={recoveryEnabled} setEnabled={setRecoveryEnabled} />
              {recoveryEnabled && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-gray-500">Energia devolvida por missão extra:</span>
                  {[1, 2, 3, 5].map((v) => (
                    <button key={v} onClick={() => setRecoveryValue(v)} className={chip(recoveryValue === v, 'bg-orange-500')}>
                      +{v}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Auxilio */}
          <Card>
            <CardHeader>
              <CardTitle>🤝 Auxílio</CardTitle>
              <CardDescription>Um guardião pode fazer a tarefa de outro. Conta como cooperação.</CardDescription>
            </CardHeader>
            <Toggle enabled={auxilioEnabled} setEnabled={setAuxilioEnabled} />
          </Card>

          {/* Escalada */}
          <Card>
            <CardHeader>
              <CardTitle>⬆️ Escalada</CardTitle>
              <CardDescription>Gentilezas, estudo e ir além. Energia extra, pode passar de 100.</CardDescription>
            </CardHeader>
            <Toggle enabled={escaladaEnabled} setEnabled={setEscaladaEnabled} />
          </Card>
        </>
      )}

      {/* Me */}
      <Card>
        <CardHeader>
          <CardTitle>🙋 Você na casa</CardTitle>
          <CardDescription>Nome e como te chamamos nos rótulos. Hoje: {roleLabel(me)}.</CardDescription>
        </CardHeader>
        {meMsg && <Notice kind={meMsg.kind} className="mb-3">{meMsg.text}</Notice>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-gray-500">Nome</label>
            <input type="text" value={myName} onChange={(e) => setMyName(e.target.value)} className={cn(inputClass, 'mt-1')} />
          </div>
          {schemaHasRoles && (
            <div>
              <label className="text-xs font-medium text-gray-500">Como chamar</label>
              <GenderSelect value={myGender} onChange={setMyGender} labels={myLabels} className="mt-1" />
            </div>
          )}
        </div>
        <div className="mt-3">
          <Button size="sm" variant="secondary" onClick={handleSaveMe} loading={meBusy}>
            Salvar
          </Button>
        </div>
      </Card>

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle>🔐 Sua conta</CardTitle>
          <CardDescription>Trocar a senha de acesso ao painel.</CardDescription>
        </CardHeader>
        {passwordMsg && <Notice kind={passwordMsg.kind} className="mb-3">{passwordMsg.text}</Notice>}
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <label className="text-xs font-medium text-gray-500">Nova senha</label>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className={cn(inputClass, 'mt-1')}
            />
          </div>
          <Button variant="secondary" onClick={handlePassword} loading={passwordBusy} disabled={!newPassword}>
            Atualizar senha
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ToggleRow({
  enabled,
  setEnabled,
  disabled,
  title,
  text,
}: {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  disabled?: boolean;
  title: string;
  text: string;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-4 rounded-lg bg-gray-50 px-3 py-2.5', disabled && 'opacity-60')}>
      <div>
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="text-xs text-gray-500">{text}</p>
      </div>
      <Toggle enabled={enabled} setEnabled={disabled ? () => undefined : setEnabled} />
    </div>
  );
}

function Toggle({ enabled, setEnabled }: { enabled: boolean; setEnabled: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => setEnabled(!enabled)}
      className={`flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
        enabled ? 'bg-emerald-500' : 'bg-gray-300'
      }`}
    >
      <span
        className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
