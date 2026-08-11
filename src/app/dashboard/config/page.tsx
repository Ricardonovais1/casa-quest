'use client';

// ============================================================
// Casa Quest — Dashboard: Settings (editable)
// ============================================================

import { useState, useEffect } from 'react';
import { useFamily } from '@/hooks/use-family';
import { getSupabaseBrowserClient } from '@/infrastructure/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function SettingsPage() {
  const { family, loading, error, reload } = useFamily();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Local state for editable fields
  const [tolerance, setTolerance] = useState(30);
  const [quorumType, setQuorumType] = useState('dynamic');
  const [missionDays, setMissionDays] = useState(15);
  const [recoveryEnabled, setRecoveryEnabled] = useState(true);
  const [recoveryValue, setRecoveryValue] = useState(2);
  const [auxilioEnabled, setAuxilioEnabled] = useState(true);
  const [escaladaEnabled, setEscaladaEnabled] = useState(false);

  // Init from loaded family
  useEffect(() => {
    if (family) {
      setTolerance(family.tolerance_minutes);
      setQuorumType(family.quorum_type);
      setMissionDays(family.mission_duration_days);
      setRecoveryEnabled(family.recovery_enabled);
      setRecoveryValue(family.recovery_value);
      setAuxilioEnabled(family.auxilio_enabled);
      setEscaladaEnabled(family.escalada_enabled);
    }
  }, [family]);

  async function handleSave() {
    if (!family) return;
    setSaving(true);
    setSaved(false);

    const supabase = getSupabaseBrowserClient();
    const { error: updateError } = await supabase
      .from('families')
      .update({
        tolerance_minutes: tolerance,
        quorum_type: quorumType,
        mission_duration_days: missionDays,
        recovery_enabled: recoveryEnabled,
        recovery_value: recoveryValue,
        auxilio_enabled: auxilioEnabled,
        escalada_enabled: escaladaEnabled,
      })
      .eq('id', family.id);

    if (updateError) {
      alert('Erro ao salvar: ' + updateError.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      reload();
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="h-40 rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (error || !family) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-sm text-red-500">{error || 'Erro ao carregar'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
          <p className="mt-1 text-sm text-gray-500">Ajuste as regras da sua Casa Quest</p>
        </div>
        <Button onClick={handleSave} loading={saving}>
          {saved ? '✓ Salvo!' : 'Salvar'}
        </Button>
      </div>

      {/* Tolerance */}
      <Card>
        <CardHeader>
          <CardTitle>⏰ Tolerância para atrasos</CardTitle>
          <CardDescription>
            Quantos minutos de atraso são aceitos antes de virar falta?
          </CardDescription>
        </CardHeader>
        <div className="flex gap-2">
          {[15, 30, 60, 120].map((t) => (
            <button
              key={t}
              onClick={() => setTolerance(t)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                tolerance === t
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t < 60 ? `${t} min` : `${t / 60}h`}
            </button>
          ))}
        </div>
      </Card>

      {/* Quorum */}
      <Card>
        <CardHeader>
          <CardTitle>⚖️ Confirmação de ações</CardTitle>
          <CardDescription>Quantas pessoas precisam confirmar uma ação?</CardDescription>
        </CardHeader>
        <div className="flex gap-2">
          {[
            { value: 'dynamic', label: 'Dinâmico (1-2)' },
            { value: 'fixed_1', label: '1 pessoa' },
            { value: 'fixed_2', label: '2 pessoas' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setQuorumType(opt.value === 'dynamic' ? 'dynamic' : 'fixed')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                (opt.value === 'dynamic' ? quorumType === 'dynamic' : quorumType === 'fixed')
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Mission Duration */}
      <Card>
        <CardHeader>
          <CardTitle>📅 Duração das missões</CardTitle>
          <CardDescription>Cada missão dura quantos dias?</CardDescription>
        </CardHeader>
        <div className="flex gap-2">
          {[7, 15, 30].map((d) => (
            <button
              key={d}
              onClick={() => setMissionDays(d)}
              className={`rounded-lg px-6 py-2 text-sm font-semibold transition-colors ${
                missionDays === d
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {d} dias
            </button>
          ))}
        </div>
      </Card>

      {/* Recovery */}
      <Card>
        <CardHeader>
          <CardTitle>🔄 Recuperação</CardTitle>
          <CardDescription>Guardiões podem compensar faltas?</CardDescription>
        </CardHeader>
        <div className="flex items-center gap-4">
          <Toggle enabled={recoveryEnabled} setEnabled={setRecoveryEnabled} />
          {recoveryEnabled && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Valor:</span>
              {[1, 2, 3, 5].map((v) => (
                <button
                  key={v}
                  onClick={() => setRecoveryValue(v)}
                  className={`rounded-lg px-3 py-1 text-sm font-semibold ${
                    recoveryValue === v
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
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
          <CardDescription>Guardiões podem ajudar outros que falharam?</CardDescription>
        </CardHeader>
        <Toggle enabled={auxilioEnabled} setEnabled={setAuxilioEnabled} />
      </Card>

      {/* Escalada */}
      <Card>
        <CardHeader>
          <CardTitle>⬆️ Escalada</CardTitle>
          <CardDescription>Ações extras em categorias especiais (leitura, gentileza, etc.)</CardDescription>
        </CardHeader>
        <Toggle enabled={escaladaEnabled} setEnabled={setEscaladaEnabled} />
      </Card>
    </div>
  );
}

function Toggle({ enabled, setEnabled }: { enabled: boolean; setEnabled: (v: boolean) => void }) {
  return (
    <button
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
