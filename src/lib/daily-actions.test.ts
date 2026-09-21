import { missDeadline, planRealignment, type DayActionRow } from './daily-actions';
import { dueTimeOf, dayEndOf } from './day-range';

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
  const NOITE = '2026-09-04T01:00:00.000Z'; // 22:00 em São Paulo — o fim do dia
  const MANHA = '2026-09-03T10:00:00.000Z'; // 07:00, uma hora marcada
  const LOUCA = 'tpl-louca';
  const MESA = 'tpl-mesa';
  const ESCOVAR = 'tpl-escovar'; // hábito: de todo mundo, nunca é distribuído
  const TROPECO = 'tpl-tropeco'; // extra registrado pelo adulto, fora do dia gerado
  const AURORA = 'g-aurora';
  const LIRA = 'g-lira';

  const daily = new Set([LOUCA, MESA, ESCOVAR]);
  const shared = new Set([LOUCA, MESA]);

  function row(over: Partial<DayActionRow> = {}): DayActionRow {
    return {
      id: 'a1',
      guardian_id: AURORA,
      action_template_id: LOUCA,
      due_at: NOITE,
      status: 'pending',
      ...over,
    };
  }
  const plan = (guardian_id: string, action_template_id: string, due_at = NOITE) => ({
    guardian_id,
    action_template_id,
    due_at,
  });

  it('passa a ação pendente para o novo dono da atividade', () => {
    const p = planRealignment([row()], [plan(LIRA, LOUCA)], daily, shared);
    expect(p).toEqual({ move: [{ id: 'a1', guardianId: LIRA, dueAt: NOITE }], drop: [] });
  });

  it('não mexe em quem já está com a atividade no horário certo', () => {
    const p = planRealignment([row()], [plan(AURORA, LOUCA)], daily, shared);
    expect(p).toEqual({ move: [], drop: [] });
  });

  it('acerta a hora quando a ação passa a ter horário marcado', () => {
    const p = planRealignment([row()], [plan(AURORA, LOUCA, MANHA)], daily, shared);
    expect(p).toEqual({ move: [{ id: 'a1', guardianId: AURORA, dueAt: MANHA }], drop: [] });
  });

  it('acerta a hora dos hábitos de cada guardião quando o fim do dia muda', () => {
    const rows = [
      row({ id: 'h-aurora', action_template_id: ESCOVAR, guardian_id: AURORA, due_at: MANHA }),
      row({ id: 'h-lira', action_template_id: ESCOVAR, guardian_id: LIRA, due_at: MANHA }),
    ];
    const p = planRealignment(rows, [plan(AURORA, ESCOVAR), plan(LIRA, ESCOVAR)], daily, shared);
    expect(p.drop).toEqual([]);
    expect(p.move).toEqual([
      { id: 'h-aurora', guardianId: AURORA, dueAt: NOITE },
      { id: 'h-lira', guardianId: LIRA, dueAt: NOITE },
    ]);
  });

  it('não mexe no que já foi feito, marcado ou virou falta', () => {
    const rows = [
      row({ id: 'feita', status: 'confirmed' }),
      row({ id: 'marcada', status: 'marked_done' }),
      row({ id: 'falta', status: 'missed' }),
    ];
    const p = planRealignment(rows, [plan(LIRA, LOUCA)], daily, shared);
    expect(p).toEqual({ move: [], drop: [] });
  });

  it('não mexe em extra registrado pelo adulto', () => {
    const rows = [row({ id: 'x', action_template_id: TROPECO })];
    const p = planRealignment(rows, [], daily, shared);
    expect(p).toEqual({ move: [], drop: [] });
  });

  it('apaga a antiga em vez de duplicar quando o novo dono já tem a linha do dia', () => {
    const rows = [
      row({ id: 'antiga', guardian_id: AURORA }),
      row({ id: 'nova', guardian_id: LIRA }),
    ];
    const p = planRealignment(rows, [plan(LIRA, LOUCA)], daily, shared);
    expect(p).toEqual({ move: [], drop: ['antiga'] });
  });

  it('a linha do dia sai quando a atividade fica sem dono', () => {
    const p = planRealignment([row()], [], daily, shared);
    expect(p).toEqual({ move: [], drop: ['a1'] });
  });

  it('a linha do dia sai quando a frequência tira a ação de hoje', () => {
    const rows = [row({ id: 'h1', action_template_id: ESCOVAR })];
    const p = planRealignment(rows, [plan(AURORA, LOUCA)], daily, shared);
    expect(p).toEqual({ move: [], drop: ['h1'] });
  });

  it('mesmo instante em formatos diferentes não é mudança', () => {
    // O banco devolve "+00:00"; o dia planejado é ISO com "Z".
    const doBanco = row({ due_at: '2026-09-04T01:00:00+00:00' });
    const p = planRealignment([doBanco], [plan(AURORA, LOUCA, NOITE)], daily, shared);
    expect(p).toEqual({ move: [], drop: [] });
  });

  it('não duplica quando o novo dono já tem a linha, em outro formato de data', () => {
    const rows = [
      row({ id: 'antiga', guardian_id: AURORA, due_at: '2026-09-04T01:00:00+00:00' }),
      row({ id: 'nova', guardian_id: LIRA, due_at: '2026-09-04T01:00:00+00:00' }),
    ];
    const p = planRealignment(rows, [plan(LIRA, LOUCA, NOITE)], daily, shared);
    expect(p).toEqual({ move: [], drop: ['antiga'] });
  });

  it('troca cruzada: cada um assume a do outro sem colidir', () => {
    const rows = [
      row({ id: 'louca', action_template_id: LOUCA, guardian_id: AURORA }),
      row({ id: 'mesa', action_template_id: MESA, guardian_id: LIRA }),
    ];
    const p = planRealignment(rows, [plan(LIRA, LOUCA), plan(AURORA, MESA)], daily, shared);
    expect(p.drop).toEqual([]);
    expect(p.move).toEqual([
      { id: 'louca', guardianId: LIRA, dueAt: NOITE },
      { id: 'mesa', guardianId: AURORA, dueAt: NOITE },
    ]);
  });
});

describe('dueTimeOf', () => {
  it('usa a hora marcada na ação', () => {
    expect(dueTimeOf({ default_due_time: '07:00:00' }, '22:00')).toBe('07:00');
  });

  it('cai no fim do dia quando a ação não tem hora marcada', () => {
    expect(dueTimeOf({ default_due_time: null }, '21:30')).toBe('21:30');
  });
});

describe('dayEndOf', () => {
  it('usa o horário da família', () => {
    expect(dayEndOf({ day_end_time: '21:00:00' })).toBe('21:00');
  });

  it('vale 22:00 enquanto a coluna não existe', () => {
    expect(dayEndOf({})).toBe('22:00');
  });
});

// ============================================================
// Casa Quest — Tests: o dia 1 da missão não gera falta
//
// As ações do primeiro dia nascem junto com a missão, muitas vezes com o dia
// já adiantado. Numa família real isso rendeu 17 faltas antes de qualquer
// criança ter tido chance de fazer alguma coisa.
// ============================================================

import { sweepOverdueActions } from './daily-actions';

type FakeRow = { id: string; due_at: string; created_at: string };

/** Minimal stand-in for the PostgREST builder used by sweepOverdueActions. */
function fakeDb(pending: FakeRow[]) {
  const swept: string[] = [];
  const from = () => {
    let mode: 'select' | 'update' = 'select';
    let id: string | null = null;
    const self = {
      select: () => self,
      update: () => { mode = 'update'; return self; },
      eq: (col: string, val: string) => { if (col === 'id') id = val; return self; },
      lt: () => self,
      then: (resolve: (v: unknown) => unknown) => {
        if (mode === 'update') { if (id) swept.push(id); return resolve({ error: null }); }
        return resolve({
          data: pending.map((p) => ({ ...p, action_templates: { default_due_time: '20:00' } })),
        });
      },
    };
    return self;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { db: { from } as any, swept };
}

describe('sweepOverdueActions — isenção do primeiro dia', () => {
  const TZ = 'America/Sao_Paulo';
  const now = new Date('2026-09-05T12:00:00.000Z');
  // 20:00 em São Paulo, dia 2 e dia 3.
  const day1: FakeRow = { id: 'a1', due_at: '2026-09-02T23:00:00.000Z', created_at: '2026-09-02T18:00:00.000Z' };
  const day2: FakeRow = { id: 'a2', due_at: '2026-09-03T23:00:00.000Z', created_at: '2026-09-03T03:00:00.000Z' };

  it('sem a isenção, a ação do dia 1 vira falta', async () => {
    const { db, swept } = fakeDb([day1]);
    expect(await sweepOverdueActions(db, 'm1', 30, now)).toBe(1);
    expect(swept).toEqual(['a1']);
  });

  it('com a isenção, a ação do dia 1 não vira falta', async () => {
    const { db, swept } = fakeDb([day1]);
    const n = await sweepOverdueActions(db, 'm1', 30, now, {
      missionStart: '2026-09-02',
      timeZone: TZ,
    });
    expect(n).toBe(0);
    expect(swept).toEqual([]);
  });

  it('a isenção vale só para o primeiro dia — o dia 2 segue contando', async () => {
    const { db, swept } = fakeDb([day1, day2]);
    const n = await sweepOverdueActions(db, 'm1', 30, now, {
      missionStart: '2026-09-02',
      timeZone: TZ,
    });
    expect(n).toBe(1);
    expect(swept).toEqual(['a2']);
  });
});
