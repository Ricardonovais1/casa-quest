import { reviewDistribution, type ReviewPair, type ReviewTask } from './review';

const ROSA = 'rosa';
const LIRA = 'lira';
const AURORA = 'aurora';
const kids = [
  { id: ROSA, name: 'Rosa' },
  { id: LIRA, name: 'Lira' },
  { id: AURORA, name: 'Aurora' },
];

const coop = (id: string, points: number): ReviewTask => ({ id, name: id, category: 'cooperacao', points });
const habit = (id: string): ReviewTask => ({ id, name: id, category: 'habitos', points: 0 });
const same = (a: string, b: string): ReviewPair => ({ a, b, kind: 'same' });
const assign = (templateId: string, guardianId: string) => ({ templateId, guardianId });

describe('reviewDistribution', () => {
  it('rodada em ordem: nada a sugerir', () => {
    const review = reviewDistribution({
      tasks: [coop('lixo', 2), coop('varrer', 2), habit('cama')],
      guardians: kids,
      assignments: [assign('lixo', ROSA), assign('varrer', LIRA)],
      pairs: [],
    });
    expect(review.unassigned).toEqual([]);
    expect(review.suggestions).toEqual([]);
    expect(review.loads).toEqual({ [ROSA]: 2, [LIRA]: 2, [AURORA]: 0 });
  });

  it('a casa real: a sem ninguém é gêmea da de Rosa, e Aurora repete o hábito — fundir as duas', () => {
    const review = reviewDistribution({
      tasks: [
        coop('colocar-louca', 1),
        coop('encher-lava-louca', 0),
        coop('tirar-louca', 1),
        habit('esvaziar-lava-loucas'),
        coop('recolher-lixo', 2),
      ],
      guardians: kids,
      assignments: [
        assign('encher-lava-louca', ROSA),
        assign('tirar-louca', AURORA),
        assign('recolher-lixo', LIRA),
      ],
      pairs: [same('colocar-louca', 'encher-lava-louca'), same('esvaziar-lava-loucas', 'tirar-louca')],
    });

    expect(review.unassigned).toEqual(['colocar-louca']);
    expect(review.suggestions).toEqual([
      {
        kind: 'merge',
        keepId: 'encher-lava-louca',
        mergeId: 'colocar-louca',
        reason: 'unassigned-twin',
        guardianIds: [ROSA],
      },
      {
        kind: 'merge',
        keepId: 'esvaziar-lava-loucas',
        mergeId: 'tirar-louca',
        reason: 'habit-twin',
        guardianIds: [AURORA],
      },
    ]);
  });

  it('troca: quem faz uma repetida deixa ela e pega a que está sem ninguém', () => {
    const review = reviewDistribution({
      tasks: [coop('tirar-louca', 1), habit('esvaziar-lava-loucas'), coop('varrer', 2), coop('lixo', 2)],
      guardians: kids,
      assignments: [assign('tirar-louca', AURORA), assign('lixo', ROSA)],
      pairs: [same('tirar-louca', 'esvaziar-lava-loucas')],
    });

    expect(review.suggestions).toEqual([
      {
        kind: 'swap',
        guardianId: AURORA,
        giveId: 'tirar-louca',
        takeId: 'varrer',
        twinId: 'esvaziar-lava-loucas',
        loadBefore: 1,
        loadAfter: 2,
      },
    ]);
  });

  it('entre duas pessoas com a mesma tarefa, troca quem deixa a carga mais parecida', () => {
    const review = reviewDistribution({
      tasks: [coop('lavar-louca', 2), coop('louca-jantar', 1), coop('regar', 1), coop('lixo', 3)],
      guardians: kids,
      assignments: [assign('lavar-louca', ROSA), assign('louca-jantar', LIRA), assign('lixo', ROSA)],
      pairs: [same('lavar-louca', 'louca-jantar')],
    });

    const swap = review.suggestions[0];
    expect(swap).toMatchObject({ kind: 'swap', guardianId: LIRA, giveId: 'louca-jantar', takeId: 'regar' });
  });

  it('sem repetida para trocar, atribui a quem está mais leve e segue equilibrando', () => {
    const review = reviewDistribution({
      tasks: [coop('lixo', 2), coop('varrer', 2), coop('filtro', 2), coop('banheiro', 2)],
      guardians: kids,
      assignments: [assign('lixo', ROSA)],
      pairs: [],
    });

    const assigned = review.suggestions.map((s) => (s.kind === 'assign' ? s.guardianId : null));
    expect(assigned).toEqual([LIRA, AURORA, ROSA]);
  });

  it('duas gêmeas sem ninguém: fundir antes, nunca uma para cada', () => {
    const review = reviewDistribution({
      tasks: [coop('colocar-louca', 1), coop('encher-lava-louca', 1)],
      guardians: kids,
      assignments: [],
      pairs: [same('colocar-louca', 'encher-lava-louca')],
    });

    expect(review.suggestions).toHaveLength(1);
    expect(review.suggestions[0]).toMatchObject({ kind: 'merge', reason: 'unassigned-twin', guardianIds: [] });
  });

  it('as duas com a mesma pessoa: fundir, ficando a que vale mais', () => {
    const review = reviewDistribution({
      tasks: [coop('a', 1), coop('b', 2)],
      guardians: kids,
      assignments: [assign('a', LIRA), assign('b', LIRA)],
      pairs: [same('a', 'b')],
    });

    expect(review.suggestions).toEqual([
      { kind: 'merge', keepId: 'b', mergeId: 'a', reason: 'same-guardian', guardianIds: [LIRA] },
    ]);
  });

  it('tarefas só parecidas não são tratadas como repetidas', () => {
    const review = reviewDistribution({
      tasks: [coop('cuidar-pet', 1), coop('higiene-pet', 2)],
      guardians: kids,
      assignments: [assign('cuidar-pet', LIRA), assign('higiene-pet', ROSA)],
      pairs: [{ a: 'cuidar-pet', b: 'higiene-pet', kind: 'related' }],
    });
    expect(review.suggestions).toEqual([]);
  });

  it('atividade de um guardião que saiu da casa conta como sem ninguém', () => {
    const review = reviewDistribution({
      tasks: [coop('lixo', 2)],
      guardians: kids,
      assignments: [assign('lixo', 'guardiao-inativo')],
      pairs: [],
    });
    expect(review.unassigned).toEqual(['lixo']);
    expect(review.suggestions[0]).toMatchObject({ kind: 'assign', takeId: 'lixo' });
  });
});
