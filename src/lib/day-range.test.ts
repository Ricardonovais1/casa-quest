// ============================================================
// Casa Quest — Tests: day boundaries in a family's timezone
// ============================================================

import {
  localDateString,
  localDayRangeUtc,
  localDateTimeToUtc,
  weekdayInTz,
  addDays,
  localTimeString,
  friendlyDate,
} from './day-range';

const SP = 'America/Sao_Paulo'; // UTC-3, no DST

describe('localDateString', () => {
  it('still reports the previous day late in the local evening', () => {
    // 00:00 UTC on the 31st is 21:00 on the 30th in São Paulo.
    const at = new Date('2026-08-31T00:00:57Z');
    expect(localDateString(SP, at)).toBe('2026-08-30');
  });

  it('matches UTC during the middle of the local day', () => {
    const at = new Date('2026-08-30T15:00:00Z'); // 12:00 in SP
    expect(localDateString(SP, at)).toBe('2026-08-30');
  });

  it('rolls over at local midnight, not UTC midnight', () => {
    const at = new Date('2026-08-31T03:00:00Z'); // 00:00 in SP
    expect(localDateString(SP, at)).toBe('2026-08-31');
  });
});

describe('localDayRangeUtc', () => {
  it('spans the local day as UTC instants', () => {
    const at = new Date('2026-08-31T00:00:57Z'); // 21:00 on the 30th in SP
    const { date, startUtc, endUtc } = localDayRangeUtc(SP, at);

    expect(date).toBe('2026-08-30');
    expect(startUtc).toBe('2026-08-30T03:00:00.000Z'); // 00:00 SP
    expect(endUtc).toBe('2026-08-31T03:00:00.000Z'); // 00:00 SP next day
  });

  it('includes an action due in the local evening', () => {
    const at = new Date('2026-08-31T00:00:57Z');
    const { startUtc, endUtc } = localDayRangeUtc(SP, at);

    // This is the case that used to disappear from the list.
    const dueAt = new Date('2026-08-30T20:00:00Z').toISOString();
    expect(dueAt >= startUtc && dueAt < endUtc).toBe(true);
  });

  it('excludes an action belonging to the next local day', () => {
    const at = new Date('2026-08-30T15:00:00Z');
    const { startUtc, endUtc } = localDayRangeUtc(SP, at);

    const tomorrowEvening = new Date('2026-08-31T23:00:00Z').toISOString();
    expect(tomorrowEvening >= startUtc && tomorrowEvening < endUtc).toBe(false);
  });

  it('spans exactly 24 hours', () => {
    const { startUtc, endUtc } = localDayRangeUtc(SP, new Date('2026-08-30T15:00:00Z'));
    expect(Date.parse(endUtc) - Date.parse(startUtc)).toBe(86_400_000);
  });

  it('works for a UTC-based family', () => {
    const at = new Date('2026-08-30T15:00:00Z');
    const { date, startUtc } = localDayRangeUtc('UTC', at);
    expect(date).toBe('2026-08-30');
    expect(startUtc).toBe('2026-08-30T00:00:00.000Z');
  });

  it('works east of Greenwich', () => {
    // 22:00 UTC on the 30th is already 07:00 on the 31st in Tokyo.
    const at = new Date('2026-08-30T22:00:00Z');
    const { date, startUtc } = localDayRangeUtc('Asia/Tokyo', at);
    expect(date).toBe('2026-08-31');
    expect(startUtc).toBe('2026-08-30T15:00:00.000Z'); // 00:00 JST
  });
});

describe('localDateTimeToUtc', () => {
  it('converts a São Paulo wall-clock time to UTC', () => {
    expect(localDateTimeToUtc(SP, '2026-09-02', '20:00')).toBe('2026-09-02T23:00:00.000Z');
  });

  it('accepts HH:MM:SS as stored by Postgres TIME', () => {
    expect(localDateTimeToUtc(SP, '2026-09-02', '06:00:00')).toBe('2026-09-02T09:00:00.000Z');
  });

  it('crosses the UTC day boundary correctly', () => {
    expect(localDateTimeToUtc(SP, '2026-09-02', '22:30')).toBe('2026-09-03T01:30:00.000Z');
  });

  it('is the inverse of localDayRangeUtc at midnight', () => {
    expect(localDateTimeToUtc('Asia/Tokyo', '2026-08-31', '00:00')).toBe(
      '2026-08-30T15:00:00.000Z'
    );
  });
});

describe('weekdayInTz', () => {
  it('reports the local weekday, not the UTC one', () => {
    // 01:00 UTC on Thursday 2026-09-03 is still Wednesday in São Paulo.
    expect(weekdayInTz(SP, new Date('2026-09-03T01:00:00Z'))).toBe(3);
    expect(weekdayInTz('UTC', new Date('2026-09-03T01:00:00Z'))).toBe(4);
  });
});

describe('addDays / localTimeString / friendlyDate', () => {
  it('adds calendar days across month ends', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31');
  });

  it('formats the wall-clock time of an instant', () => {
    expect(localTimeString(SP, '2026-09-02T23:00:00Z')).toBe('20:00');
  });

  it('writes a friendly Portuguese date', () => {
    expect(friendlyDate('2026-09-02')).toBe('Quarta-feira, 2 de setembro');
  });
});
