import { planMerge, type MergeRow } from './action-merge';

const MISSAO = 'm1';
const AURORA = 'g-aurora';
const LIRA = 'g-lira';
const NOITE = '2026-09-10T01:00:00.000Z'; // 22:00 em São Paulo — fim do dia
const OUTRA_NOITE = '2026-09-11T01:00:00.000Z';

function row(id: string, over: Partial<MergeRow> = {}): MergeRow {
  return { id, mission_id: MISSAO, guardian_id: AURORA, due_at: NOITE, status: 'pending', ...over };
}

describe('planMerge', () => {
  it('sem choque, tudo passa para a que fica', () => {
    const plan = planMerge(
      [row('k1', { due_at: OUTRA_NOITE })],
      [row('m1'), row('m2', { guardian_id: LIRA })]
    );
    expect(plan).toEqual({ repoint: ['m1', 'm2'], dropMerged: [], dropKept: [], shift: [] });
  });

  it('duas pendências da mesma pessoa no mesmo dia: a repetida sai', () => {
    const plan = planMerge([row('k1')], [row('m1')]);
    expect(plan.dropMerged).toEqual(['m1']);
    expect(plan.repoint).toEqual([]);
  });

  it('o que foi feito na que sai ganha da pendência da que fica', () => {
    const plan = planMerge([row('k1')], [row('m1', { status: 'confirmed' })]);
    expect(plan.dropKept).toEqual(['k1']);
    expect(plan.repoint).toEqual(['m1']);
  });

  it('pendência da que sai não passa por cima de um registro da que fica', () => {
    const plan = planMerge([row('k1', { status: 'missed' })], [row('m1')]);
    expect(plan.dropMerged).toEqual(['m1']);
    expect(plan.dropKept).toEqual([]);
  });

  it('as duas já são história no mesmo horário: nenhuma se perde, a que sai anda um segundo', () => {
    const plan = planMerge(
      [row('k1', { status: 'missed' }), row('k2', { status: 'missed', due_at: '2026-09-10T01:00:01.000Z' })],
      [row('m1', { status: 'missed' })]
    );
    expect(plan.shift).toEqual([{ id: 'm1', dueAt: '2026-09-10T01:00:02.000Z' }]);
    expect(plan.dropMerged).toEqual([]);
    expect(plan.dropKept).toEqual([]);
  });

  it('compara o instante, não o texto que o banco devolve', () => {
    const plan = planMerge([row('k1', { due_at: '2026-09-10T01:00:00+00:00' })], [row('m1')]);
    expect(plan.dropMerged).toEqual(['m1']);
  });

  it('outra missão no mesmo horário não é choque', () => {
    const plan = planMerge([row('k1', { mission_id: 'm0' })], [row('m1')]);
    expect(plan.repoint).toEqual(['m1']);
  });
});
