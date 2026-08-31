// ============================================================
// Casa Quest — Lib: Utilities
// ============================================================

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind CSS classes safely */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format a date as a localized string */
export function formatDate(date: Date | string, locale = 'pt-BR'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Format a time as HH:MM */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Format a datetime as relative (e.g., "há 15 min") */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'agora mesmo';
  if (diffMins < 60) return `há ${diffMins} min`;
  if (diffHours < 24) return `há ${diffHours}h`;
  if (diffDays < 7) return `há ${diffDays}d`;
  return formatDate(d);
}

/** Get a human-readable due time message */
export function getDueTimeMessage(
  dueAt: Date | string,
  toleranceMinutes: number
): { text: string; isOverdue: boolean; isUrgent: boolean } {
  const due = typeof dueAt === 'string' ? new Date(dueAt) : dueAt;
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const toleranceEnd = new Date(due.getTime() + toleranceMinutes * 60000);

  if (now > toleranceEnd) {
    // Past due + tolerance = missed
    const overdueMins = Math.floor((now.getTime() - due.getTime()) / 60000);
    return {
      text: `Atrasado há ${overdueMins} min`,
      isOverdue: true,
      isUrgent: true,
    };
  }

  if (now > due) {
    // Past due but within tolerance
    const remainingTolerance = Math.floor((toleranceEnd.getTime() - now.getTime()) / 60000);
    return {
      text: `Atrasado (tolerância: ${remainingTolerance} min)`,
      isOverdue: true,
      isUrgent: false,
    };
  }

  // Still on time
  if (diffMins < 60) {
    return { text: `Em ${diffMins} min`, isOverdue: false, isUrgent: false };
  }
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return {
    text: `Em ${hours}h ${mins}min`,
    isOverdue: false,
    isUrgent: false,
  };
}

/** Format currency (Brazilian Real) */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Base URL of the app as seen from the browser. Prefers an explicitly
 * configured public URL, falling back to the origin currently being used —
 * so guardian links are always shareable and never point at `localhost`
 * when the Mor is on a deployed domain.
 */
export function getAppBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env && !/^https?:\/\/localhost\b/i.test(env)) {
    return env.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return env || 'http://localhost:3000';
}

/** Build the shareable access link for a guardian's plain token. */
export function buildGuardianLink(token: string): string {
  return `${getAppBaseUrl()}/g/${token}`;
}

/** Generate a random token for guardian access */
export function generateToken(): string {
  // crypto.randomUUID is available in both browser and Node.js
  return crypto.randomUUID();
}

/** Simple hash function for tokens (browser-compatible) */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
