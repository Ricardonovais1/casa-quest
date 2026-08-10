'use client';

// ============================================================
// Casa Quest — Onboarding Page (Typeform-style)
// Multi-step wizard for initial family setup
// ============================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/infrastructure/supabase/client';

type Step =
  | 'welcome'
  | 'family-name'
  | 'participants'
  | 'mor-name'
  | 'guardians'
  | 'confirmation'
  | 'tolerance'
  | 'mission'
  | 'recovery'
  | 'auxilio'
  | 'escalada'
  | 'summary';

const TOTAL_STEPS = 11;

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>('welcome');
  const [familyName, setFamilyName] = useState('');
  const [participantCount, setParticipantCount] = useState(2);
  const [morName, setMorName] = useState('');
  const [guardianNames, setGuardianNames] = useState<string[]>(['']);
  const [quorumType, setQuorumType] = useState('dynamic');
  const [tolerance, setTolerance] = useState(30);
  const [missionDays, setMissionDays] = useState(15);
  const [recoveryEnabled, setRecoveryEnabled] = useState(true);
  const [auxilioEnabled, setAuxilioEnabled] = useState(true);
  const [escaladaEnabled, setEscaladaEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const steps: Step[] = [
    'welcome', 'family-name', 'participants', 'mor-name', 'guardians',
    'confirmation', 'tolerance', 'mission', 'recovery', 'auxilio', 'escalada', 'summary',
  ];
  const currentIndex = steps.indexOf(step);
  const progress = Math.round((currentIndex / (steps.length - 1)) * 100);

  async function handleFinish() {
    setLoading(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError('Sessão expirada. Faça login novamente.');
      setLoading(false);
      return;
    }

    // 1. Create family
    const { data: family, error: familyError } = await supabase
      .from('families')
      .insert({
        name: familyName,
        created_by: user.id,
        quorum_type: quorumType === 'fixed_1' || quorumType === 'fixed_2' ? 'fixed' : 'dynamic',
        quorum_small_family: 1,
        quorum_large_family: quorumType === 'fixed_2' ? 2 : 2,
        quorum_fixed: quorumType === 'fixed_1' ? 1 : quorumType === 'fixed_2' ? 2 : 1,
        tolerance_minutes: tolerance,
        recovery_enabled: recoveryEnabled,
        auxilio_enabled: auxilioEnabled,
        escalada_enabled: escaladaEnabled,
        mission_duration_days: missionDays,
      })
      .select()
      .single();

    if (familyError || !family) {
      setError('Erro ao criar família: ' + (familyError?.message || 'desconhecido'));
      setLoading(false);
      return;
    }

    // 2. Create Mor guardian
    const { error: morError } = await supabase
      .from('guardians')
      .insert({
        family_id: family.id,
        name: morName || user.user_metadata?.full_name || 'Guardião-Mor',
        is_mor: true,
        email: user.email,
        user_id: user.id,
      });

    if (morError) {
      setError('Erro ao criar guardião-mor');
      setLoading(false);
      return;
    }

    // 3. Create guardian profiles
    for (const name of guardianNames) {
      if (name.trim()) {
        await supabase.from('guardians').insert({
          family_id: family.id,
          name: name.trim(),
          is_mor: false,
        });
      }
    }

    // 4. Seed escalada categories
    const defaultCategories = [
      { family_id: family.id, name: 'Missões', base_points: 2, bonus_multiplier: 1.5, max_per_mission: 10 },
      { family_id: family.id, name: 'Gentilezas', base_points: 1, bonus_multiplier: 2.0, max_per_mission: 8 },
      { family_id: family.id, name: 'Autoaperfeiçoamento', base_points: 2, bonus_multiplier: 1.2, max_per_mission: 12 },
      { family_id: family.id, name: 'Rendimento Escolar', base_points: 3, bonus_multiplier: 1.0, max_per_mission: 15 },
    ];
    await supabase.from('escalada_categories').insert(defaultCategories);

    router.push('/dashboard');
    router.refresh();
  }

  function renderStep() {
    switch (step) {
      case 'welcome':
        return (
          <div className="text-center">
            <span className="text-6xl">🏠</span>
            <h1 className="mt-4 text-3xl font-bold text-gray-900">
              Bem-vindo ao Casa Quest!
            </h1>
            <p className="mt-2 text-gray-500">
              Vamos configurar sua família em menos de 3 minutos.
            </p>
          </div>
        );

      case 'family-name':
        return (
          <div>
            <label className="block text-lg font-semibold text-gray-900">
              Qual o nome da sua família?
            </label>
            <p className="mb-4 text-sm text-gray-500">
              Ex: &quot;Família Silva&quot;, &quot;Clã dos Santos&quot;
            </p>
            <input
              type="text"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              placeholder="Família Silva"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus
            />
          </div>
        );

      case 'participants':
        return (
          <div>
            <label className="block text-lg font-semibold text-gray-900">
              Quantas pessoas vão participar?
            </label>
            <p className="mb-4 text-sm text-gray-500">
              Contando com você (Guardião-Mor) e as crianças/adolescentes
            </p>
            <div className="flex gap-3">
              {[2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    setParticipantCount(n);
                    setGuardianNames(Array(n - 1).fill(''));
                  }}
                  className={`flex-1 rounded-xl py-4 text-center text-lg font-bold transition-colors ${
                    participantCount === n
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        );

      case 'mor-name':
        return (
          <div>
            <label className="block text-lg font-semibold text-gray-900">
              Qual o seu nome?
            </label>
            <p className="mb-4 text-sm text-gray-500">
              Você será o Guardião-Mor da família
            </p>
            <input
              type="text"
              value={morName}
              onChange={(e) => setMorName(e.target.value)}
              placeholder="Seu nome"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus
            />
          </div>
        );

      case 'guardians':
        return (
          <div>
            <label className="block text-lg font-semibold text-gray-900">
              Nomes dos Guardiões
            </label>
            <p className="mb-4 text-sm text-gray-500">
              Digite o nome de cada criança ou adolescente
            </p>
            <div className="space-y-3">
              {guardianNames.map((name, i) => (
                <input
                  key={i}
                  type="text"
                  value={name}
                  onChange={(e) => {
                    const updated = [...guardianNames];
                    updated[i] = e.target.value;
                    setGuardianNames(updated);
                  }}
                  placeholder={`Guardião ${i + 1}`}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  autoFocus={i === 0}
                />
              ))}
            </div>
          </div>
        );

      case 'confirmation':
        return (
          <div>
            <label className="block text-lg font-semibold text-gray-900">
              ⚖️ Confirmação de ações
            </label>
            <p className="mb-4 text-sm text-gray-500">
              Quantas pessoas precisam confirmar que uma ação foi feita?
            </p>
            <div className="space-y-2">
              {participantCount <= 2 ? (
                <OptionButton
                  selected={quorumType === 'fixed_1'}
                  onClick={() => setQuorumType('fixed_1')}
                  title="1 pessoa confirma"
                  subtitle="Recomendado para famílias pequenas"
                />
              ) : (
                <>
                  <OptionButton
                    selected={quorumType === 'dynamic'}
                    onClick={() => setQuorumType('dynamic')}
                    title="2 pessoas confirmam"
                    subtitle="Recomendado — equilíbrio entre confiança e verificação"
                  />
                  <OptionButton
                    selected={quorumType === 'fixed_1'}
                    onClick={() => setQuorumType('fixed_1')}
                    title="1 pessoa confirma"
                    subtitle="Mais ágil, menos verificação"
                  />
                </>
              )}
            </div>
          </div>
        );

      case 'tolerance':
        return (
          <div>
            <label className="block text-lg font-semibold text-gray-900">
              ⏰ Tolerância para atrasos
            </label>
            <p className="mb-4 text-sm text-gray-500">
              Quantos minutos de atraso são aceitos antes de virar falta?
            </p>
            <div className="flex gap-3 flex-wrap">
              {[15, 30, 60, 120].map((t) => (
                <button
                  key={t}
                  onClick={() => setTolerance(t)}
                  className={`rounded-xl px-6 py-3 text-lg font-bold transition-colors ${
                    tolerance === t
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {t < 60 ? `${t} min` : `${t / 60}h`}
                </button>
              ))}
            </div>
          </div>
        );

      case 'mission':
        return (
          <div>
            <label className="block text-lg font-semibold text-gray-900">
              📅 Duração das missões
            </label>
            <p className="mb-4 text-sm text-gray-500">
              Cada missão dura quantos dias?
            </p>
            <div className="flex gap-3">
              {[7, 15, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setMissionDays(d)}
                  className={`flex-1 rounded-xl py-4 text-center text-lg font-bold transition-colors ${
                    missionDays === d
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {d} dias
                </button>
              ))}
            </div>
          </div>
        );

      case 'recovery':
        return (
          <div>
            <label className="block text-lg font-semibold text-gray-900">
              🔄 Ações de Recuperação
            </label>
            <p className="mb-4 text-sm text-gray-500">
              Guardiões podem compensar faltas com ações extras? (+2 energia por ação)
            </p>
            <ToggleOption
              enabled={recoveryEnabled}
              setEnabled={setRecoveryEnabled}
              label="Permitir recuperação"
            />
          </div>
        );

      case 'auxilio':
        return (
          <div>
            <label className="block text-lg font-semibold text-gray-900">
              🤝 Auxílio entre Guardiões
            </label>
            <p className="mb-4 text-sm text-gray-500">
              Um Guardião pode ajudar outro que falhou? (gera cooperação)
            </p>
            <ToggleOption
              enabled={auxilioEnabled}
              setEnabled={setAuxilioEnabled}
              label="Permitir auxílio"
            />
          </div>
        );

      case 'escalada':
        return (
          <div>
            <label className="block text-lg font-semibold text-gray-900">
              ⬆️ Ações de Escalada
            </label>
            <p className="mb-4 text-sm text-gray-500">
              Guardiões podem ir além com ações extras em categorias como leitura e gentileza? (energia extra)
            </p>
            <ToggleOption
              enabled={escaladaEnabled}
              setEnabled={setEscaladaEnabled}
              label="Permitir escalada"
            />
          </div>
        );

      case 'summary':
        return (
          <div>
            <h2 className="text-xl font-bold text-gray-900">📋 Resumo da configuração</h2>
            <div className="mt-4 space-y-2 text-sm">
              <SummaryRow label="Família" value={familyName} />
              <SummaryRow label="Participantes" value={`${participantCount} pessoas`} />
              <SummaryRow label="Guardião-Mor" value={morName} />
              <SummaryRow label="Guardiões" value={guardianNames.filter(Boolean).join(', ') || 'Nenhum'} />
              <SummaryRow label="Confirmação" value={quorumType === 'dynamic' ? '2 pessoas' : '1 pessoa'} />
              <SummaryRow label="Tolerância" value={`${tolerance} min`} />
              <SummaryRow label="Missão" value={`${missionDays} dias`} />
              <SummaryRow label="Recuperação" value={recoveryEnabled ? 'Sim' : 'Não'} />
              <SummaryRow label="Auxílio" value={auxilioEnabled ? 'Sim' : 'Não'} />
              <SummaryRow label="Escalada" value={escaladaEnabled ? 'Sim' : 'Não'} />
            </div>
          </div>
        );

      default:
        return null;
    }
  }

  function canAdvance(): boolean {
    switch (step) {
      case 'family-name': return familyName.trim().length > 0;
      case 'mor-name': return morName.trim().length > 0;
      case 'guardians': return guardianNames.some((n) => n.trim().length > 0);
      default: return true;
    }
  }

  return (
    <main className="flex min-h-screen flex-col">
      {/* Progress bar */}
      <div className="h-1 bg-gray-200">
        <div
          className="h-full bg-indigo-600 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">{renderStep()}</div>
      </div>

      {/* Navigation */}
      <div className="border-t border-gray-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-md items-center justify-between">
          {step !== 'welcome' && step !== 'summary' ? (
            <button
              onClick={() => {
                const prevIndex = currentIndex - 1;
                setStep(steps[prevIndex]!);
              }}
              className="text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              ← Voltar
            </button>
          ) : (
            <div />
          )}

          {step === 'summary' ? (
            <button
              onClick={handleFinish}
              disabled={loading}
              className="rounded-xl bg-indigo-600 px-8 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Criando...' : '✨ Criar minha Casa Quest'}
            </button>
          ) : (
            <button
              onClick={() => {
                const nextIndex = currentIndex + 1;
                if (nextIndex < steps.length) {
                  setStep(steps[nextIndex]!);
                }
              }}
              disabled={!canAdvance()}
              className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              Continuar →
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="border-t border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700">
          {error}
        </div>
      )}
    </main>
  );
}

// -- Helper components --

function OptionButton({
  selected,
  onClick,
  title,
  subtitle,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl border-2 px-4 py-3 text-left transition-colors ${
        selected
          ? 'border-indigo-600 bg-indigo-50'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <span className="block text-sm font-semibold text-gray-900">{title}</span>
      <span className="block text-xs text-gray-500">{subtitle}</span>
    </button>
  );
}

function ToggleOption({
  enabled,
  setEnabled,
  label,
}: {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      onClick={() => setEnabled(!enabled)}
      className={`flex w-full items-center justify-between rounded-xl border-2 px-4 py-4 transition-colors ${
        enabled
          ? 'border-emerald-500 bg-emerald-50'
          : 'border-gray-200 bg-white'
      }`}
    >
      <span className="text-sm font-semibold text-gray-900">{label}</span>
      <span
        className={`flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled ? 'bg-emerald-500' : 'bg-gray-300'
        }`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value || '—'}</span>
    </div>
  );
}
