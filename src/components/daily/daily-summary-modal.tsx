'use client';

// ============================================================
// Casa Quest — Pop-up do resumo do dia anterior
//
// Abriu o app pela primeira vez hoje? A primeira coisa é como foi
// ontem: o que cada guardião cumpriu, o que ficou pelo caminho, as
// missões extras que entraram e a energia de agora.
//
// Uma vez por dia, por aparelho: a marca de "já vi" fica no
// localStorage, com a data no fuso da família. Um dia sem registro
// nenhum não vira pop-up.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useFamily } from '@/hooks/use-family';
import { Button } from '@/components/ui/button';
import { addDays, localDateString, friendlyDate } from '@/lib/day-range';
import type { DailySummary } from '@/lib/daily-summary';
import { cn } from '@/lib/utils';

const STORAGE_PREFIX = 'casaquest:daily-summary';

function seenKey(familyId: string, date: string) {
  return `${STORAGE_PREFIX}:${familyId}:${date}`;
}

/** localStorage pode estar bloqueado (aba anônima, permissões). */
function safeRead(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWrite(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Sem persistência o pop-up reaparece; melhor que quebrar a tela.
  }
}

export function DailySummaryModal() {
  const { family } = useFamily();
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [open, setOpen] = useState(false);

  const familyId = family?.id;
  const tz = family?.timezone || 'America/Sao_Paulo';

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!familyId) return;

    // O dia é o da família, não o do relógio do aparelho.
    const yesterday = addDays(localDateString(tz), -1);
    const key = seenKey(familyId, yesterday);
    if (safeRead(key)) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/daily-summary', { cache: 'no-store' });
        if (!res.ok) return;
        const body = await res.json();
        const data = body?.data as DailySummary | undefined;
        if (cancelled || !data) return;

        // Marca como visto assim que aparece: reabrir o app a cada
        // navegação não pode trazer o mesmo resumo de novo.
        safeWrite(seenKey(familyId, data.date), new Date().toISOString());
        if (!data.hasActivity) return;

        setSummary(data);
        setOpen(true);
      } catch {
        // Sem resumo, a tela segue normalmente.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [familyId, tz]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open || !summary) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-gray-900/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-summary-title"
    >
      {/* Fundo clicável fecha */}
      <button aria-label="Fechar resumo" className="absolute inset-0 cursor-default" onClick={close} />

      <div className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <header className="sticky top-0 bg-gradient-to-br from-indigo-600 to-purple-600 px-5 py-4 text-white">
          <p className="text-[11px] font-medium uppercase tracking-wide text-indigo-100">
            Como foi ontem
          </p>
          <h2 id="daily-summary-title" className="mt-0.5 text-lg font-bold">
            {friendlyDate(summary.date)}
          </h2>
          <p className="mt-0.5 text-xs text-indigo-100">
            {summary.mission ? summary.mission.name : summary.familyName}
          </p>
        </header>

        <div className="space-y-4 px-5 py-4">
          {/* Conquistas */}
          {summary.achievements.length > 0 && (
            <ul className="space-y-1.5">
              {summary.achievements.map((a) => (
                <li
                  key={a}
                  className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800"
                >
                  {a}
                </li>
              ))}
            </ul>
          )}

          {/* Totais da casa */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <Total label="Feitas" value={summary.totals.done} tone="bg-emerald-50 text-emerald-700" />
            <Total label="Faltas" value={summary.totals.missed} tone="bg-red-50 text-red-700" />
            <Total label="Extras" value={summary.totals.extras} tone="bg-indigo-50 text-indigo-700" />
          </div>

          {/* Por guardião */}
          <div className="divide-y divide-gray-100">
            {summary.guardians.map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">🦸 {g.name}</p>
                  <p className="text-[11px] text-gray-500">
                    {g.scheduled > 0 ? `${g.done} de ${g.scheduled} feitas` : 'nada programado'}
                    {g.missed > 0 && ` · ${g.missed} falta${g.missed === 1 ? '' : 's'}`}
                    {g.points !== 0 && ` · ${g.points > 0 ? '+' : '−'}${Math.abs(g.points)} pontos`}
                  </p>
                </div>
                {g.energyPercent != null && (
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2.5 py-1 text-xs font-bold',
                      g.energyPercent >= 90
                        ? 'bg-emerald-100 text-emerald-700'
                        : g.energyPercent >= 70
                          ? 'bg-yellow-100 text-yellow-700'
                          : g.energyPercent >= 50
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-red-100 text-red-700'
                    )}
                  >
                    ⚡ {g.energyPercent}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <footer className="sticky bottom-0 flex gap-2 border-t border-gray-100 bg-white px-5 py-3">
          <Link href="/dashboard/hoje" className="flex-1" onClick={close}>
            <Button className="w-full">Começar o dia de hoje</Button>
          </Link>
          <Button variant="ghost" onClick={close}>
            Fechar
          </Button>
        </footer>
      </div>
    </div>
  );
}

function Total({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={cn('rounded-xl px-2 py-2.5', tone)}>
      <p className="text-xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-[11px] font-medium opacity-80">{label}</p>
    </div>
  );
}
