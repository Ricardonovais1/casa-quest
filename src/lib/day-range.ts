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
