// ============================================================
// Casa Quest — Lib: Scheduling (frequency → which days)
//
// Templates carregam uma frequência em texto livre ("diária",
// "3×/semana", "sob demanda"). Este módulo traduz isso em "essa ação
// acontece hoje?" de forma previsível: ações semanais caem sempre
// nos mesmos dias, então a família sabe o que esperar.
// Puro, sem I/O.
// ============================================================

/** 0 = Sunday … 6 = Saturday */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const WEEKDAY_LABELS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const;

/** Fixed weekday sets for "N×/semana", spread across the week. */
const WEEKLY_PATTERNS: Record<number, Weekday[]> = {
  1: [6],
  2: [2, 6],
  3: [1, 3, 5],
  4: [1, 2, 4, 6],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
  7: [0, 1, 2, 3, 4, 5, 6],
};

function normalize(frequency: string | null | undefined): string {
  return (frequency ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/**
 * Which weekdays an action with this frequency is scheduled on.
 * Returns an empty array for on-demand frequencies (never auto-generated).
 * Unknown text is treated as daily — the safest default for a habit.
 */
export function scheduledWeekdays(frequency: string | null | undefined): Weekday[] {
  const f = normalize(frequency);

  if (
    f === '' ||
    f === 'diaria' ||
    f === 'daily' ||
    f === 'todo dia' ||
    f === 'todos os dias' ||
    f === 'diario'
  ) {
    return WEEKLY_PATTERNS[7]!;
  }

  if (
    f.includes('sob demanda') ||
    f.includes('ocorrencia') ||
    f.includes('on demand') ||
    f.includes('quando')
  ) {
    return [];
  }

  if (f.includes('dias uteis') || f === 'weekdays') return WEEKLY_PATTERNS[5]!;
  if (f.includes('fim de semana') || f === 'weekend') return [0, 6];
  if (f === 'semanal' || f === 'weekly') return WEEKLY_PATTERNS[1]!;

  const weekly = f.match(/(\d+)\s*[x×]\s*(?:\/|por)?\s*semana/);
  if (weekly) {
    const n = Math.min(7, Math.max(1, Number(weekly[1])));
    return WEEKLY_PATTERNS[n]!;
  }

  return WEEKLY_PATTERNS[7]!;
}

/** Does an action with this frequency happen on the given weekday? */
export function isScheduledOn(
  frequency: string | null | undefined,
  weekday: number
): boolean {
  return scheduledWeekdays(frequency).includes(weekday as Weekday);
}

/** Human label for the schedule, e.g. "seg, qua e sex". */
export function describeSchedule(frequency: string | null | undefined): string {
  const days = scheduledWeekdays(frequency);
  if (days.length === 0) return 'quando acontecer';
  if (days.length === 7) return 'todo dia';
  const labels = days.map((d) => WEEKDAY_LABELS[d]);
  if (labels.length === 1) return `toda ${labels[0]}`;
  return `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`;
}
