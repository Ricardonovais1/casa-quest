'use client';

// ============================================================
// Casa Quest — Dashboard: Configurações
// Regras da casa + conta do Guardião-Mor.
// ============================================================

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFamily, type FamilyData } from '@/hooks/use-family';
import { getSupabaseBrowserClient } from '@/infrastructure/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader, Notice, PageSkeleton, inputClass } from '@/components/ui/page';
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
  const { family, loading, error, reload } = useFamily();

  if (loading) return <PageSkeleton blocks={3} />;

  if (error || !family) {
    return (
      <div className="space-y-6">
        <PageHeader title="Configurações" />
        <Notice kind="error">{error || 'Erro ao carregar'}</Notice>
      </div>
    );
  }

  // Keyed by family id so the form re-initialises if the family ever changes,
  // which lets the fields below seed straight from props — no mirroring effect.
  return (
    <Suspense fallback={<PageSkeleton blocks={3} />}>
      <SettingsForm key={family.id} family={family} reload={reload} />
    </Suspense>
  );
}

function SettingsForm({
  family,
  reload,
}: {
  family: FamilyData;
  reload: () => void;
}) {
  const searchParams = useSearchParams();
  const cameFromReset = searchParams.get('reset') === '1';

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [name, setName] = useState(family.name);
  const [timezone, setTimezone] = useState(family.timezone || 'America/Sao_Paulo');
  const [tolerance, setTolerance] = useState(family.tolerance_minutes);
  const [confirmation, setConfirmation] = useState<0 | 1>(family.quorum_fixed === 0 ? 0 : 1);
  const [missionDays, setMissionDays] = useState(family.mission_duration_days);
  const [recoveryEnabled, setRecoveryEnabled] = useState(family.recovery_enabled);
  const [recoveryValue, setRecoveryValue] = useState(family.recovery_value);
  const [auxilioEnabled, setAuxilioEnabled] = useState(family.auxilio_enabled);
  const [escaladaEnabled, setEscaladaEnabled] = useState(family.escalada_enabled);

  // Account
  const [newPassword, setNewPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const tzOptions = TIMEZONES.some((t) => t.value === timezone)
    ? TIMEZONES
    : [{ value: timezone, label: timezone }, ...TIMEZONES];

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setSaveError(null);

    const supabase = getSupabaseBrowserClient();
    const { error: updateError } = await supabase
      .from('families')
      .update({
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
      })
      .eq('id', family.id);

    if (updateError) {
      setSaveError(updateError.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      reload();
    }
    setSaving(false);
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
    setPasswordMsg(
      pwError
        ? { kind: 'error', text: pwError.message }
        : { kind: 'success', text: 'Senha atualizada.' }
    );
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
        subtitle="As regras da sua Casa Quest. Mudanças valem a partir de agora."
        actions={
          <Button onClick={handleSave} loading={saving}>
            {saved ? '✓ Salvo!' : 'Salvar'}
          </Button>
        }
      />

      {saveError && <Notice kind="error">Erro ao salvar: {saveError}</Notice>}
      {cameFromReset && (
        <Notice kind="info">Você entrou pelo link de redefinição. Defina a nova senha no fim desta página.</Notice>
      )}

      {/* Identity */}
      <Card>
        <CardHeader>
          <CardTitle>🏠 Família</CardTitle>
          <CardDescription>Nome e fuso horário. O fuso define quando um dia começa e termina.</CardDescription>
        </CardHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-gray-500">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={cn(inputClass, 'mt-1')}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Fuso horário</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className={cn(inputClass, 'mt-1')}
            >
              {tzOptions.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
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
            { value: 1 as const, label: 'Você confirma' },
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
                <button
                  key={v}
                  onClick={() => setRecoveryValue(v)}
                  className={chip(recoveryValue === v, 'bg-orange-500')}
                >
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

function Toggle({ enabled, setEnabled }: { enabled: boolean; setEnabled: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => setEnabled(!enabled)}
      className={`flex h-7 w-12 items-center rounded-full transition-colors ${
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
