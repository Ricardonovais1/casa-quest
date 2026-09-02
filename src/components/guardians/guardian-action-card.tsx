'use client';

// ============================================================
// Casa Quest — Guardian Action Card
// O "Fiz! ✓" do guardião. Autentica pelo token da própria URL,
// já que o guardião não tem sessão.
// ============================================================

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface GuardianAction {
  id: string;
  status: string;
  name: string;
  categoryLabel: string;
  categoryEmoji: string;
  /** "20:00" in the family's timezone */
  dueLabel: string;
  /** "20:30" — last moment before it counts as a miss */
  deadlineLabel: string;
  /** Past the due time, still inside the tolerance window */
  isLate: boolean;
  /** Past the tolerance window (waiting for the sweep) */
  isOverdue: boolean;
  /** "19:42" when confirmed, otherwise null */
  completedLabel: string | null;
  isExtra: boolean;
}

export function GuardianActionCard({
  action,
  token,
  needsConfirmation,
}: {
  action: GuardianAction;
  token: string;
  needsConfirmation: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justMarked, setJustMarked] = useState<'confirmed' | 'marked_done' | null>(null);

  const canMark = action.status === 'pending';
  const busy = submitting || isPending;
  const status = justMarked ?? action.status;

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
        setError(body?.error?.message || `Não deu para marcar agora (${res.status})`);
        return;
      }

      setJustMarked(body?.data?.status === 'confirmed' ? 'confirmed' : 'marked_done');
      // Re-render the server component so the new status comes from the source.
      startTransition(() => router.refresh());
    } catch {
      setError('Sem conexão. Tenta de novo daqui a pouco.');
    } finally {
      setSubmitting(false);
    }
  }

  const done = status === 'confirmed';
  const waiting = status === 'marked_done';
  const missed = status === 'missed';

  return (
    <div
      className={cn(
        'rounded-2xl border bg-white p-4 shadow-sm transition-colors',
        done && 'border-emerald-200 bg-emerald-50/50',
        waiting && 'border-amber-200 bg-amber-50/40',
        missed && 'border-gray-200 bg-gray-50',
        !done && !waiting && !missed && 'border-gray-200'
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-2xl leading-none">{action.categoryEmoji}</span>
        <div className="min-w-0 flex-1">
          <h3
            className={cn(
              'text-base font-semibold leading-snug',
              missed ? 'text-gray-500 line-through decoration-gray-300' : 'text-gray-900'
            )}
          >
            {action.name}
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">
            {action.isExtra
              ? action.categoryLabel
              : action.isLate && canMark
                ? `⏰ Passou das ${action.dueLabel} — ainda vale até ${action.deadlineLabel}`
                : action.isOverdue && canMark
                  ? `⏰ Passou das ${action.deadlineLabel}`
                  : `até ${action.dueLabel}`}
          </p>
        </div>

        {done && (
          <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
            ✓ Feita{action.completedLabel ? ` ${action.completedLabel}` : ''}
          </span>
        )}
        {waiting && (
          <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
            ⏳ Esperando
          </span>
        )}
        {missed && (
          <span className="shrink-0 rounded-full bg-gray-200 px-2.5 py-1 text-xs font-bold text-gray-600">
            ✕ Não feita
          </span>
        )}
      </div>

      {waiting && (
        <p className="mt-2 text-xs text-amber-700">
          Você marcou como feita. Falta um adulto da casa confirmar.
        </p>
      )}

      {canMark && !justMarked && (
        <button
          type="button"
          onClick={handleMarkDone}
          disabled={busy}
          className="mt-3 w-full rounded-xl bg-indigo-600 px-4 py-3 text-base font-bold text-white shadow-sm transition-colors hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-60"
        >
          {busy ? 'Enviando…' : needsConfirmation ? 'Fiz! ✓' : 'Fiz! ✓'}
        </button>
      )}

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
