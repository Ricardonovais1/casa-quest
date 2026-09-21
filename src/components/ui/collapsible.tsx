'use client';

// ============================================================
// Casa Quest — UI: Collapsible
//
// O que já acabou não precisa ocupar a tela inteira: fica recolhido,
// mostrando só o título e quantos itens tem. Um clique abre.
// ============================================================

import { useId, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Collapsible({
  title,
  count,
  description,
  defaultOpen = false,
  className,
  children,
}: {
  title: ReactNode;
  /** Aparece ao lado do título; útil para "o que está escondido aqui". */
  count?: number;
  description?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className={cn('overflow-hidden rounded-xl border border-gray-200 bg-white', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-gray-900">
            {title}
            {typeof count === 'number' && (
              <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
                {count}
              </span>
            )}
          </span>
          {description && <span className="mt-0.5 block text-xs text-gray-500">{description}</span>}
        </span>
        <span
          aria-hidden
          className={cn(
            'shrink-0 text-xs text-gray-400 transition-transform',
            open && 'rotate-180'
          )}
        >
          ▼
        </span>
      </button>

      {open && (
        <div id={panelId} className="border-t border-gray-100 px-4 py-2">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Uma linha recolhível dentro de um Collapsible: fechada mostra só o
 * título e a tag; aberta mostra o detalhe.
 */
export function CollapsibleRow({
  title,
  badge,
  children,
}: {
  title: ReactNode;
  badge?: ReactNode;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const expandable = !!children;

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        type="button"
        onClick={() => expandable && setOpen((v) => !v)}
        aria-expanded={expandable ? open : undefined}
        aria-controls={expandable ? panelId : undefined}
        disabled={!expandable}
        className={cn(
          'flex w-full items-center justify-between gap-2 py-2.5 text-left',
          expandable && 'hover:opacity-80'
        )}
      >
        <span className="min-w-0 truncate text-sm text-gray-800">{title}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          {badge}
          {expandable && (
            <span aria-hidden className={cn('text-[10px] text-gray-400 transition-transform', open && 'rotate-180')}>
              ▼
            </span>
          )}
        </span>
      </button>
      {open && children && (
        <div id={panelId} className="pb-3">
          {children}
        </div>
      )}
    </div>
  );
}
