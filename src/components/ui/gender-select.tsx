'use client';

// ============================================================
// Casa Quest — UI: seletor de gênero (só para flexionar rótulos)
// ============================================================

import { cn } from '@/lib/utils';

export type GenderValue = 'm' | 'f' | null;

export function GenderSelect({
  value,
  onChange,
  labels,
  className,
  allowUnset = true,
}: {
  value: GenderValue;
  onChange: (v: GenderValue) => void;
  /** e.g. { m: 'Guardião', f: 'Guardiã' } */
  labels: { m: string; f: string };
  className?: string;
  /**
   * Oferece "Prefiro não dizer". No próprio perfil ("Você na casa") a
   * escolha é entre os dois rótulos: o app já sabe o papel, falta só
   * saber como flexionar o nome dele.
   */
  allowUnset?: boolean;
}) {
  const options: { value: GenderValue; label: string }[] = [
    { value: 'f', label: labels.f },
    { value: 'm', label: labels.m },
    ...(allowUnset ? [{ value: null, label: 'Prefiro não dizer' }] : []),
  ];
  return (
    <div
      className={cn(
        'grid gap-1 rounded-lg bg-gray-100 p-1',
        allowUnset ? 'grid-cols-3' : 'grid-cols-2',
        className
      )}
    >
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md px-2 py-1.5 text-xs font-semibold transition-colors',
            value === o.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
