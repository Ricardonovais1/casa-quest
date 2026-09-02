import { missDeadline } from './daily-actions';

const MIN = 60_000;

describe('missDeadline', () => {
  const due = '2026-09-02T09:00:00.000Z'; // 06:00 in São Paulo

  it('is due + tolerance when the action was generated in time', () => {
    const created = '2026-09-02T03:05:00.000Z'; // cron at 00:05
    expect(missDeadline(due, created, 30)).toBe(Date.parse(due) + 30 * MIN);
  });

  it('gives at least an hour from generation when generated late', () => {
    // App first opened at 09:40 local, well after 06:00 + 30 min.
    const created = '2026-09-02T12:40:00.000Z';
    expect(missDeadline(due, created, 30)).toBe(Date.parse(created) + 60 * MIN);
  });

  it('uses the tolerance itself when it is longer than the grace', () => {
    const created = '2026-09-02T12:40:00.000Z';
    expect(missDeadline(due, created, 120)).toBe(Date.parse(created) + 120 * MIN);
  });

  it('falls back to the due time itself with a zero tolerance', () => {
    const created = '2026-09-02T03:05:00.000Z';
    expect(missDeadline(due, created, 0)).toBe(Date.parse(due));
  });
});
