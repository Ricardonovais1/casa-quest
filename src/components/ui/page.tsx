// ============================================================
// Casa Quest — UI: page-level building blocks
// PageHeader · EmptyState · Notice · StatusPill · Skeleton
// ============================================================

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
      <span className="text-4xl">{icon}</span>
      <p className="mt-3 text-sm font-semibold text-gray-800">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-xs text-gray-500">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

const noticeStyles = {
  info: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  error: 'border-red-200 bg-red-50 text-red-700',
} as const;

export function Notice({
  kind = 'info',
  children,
  className,
}: {
  kind?: keyof typeof noticeStyles;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border px-3 py-2 text-sm', noticeStyles[kind], className)}>
      {children}
    </div>
  );
}

export const ACTION_STATUS_META: Record<
  string,
  { label: string; icon: string; className: string }
> = {
  pending: { label: 'Pendente', icon: '○', className: 'bg-gray-100 text-gray-600' },
  marked_done: { label: 'Aguardando', icon: '⏳', className: 'bg-amber-100 text-amber-700' },
  confirmed: { label: 'Feita', icon: '✓', className: 'bg-emerald-100 text-emerald-700' },
  missed: { label: 'Não feita', icon: '✕', className: 'bg-red-100 text-red-600' },
  cancelled: { label: 'Cancelada', icon: '—', className: 'bg-gray-100 text-gray-400' },
};

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const meta = ACTION_STATUS_META[status] ?? {
    label: status,
    icon: '?',
    className: 'bg-gray-100 text-gray-500',
  };
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        meta.className,
        className
      )}
    >
      <span aria-hidden>{meta.icon}</span>
      {meta.label}
    </span>
  );
}

export function PageSkeleton({ blocks = 2 }: { blocks?: number }) {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-48 rounded bg-gray-200" />
      {Array.from({ length: blocks }).map((_, i) => (
        <div key={i} className="h-40 rounded-xl bg-gray-100" />
      ))}
    </div>
  );
}

/** Small inline select with consistent styling. */
export const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';
