// ============================================================
// Casa Quest — Lib: Day boundaries in a family's timezone
//
// Ações têm hora de vencimento e são listadas "de hoje". Calcular esse
// "hoje" em UTC quebra: às 21h em São Paulo o UTC já virou o dia, e a
// lista do guardião esvazia justo no horário de fazer as tarefas.
// Estas funções resolvem o dia local da família e devolvem o intervalo
// em UTC para consultar o banco.
// ============================================================

/**
 * Milliseconds that `timeZone` is ahead of UTC at the given instant.
 * (Negative for the Americas.)
 */
function timeZoneOffsetMs(timeZone: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(at)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }

  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    // Intl can render midnight as hour 24 in some engines.
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );

  return asIfUtc - at.getTime();
}

/** The calendar date (YYYY-MM-DD) in `timeZone` at the given instant. */
export function localDateString(timeZone: string, at: Date = new Date()): string {
  // 'en-CA' formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/**
 * UTC instants bounding the local day that contains `at` in `timeZone`.
 * `start` is inclusive, `end` is exclusive — so an action due at exactly
 * 23:59:59.999 local still falls inside the day it belongs to.
 *
 * NOTE: uses the offset in effect at `at`; a DST transition inside the day
 * can shift the boundary by an hour. Brazil no longer observes DST, so this
 * is exact for the default timezone.
 */
export function localDayRangeUtc(
  timeZone: string,
  at: Date = new Date()
): { date: string; startUtc: string; endUtc: string } {
  const date = localDateString(timeZone, at);
  const [year, month, day] = date.split('-').map(Number);

  const offset = timeZoneOffsetMs(timeZone, at);
  const startMs = Date.UTC(year!, month! - 1, day!) - offset;

  return {
    date,
    startUtc: new Date(startMs).toISOString(),
    endUtc: new Date(startMs + 86_400_000).toISOString(),
  };
}

/**
 * The UTC instant of a local wall-clock time (`YYYY-MM-DD` + `HH:MM[:SS]`)
 * in `timeZone`. This is how a template's `default_due_time` becomes a
 * concrete `due_at` for a given day.
 */
export function localDateTimeToUtc(
  timeZone: string,
  dateStr: string,
  timeStr: string
): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hh = 0, mm = 0, ss = 0] = timeStr.split(':').map(Number);
  const naive = Date.UTC(year!, month! - 1, day!, hh, mm, ss);

  // Two passes so a DST edge near the target instant resolves correctly.
  let offset = timeZoneOffsetMs(timeZone, new Date(naive));
  offset = timeZoneOffsetMs(timeZone, new Date(naive - offset));

  return new Date(naive - offset).toISOString();
}

/** Day of week (0 = Sunday … 6 = Saturday) in `timeZone` at the instant. */
export function weekdayInTz(timeZone: string, at: Date = new Date()): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(at);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
}

/** Wall-clock `HH:MM` of an instant in `timeZone` (for display). */
export function localTimeString(timeZone: string, at: Date | string): string {
  const d = typeof at === 'string' ? new Date(at) : at;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

/** Add `days` to a `YYYY-MM-DD` string (calendar arithmetic, no timezone). */
export function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10);
}

/**
 * Long, friendly date in Portuguese for a `YYYY-MM-DD` string,
 * e.g. "quarta-feira, 2 de setembro".
 */
export function friendlyDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year!, month! - 1, day!, 12));
  const text = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d);
  // "quarta-feira, 2 de setembro" → "Quarta-feira, 2 de setembro"
  return text.charAt(0).toUpperCase() + text.slice(1);
}
