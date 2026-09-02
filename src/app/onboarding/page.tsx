'use client';

// ============================================================
// Casa Quest — Onboarding Page (Typeform-style)
// Multi-step wizard for initial family setup
// ============================================================

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/infrastructure/supabase/client';
import { seedDefaultActions } from '@/lib/default-actions';
import { inputClass } from '@/components/ui/page';

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

const STEPS: Step[] = [
  'welcome', 'family-name', 'participants', 'mor-name', 'guardians',
  'confirmation', 'tolerance', 'mission', 'recovery', 'auxilio', 'escalada', 'summary',
];

export default function OnboardingPage() {
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState<Step>('welcome');
  const [familyName, setFamilyName] = useState('');
  const [participantCount, setParticipantCount] = useState(2);
  const [morName, setMorName] = useState('');
  const [guardianNames, setGuardianNames] = useState<string[]>(['']);
  const [confirmation, setConfirmation] = useState<'none' | 'one'>('one');
  const [tolerance, setTolerance] = useState(30);
  const [missionDays, setMissionDays] = useState(15);
  const [recoveryEnabled, setRecoveryEnabled] = useState(true);
  const [auxilioEnabled, setAuxilioEnabled] = useState(true);
  const [escaladaEnabled, setEscaladaEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const currentIndex = STEPS.indexOf(step);
  const progress = Math.round((currentIndex / (STEPS.length - 1)) * 100);

  // Needs a session; a user who already has a family goes to the dashboard.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login?redirect=%2Fonboarding');
        return;
      }
      const { data: mor } = await supabase
        .from('guardians')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_mor', true)
        .maybeSingle();
      if (mor) {
        router.replace('/dashboard');
        return;
      }
      const suggested = (user.user_metadata?.full_name as string | undefined)?.trim();
      if (suggested) setMorName(suggested);
      setChecking(false);
    }
    check();
  }, [router]);

  async function handleFinish() {
    setLoading(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError('Sua sessão expirou. Entre novamente para continuar.');
      setLoading(false);
      return;
    }

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';

    // 1. Create family
    const { data: family, error: familyError } = await supabase
      .from('families')
      .insert({
        name: familyName.trim(),
        created_by: user.id,
        timezone,
        quorum_type: 'fixed',
        quorum_small_family: 1,
        quorum_large_family: 1,
        quorum_fixed: confirmation === 'one' ? 1 : 0,
        tolerance_minutes: tolerance,
        recovery_enabled: recoveryEnabled,
        auxilio_enabled: auxilioEnabled,
        escalada_enabled: escaladaEnabled,
        mission_duration_days: missionDays,
      })
      .select()
      .single();

    if (familyError || !family) {
      setError('Não foi possível criar a família: ' + (familyError?.message || 'erro desconhecido'));
      setLoading(false);
      return;
    }

    // 2. Create Mor guardian
    const { error: morError } = await supabase
      .from('guardians')
      .insert({
        family_id: family.id,
        name: morName.trim() || user.user_metadata?.full_name || 'Guardião-Mor',
        is_mor: true,
        email: user.email,
        user_id: user.id,
      });

    if (morError) {
      await supabase.from('families').delete().eq('id', family.id);
      setError('Não foi possível criar o seu perfil de Guardião-Mor: ' + morError.message);
      setLoading(false);
      return;
    }

    // 3. Create guardian profiles
    const kids = guardianNames.map((n) => n.trim()).filter(Boolean);
    if (kids.length > 0) {
      await supabase.from('guardians').insert(
        kids.map((name) => ({ family_id: family.id, name, is_mor: false }))
      );
    }

    // 4. Seed escalada categories
    await supabase.from('escalada_categories').insert([
      { family_id: family.id, name: 'Missões', base_points: 2, bonus_multiplier: 1.5, max_per_mission: 10 },
      { family_id: family.id, name: 'Gentilezas', base_points: 1, bonus_multiplier: 2.0, max_per_mission: 8 },
      { family_id: family.id, name: 'Autoaperfeiçoamento', base_points: 2, bonus_multiplier: 1.2, max_per_mission: 12 },
      { family_id: family.id, name: 'Rendimento Escolar', base_points: 3, bonus_multiplier: 1.0, max_per_mission: 15 },
    ]);

    // 5. Seed the default action catalog (Hábitos, Colaboração, Tropeços, Missões…)
    await seedDefaultActions(supabase, family.id);

    router.push('/dashboard');
    router.refresh();
  }

  function renderStep() {
    switch (step) {
      case 'welcome':
        return (
          <div className="text-center">
            <span className="text-6xl">🏠</span>
            <h1 className="mt-4 text-3xl font-bold text-gray-900">Bem-vindo à Casa Quest!</h1>
            <p className="mt-2 text-gray-500">
              Vamos montar a sua casa em menos de 3 minutos. Tudo pode ser ajustado depois.
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
              Ex: &quot;Família Silva&quot;, &quot;Clã dos Santos&quot;, &quot;Casa da Vó&quot;
            </p>
            <input
              type="text"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              placeholder="Família Silva"
              className={`${inputClass} py-3 text-lg`}
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
              Contando com você (Guardião-Mor) e as crianças ou adolescentes (Guardiões)
            </p>
            <div className="flex gap-3">
              {[2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    setParticipantCount(n);
                    setGuardianNames((prev) =>
                      Array.from({ length: n - 1 }, (_, i) => prev[i] ?? '')
                    );
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
              Como a família te chama?
            </label>
            <p className="mb-4 text-sm text-gray-500">
              Você será o Guardião-Mor: configura as regras, confirma as ações e decide a mesada.
            </p>
            <input
              type="text"
              value={morName}
              onChange={(e) => setMorName(e.target.value)}
              placeholder="Seu nome"
              className={`${inputClass} py-3 text-lg`}
              autoFocus
            />
          </div>
        );

      case 'guardians':
        return (
          <div>
            <label className="block text-lg font-semibold text-gray-900">
              Quem são os Guardiões?
            </label>
            <p className="mb-4 text-sm text-gray-500">
              O nome de cada criança ou adolescente. Eles vão receber um link próprio, sem senha.
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
                  className={`${inputClass} py-3`}
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
              Quando um guardião marca &quot;Fiz!&quot;, alguém precisa confirmar?
            </p>
            <div className="space-y-2">
              <OptionButton
                selected={confirmation === 'none'}
                onClick={() => setConfirmation('none')}
                title="Sem confirmação"
                subtitle="Vale na hora. Bom para famílias que já confiam no processo."
              />
              <OptionButton
                selected={confirmation === 'one'}
                onClick={() => setConfirmation('one')}
                title="Você confirma"
                subtitle="Recomendado no começo. A ação fica “aguardando” até você validar."
              />
            </div>
            <p className="mt-3 text-xs text-gray-400">
              Isso define o padrão. Cada ação pode ter a própria regra.
            </p>
          </div>
        );

      case 'tolerance':
        return (
          <div>
            <label className="block text-lg font-semibold text-gray-900">
              ⏰ Tolerância para atrasos
            </label>
            <p className="mb-4 text-sm text-gray-500">
              Cada ação tem um horário. Quantos minutos depois dele ainda vale, antes de virar falta?
            </p>
            <div className="flex flex-wrap gap-3">
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
              Uma missão é o período de uma mesada. No fim dela, a energia de cada guardião sugere o valor.
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
              🏆 Missões extras (recuperação)
            </label>
            <p className="mb-4 text-sm text-gray-500">
              Tarefas maiores, como lavar o carro ou limpar o banheiro, que devolvem energia perdida com faltas. Sempre há um caminho de volta.
            </p>
            <ToggleOption
              enabled={recoveryEnabled}
              setEnabled={setRecoveryEnabled}
              label="Permitir missões extras"
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
              Um guardião pode fazer a tarefa de outro. Isso vale cooperação, uma medida separada da energia.
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
              ⬆️ Escalada
            </label>
            <p className="mb-4 text-sm text-gray-500">
              Ir além do combinado: gentilezas, estudo, autoaperfeiçoamento. Soma energia extra e pode passar de 100.
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
            <h2 className="text-xl font-bold text-gray-900">📋 Resumo</h2>
            <p className="mt-1 text-sm text-gray-500">
              Vamos criar a família com um catálogo de ações pronto. Você ajusta tudo no painel.
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <SummaryRow label="Família" value={familyName} />
              <SummaryRow label="Guardião-Mor" value={morName} />
              <SummaryRow label="Guardiões" value={guardianNames.filter((n) => n.trim()).join(', ') || 'Nenhum'} />
              <SummaryRow label="Confirmação" value={confirmation === 'one' ? 'Você confirma' : 'Sem confirmação'} />
              <SummaryRow label="Tolerância" value={`${tolerance} min`} />
              <SummaryRow label="Missão" value={`${missionDays} dias`} />
              <SummaryRow label="Missões extras" value={recoveryEnabled ? 'Sim' : 'Não'} />
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

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <p className="mt-3 text-sm text-gray-500">Preparando…</p>
        </div>
      </main>
    );
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
          {step !== 'welcome' ? (
            <button
              onClick={() => setStep(STEPS[currentIndex - 1]!)}
              disabled={loading}
              className="text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50"
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
              className="rounded-xl bg-indigo-600 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Criando…' : '✨ Criar a minha casa'}
            </button>
          ) : (
            <button
              onClick={() => {
                const nextIndex = currentIndex + 1;
                if (nextIndex < STEPS.length) setStep(STEPS[nextIndex]!);
              }}
              disabled={!canAdvance()}
              className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
            >
              {step === 'welcome' ? 'Começar →' : 'Continuar →'}
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
    <div className="flex justify-between gap-4 py-1">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-medium text-gray-900">{value || '—'}</span>
    </div>
  );
}
