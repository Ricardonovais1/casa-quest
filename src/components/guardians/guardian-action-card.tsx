'use client';

// ============================================================
// Casa Quest — Guardian Action Card
// O "Fiz! ✓" do guardião. Autentica pelo token da própria URL,
// já que o guardião não tem sessão.
// ============================================================

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export interface GuardianAction {
  id: string;
  status: string;
  due_at: string;
  name: string;
  category: string;
}

const STATUS_DISPLAY: Record<string, { label: string; icon: string; color: string }> = {
  pending: { label: 'Pendente', icon: '○', color: 'text-gray-400' },
  marked_done: { label: 'Aguardando confirmação', icon: '⏳', color: 'text-amber-500' },
  confirmed: { label: 'Concluída', icon: '✓', color: 'text-emerald-600' },
  missed: { label: 'Não fez', icon: '✕', color: 'text-red-500' },
  cancelled: { label: 'Cancelada', icon: '—', color: 'text-gray-400' },
};

export function GuardianActionCard({
  action,
  token,
}: {
  action: GuardianAction;
  token: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dueTimeStr = new Date(action.due_at).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const status = STATUS_DISPLAY[action.status] ?? {
    label: action.status,
    icon: '?',
    color: 'text-gray-400',
  };

  const canMark = action.status === 'pending';
  const busy = submitting || isPending;

  async function handleMarkDone() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/g/${encodeURIComponent(token)}/actions/${action.id}/mark-done`,
        { method: 'POST' }
      );
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setError(body?.error?.message || `Não foi possível marcar (${res.status})`);
        return;
      }

      // Re-render the server component so the new status comes from the source.
      startTransition(() => router.refresh());
    } catch {
      setError('Sem conexão. Tente de novo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{action.name}</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            ⏰ Até {dueTimeStr} • {action.category}
          </p>
        </div>
        <span className={`text-sm ${status.color}`}>
          {status.icon} {status.label}
        </span>
      </div>

      {canMark && (
        <button
          type="button"
          onClick={handleMarkDone}
          disabled={busy}
          className="mt-3 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-60"
        >
          {busy ? 'Enviando…' : 'Fiz! ✓'}
        </button>
      )}

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
