import { missDeadline, planRealignment, type DayActionRow } from './daily-actions';

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

describe('planRealignment', () => {
  const DUE = '2026-09-03T23:00:00.000Z';
  const LOUCA = 'tpl-louca';
  const MESA = 'tpl-mesa';
  const ESCOVAR = 'tpl-escovar'; // hábito: de todo mundo, nunca é distribuído
  const AURORA = 'g-aurora';
  const LIRA = 'g-lira';

  const shared = new Set([LOUCA, MESA]);
  const active = new Set([AURORA, LIRA]);

  function row(over: Partial<DayActionRow> = {}): DayActionRow {
    return {
      id: 'a1',
      guardian_id: AURORA,
      action_template_id: LOUCA,
      due_at: DUE,
      status: 'pending',
      ...over,
    };
  }

  it('passa a ação pendente para o novo dono da atividade', () => {
    const plan = planRealignment([row()], new Map([[LOUCA, LIRA]]), shared, active);
    expect(plan).toEqual({ move: [{ id: 'a1', guardianId: LIRA }], drop: [] });
  });

  it('não mexe em quem já está com a atividade', () => {
    const plan = planRealignment([row()], new Map([[LOUCA, AURORA]]), shared, active);
    expect(plan).toEqual({ move: [], drop: [] });
  });

  it('não mexe no que já foi feito, marcado ou virou falta', () => {
    const rows = [
      row({ id: 'feita', status: 'confirmed' }),
      row({ id: 'marcada', status: 'marked_done' }),
      row({ id: 'falta', status: 'missed' }),
    ];
    const plan = planRealignment(rows, new Map([[LOUCA, LIRA]]), shared, active);
    expect(plan).toEqual({ move: [], drop: [] });
  });

  it('não mexe em hábito, que não é distribuído', () => {
    const rows = [row({ id: 'h1', action_template_id: ESCOVAR })];
    const plan = planRealignment(rows, new Map([[LOUCA, LIRA]]), shared, active);
    expect(plan).toEqual({ move: [], drop: [] });
  });

  it('apaga a antiga em vez de duplicar quando o novo dono já tem a linha do dia', () => {
    const rows = [
      row({ id: 'antiga', guardian_id: AURORA }),
      row({ id: 'nova', guardian_id: LIRA }),
    ];
    const plan = planRealignment(rows, new Map([[LOUCA, LIRA]]), shared, active);
    expect(plan).toEqual({ move: [], drop: ['antiga'] });
  });

  it('a linha do dia sai quando a atividade fica sem dono', () => {
    const plan = planRealignment([row()], new Map(), shared, active);
    expect(plan).toEqual({ move: [], drop: ['a1'] });
  });

  it('a linha do dia sai quando o novo dono não é mais um guardião ativo', () => {
    const plan = planRealignment([row()], new Map([[LOUCA, 'g-saiu']]), shared, active);
    expect(plan).toEqual({ move: [], drop: ['a1'] });
  });

  it('troca cruzada: cada um assume a do outro sem colidir', () => {
    const rows = [
      row({ id: 'louca', action_template_id: LOUCA, guardian_id: AURORA }),
      row({ id: 'mesa', action_template_id: MESA, guardian_id: LIRA }),
    ];
    const plan = planRealignment(
      rows,
      new Map([
        [LOUCA, LIRA],
        [MESA, AURORA],
      ]),
      shared,
      active
    );
    expect(plan.drop).toEqual([]);
    expect(plan.move).toEqual([
      { id: 'louca', guardianId: LIRA },
      { id: 'mesa', guardianId: AURORA },
    ]);
  });

  it('horários diferentes da mesma atividade não se atrapalham', () => {
    const manha = '2026-09-03T10:00:00.000Z';
    const rows = [
      row({ id: 'manha', due_at: manha }),
      row({ id: 'noite', due_at: DUE }),
    ];
    const plan = planRealignment(rows, new Map([[LOUCA, LIRA]]), shared, active);
    expect(plan.drop).toEqual([]);
    expect(plan.move).toEqual([
      { id: 'manha', guardianId: LIRA },
      { id: 'noite', guardianId: LIRA },
    ]);
  });
});
