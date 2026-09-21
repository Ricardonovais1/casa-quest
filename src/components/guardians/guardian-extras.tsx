'use client';

// ============================================================
// Casa Quest — Missão extra do guardião
//
// "Fiz algo a mais": o próprio guardião escolhe na lista e registra,
// sem esperar aprovação. Cada registro devolve energia (quando há falta
// para compensar) ou soma energia extra.
//
// A lista vem pronta do servidor — só categorias de missão extra.
// Tropeço não aparece aqui: isso é dos adultos da casa.
// ============================================================

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface GuardianExtraOption {
  id: string;
  name: string;
  categoryLabel: string;
  categoryEmoji: string;
  /** Descrição curta da ação, quando o catálogo tem uma. */
  hint: string | null;
}

export function GuardianExtras({
  token,
  options,
  registeredToday,
}: {
  token: string;
  options: GuardianExtraOption[];
  /** Nomes das missões extras que este guardião já registrou hoje. */
  registeredToday: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const busy = submitting || isPending;
  const chosen = options.find((o) => o.id === selected) ?? null;

  async function register() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/g/${encodeURIComponent(token)}/extras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selected }),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setError(body?.error?.message || `Não deu para registrar agora (${res.status})`);
        return;
      }

      setSuccess(
        body?.data?.effect === 'recovery'
          ? `Boa! "${body?.data?.name}" entrou e recuperou energia. 🏆`
          : `Boa! "${body?.data?.name}" entrou e somou energia. ⬆️`
      );
      setSelected('');
      setOpen(false);
      startTransition(() => router.refresh());
    } catch {
      setError('Sem conexão. Tenta de novo daqui a pouco.');
    } finally {
      setSubmitting(false);
    }
  }

  if (options.length === 0) return null;

  return (
    <section className="rounded-2xl border border-dashed border-indigo-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-700">🏆 Fez algo a mais?</h2>
          <p className="mt-1 text-xs text-gray-500">
            Registre aqui mesmo. Missão extra recupera a energia perdida com faltas; ir além do
            combinado soma energia.
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => { setOpen(true); setSuccess(null); }}
            className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-500"
          >
            Registrar
          </button>
        )}
      </div>

      {success && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
          {success}
        </p>
      )}

      {open && (
        <div className="mt-3 space-y-2">
          <label htmlFor="extra" className="text-xs font-medium text-gray-500">
            O que você fez?
          </label>
          <select
            id="extra"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Escolha…</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.categoryEmoji} {o.name}
              </option>
            ))}
          </select>

          {chosen?.hint && <p className="text-[11px] text-gray-500">{chosen.hint}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={register}
              disabled={busy || !selected}
              className={cn(
                'flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-base font-bold text-white transition-colors hover:bg-indigo-500',
                'disabled:opacity-50'
              )}
            >
              {busy ? 'Enviando…' : 'Fiz! ✓'}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setSelected(''); setError(null); }}
              className="rounded-xl px-4 py-3 text-sm font-semibold text-gray-500 hover:bg-gray-100"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

      {registeredToday.length > 0 && (
        <p className="mt-3 border-t border-gray-100 pt-2 text-[11px] text-gray-500">
          Hoje você já registrou: {registeredToday.join(' · ')}
        </p>
      )}
    </section>
  );
}
