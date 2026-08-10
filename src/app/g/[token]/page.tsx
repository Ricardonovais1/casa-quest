// ============================================================
// Casa Quest — Guardian Dashboard (Token-based access)
// ============================================================

import { createServiceClient } from '@/infrastructure/supabase/server';
import { notFound } from 'next/navigation';

interface GuardianPageProps {
  params: Promise<{ token: string }>;
}

export default async function GuardianPage({ params }: GuardianPageProps) {
  const { token } = await params;

  // Hash the token to look up guardian
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const tokenHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  const supabase = await createServiceClient();

  // Find guardian by token hash
  const { data: guardian, error } = await supabase
    .from('guardians')
    .select('id, name, family_id, token_expires_at')
    .eq('access_token_hash', tokenHash)
    .eq('is_active', true)
    .single();

  if (error || !guardian) {
    notFound();
  }

  // Check token expiry
  if (guardian.token_expires_at && new Date(guardian.token_expires_at) < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <span className="text-4xl">⏰</span>
          <h1 className="mt-4 text-xl font-bold text-gray-900">Link expirado</h1>
          <p className="mt-2 text-sm text-gray-500">
            Peça ao seu Guardião-Mor para gerar um novo link de acesso.
          </p>
        </div>
      </div>
    );
  }

  // Get today's actions for this guardian
  const today = new Date().toISOString().split('T')[0]!;
  const { data: todaysActions } = await supabase
    .from('mission_actions')
    .select('id, status, due_at, confirmation_status, action_templates(name, category)')
    .eq('guardian_id', guardian.id)
    .gte('due_at', `${today}T00:00:00`)
    .lte('due_at', `${today}T23:59:59`)
    .order('due_at', { ascending: true });

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      {/* Top bar */}
      <div className="bg-white px-4 py-6 shadow-sm">
        <div className="mx-auto max-w-md">
          <h1 className="text-lg font-bold text-gray-900">
            Olá, {guardian.name}! 👋
          </h1>
          <p className="text-sm text-gray-500">Suas responsabilidades de hoje</p>
        </div>
      </div>

      {/* Energy indicator */}
      <div className="mx-auto mt-4 max-w-md px-4">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Compromisso</span>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              🟢 Compromisso Forte
            </span>
          </div>
          <div className="mt-2">
            <div className="h-2 rounded-full bg-gray-200">
              <div className="h-2 rounded-full bg-emerald-500" style={{ width: '95%' }} />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
            <span>🔥 Constância: 12 dias</span>
            <span>🤝 Cooperação: 8 pts</span>
          </div>
        </div>
      </div>

      {/* Today's actions */}
      <div className="mx-auto mt-4 max-w-md space-y-3 px-4">
        <h2 className="text-sm font-semibold text-gray-700">
          Ações de Hoje ({todaysActions?.length || 0})
        </h2>

        {todaysActions && todaysActions.length > 0 ? (
          todaysActions.map((action) => (
            <ActionCard key={action.id} action={action} guardianId={guardian.id} />
          ))
        ) : (
          <div className="rounded-xl bg-white p-8 text-center shadow-sm">
            <span className="text-4xl">🎉</span>
            <p className="mt-2 text-sm text-gray-500">
              Nenhuma ação pendente para hoje!
            </p>
          </div>
        )}
      </div>

      {/* Extra actions */}
      <div className="mx-auto mt-6 max-w-md px-4">
        <h2 className="text-sm font-semibold text-gray-700">Ações Extras</h2>
        <div className="mt-2 grid grid-cols-3 gap-3">
          <ExtraActionCard
            icon="🔄"
            label="Compensar"
            subtitle="Recuperar"
            color="border-orange-300 bg-orange-50"
            disabled={true}
          />
          <ExtraActionCard
            icon="🤝"
            label="Ajudar"
            subtitle="Auxílio"
            color="border-emerald-300 bg-emerald-50"
            disabled={true}
          />
          <ExtraActionCard
            icon="⬆️"
            label="Ir Além"
            subtitle="Escalada"
            color="border-purple-300 bg-purple-50"
            disabled={true}
          />
        </div>
      </div>

      {/* Bottom spacer for mobile nav */}
      <div className="h-20" />
    </main>
  );
}

function ActionCard({
  action,
  guardianId,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: any;
  guardianId: string;
}) {
  const dueTime = new Date(action.due_at);
  const dueTimeStr = dueTime.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const name = action.action_templates?.name || 'Ação';
  const category = action.action_templates?.category || 'habitos';

  const statusMap: Record<string, { label: string; icon: string; color: string }> = {
    pending: { label: 'Pendente', icon: '○', color: 'text-gray-400' },
    marked_done: { label: 'Aguardando confirmação', icon: '⏳', color: 'text-amber-500' },
    confirmed: { label: 'Concluída', icon: '✓', color: 'text-emerald-600' },
    missed: { label: 'Não fez', icon: '✕', color: 'text-red-500' },
    cancelled: { label: 'Cancelada', icon: '—', color: 'text-gray-400' },
  };
  const statusDisplay = statusMap[String(action.status)] || {
    label: String(action.status), icon: '?', color: 'text-gray-400',
  };

  const canMark = action.status === 'pending';

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{name}</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            ⏰ Até {dueTimeStr} • {category}
          </p>
        </div>
        <span className={`text-sm ${statusDisplay.color}`}>
          {statusDisplay.icon} {statusDisplay.label}
        </span>
      </div>

      {canMark && (
        <button className="mt-3 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors">
          Fiz! ✓
        </button>
      )}
    </div>
  );
}

function ExtraActionCard({
  icon,
  label,
  subtitle,
  color,
  disabled,
}: {
  icon: string;
  label: string;
  subtitle: string;
  color: string;
  disabled: boolean;
}) {
  return (
    <button
      disabled={disabled}
      className={`flex flex-col items-center gap-1 rounded-xl border-2 ${color} p-3 text-center transition-colors ${
        disabled ? 'opacity-50' : 'hover:shadow-sm'
      }`}
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-xs font-semibold text-gray-900">{label}</span>
      <span className="text-[10px] text-gray-500">{subtitle}</span>
    </button>
  );
}
