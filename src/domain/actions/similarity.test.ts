import { canMerge, compareNames, findSimilarActions, nameTokens, pairKey } from './similarity';

describe('nameTokens', () => {
  it('tira acento, plural e palavras vazias', () => {
    expect(nameTokens('Esvaziar as lava-louças')).toEqual(['tirar', 'louca']);
    expect(nameTokens('Não escovar os dentes')).toEqual(['escovar', 'dente']);
  });

  it('junta sinônimos de tarefa de casa', () => {
    expect(nameTokens('Encher a lava-louça')).toEqual(nameTokens('Colocar louça'));
    expect(nameTokens('Pôr a mesa')).toEqual(nameTokens('Colocar a mesa'));
  });
});

describe('compareNames', () => {
  it('reconhece a mesma tarefa com outras palavras', () => {
    expect(compareNames('Colocar louça', 'Encher a lava-louça')?.kind).toBe('same');
    expect(compareNames('Tirar louça', 'Esvaziar lava-louças')?.kind).toBe('same');
  });

  it('não confunde ações opostas sobre a mesma coisa', () => {
    expect(compareNames('Colocar a mesa', 'Tirar a mesa')).toBeNull();
    expect(compareNames('Encher a lava-louça', 'Esvaziar lava-louças')).toBeNull();
  });

  it('não junta tarefas que só dividem o verbo', () => {
    expect(compareNames('Arrumar a cama', 'Arrumar armário')).toBeNull();
    expect(compareNames('Lavar o carro', 'Lavar roupa')).toBeNull();
    expect(compareNames('Colocar a mesa', 'Colocar louça')).toBeNull();
  });

  it('aponta como parecidas as que dividem o objeto', () => {
    expect(compareNames('Cuidar do pet', 'Higiene do pet')?.kind).toBe('related');
    expect(compareNames('Abastecer filtro de água', 'Encher garrafas de água')?.kind).toBe('related');
  });

  it('aponta um nome contido no outro', () => {
    expect(compareNames('Não guardar', 'Não guardar utensílios e alimentos que usou')?.kind).toBe('related');
  });

  it('ignora parentesco fraco demais', () => {
    expect(compareNames('Não pendurar toalha após banho', 'Não tomar banho')).toBeNull();
  });
});

describe('canMerge', () => {
  it('hábito e colaboração se fundem; tropeço e missão extra não', () => {
    expect(canMerge({ category: 'habitos' }, { category: 'cooperacao' })).toBe(true);
    expect(canMerge({ category: 'missoes' }, { category: 'gentilezas' })).toBe(true);
    expect(canMerge({ category: 'tropecos' }, { category: 'missoes' })).toBe(false);
    expect(canMerge({ category: 'cooperacao' }, { category: 'missoes' })).toBe(false);
  });
});

describe('findSimilarActions', () => {
  // O catálogo de uma família real, em setembro de 2026.
  const catalog = [
    { id: 'filtro', name: 'Abastecer filtro de água', category: 'cooperacao' },
    { id: 'por-mesa', name: 'Colocar a mesa', category: 'cooperacao' },
    { id: 'por-louca', name: 'Colocar louça', category: 'cooperacao' },
    { id: 'pet', name: 'Cuidar do pet', category: 'cooperacao' },
    { id: 'encher', name: 'Encher a lava-louça', category: 'cooperacao' },
    { id: 'garrafas', name: 'Encher garrafas de água', category: 'cooperacao' },
    { id: 'higiene-pet', name: 'Higiene do pet', category: 'cooperacao' },
    { id: 'cozinha', name: 'Organizar cozinha', category: 'cooperacao' },
    { id: 'banheiro', name: 'Organizar o banheiro', category: 'cooperacao' },
    { id: 'lixo', name: 'Recolher o lixo', category: 'cooperacao' },
    { id: 'tirar-mesa', name: 'Tirar a mesa', category: 'cooperacao' },
    { id: 'tirar-louca', name: 'Tirar louça', category: 'cooperacao' },
    { id: 'varrer', name: 'Varrer a casa', category: 'cooperacao' },
    { id: 'cama', name: 'Arrumar a cama', category: 'habitos' },
    { id: 'armario', name: 'Arrumar armário', category: 'habitos' },
    { id: 'esvaziar', name: 'Esvaziar lava-louças', category: 'habitos' },
    { id: 'refeicao', name: 'Ajudar ou fazer uma refeição', category: 'missoes' },
    { id: 'jardim', name: 'Cuidar do jardim', category: 'missoes' },
    { id: 'compras', name: 'Fazer pequenas compras', category: 'missoes' },
    { id: 'carro', name: 'Lavar o carro', category: 'missoes' },
    { id: 'roupa', name: 'Lavar roupa', category: 'missoes' },
    { id: 'limpar-banheiro', name: 'Limpar banheiro', category: 'missoes' },
    { id: 'moveis', name: 'Limpar móveis', category: 'missoes' },
    { id: 'cesto', name: 'Não colocar roupas sujas no cesto', category: 'tropecos' },
    { id: 'dentes', name: 'Não escovar os dentes', category: 'tropecos' },
    { id: 'guardar', name: 'Não guardar', category: 'tropecos' },
    { id: 'utensilios', name: 'Não guardar utensílios e alimentos que usou', category: 'tropecos' },
    { id: 'toalha', name: 'Não pendurar toalha após banho', category: 'tropecos' },
    { id: 'banho', name: 'Não tomar banho', category: 'tropecos' },
    { id: 'copos', name: 'Não trazer copos e pratos do quarto', category: 'tropecos' },
    { id: 'banho-tarde', name: 'Tomar banho depois do horário estipulado', category: 'tropecos' },
  ];

  it('acha exatamente as repetições desse catálogo, iguais primeiro', () => {
    const pairs = findSimilarActions(catalog).map((p) => `${p.kind}:${pairKey(p.a, p.b)}`);
    expect(pairs.slice(0, 2).sort()).toEqual(
      [`same:${pairKey('por-louca', 'encher')}`, `same:${pairKey('tirar-louca', 'esvaziar')}`].sort()
    );
    expect(pairs.slice(2).sort()).toEqual(
      [
        `related:${pairKey('filtro', 'garrafas')}`,
        `related:${pairKey('pet', 'higiene-pet')}`,
        `related:${pairKey('guardar', 'utensilios')}`,
        `related:${pairKey('banho', 'banho-tarde')}`,
      ].sort()
    );
  });

  it('não compara categorias que não se fundem', () => {
    const pairs = findSimilarActions([
      { id: 'x', name: 'Limpar banheiro', category: 'missoes' },
      { id: 'y', name: 'Limpar banheiro', category: 'cooperacao' },
    ]);
    expect(pairs).toEqual([]);
  });

  it('ignora par em que as duas estão desativadas', () => {
    const pairs = findSimilarActions([
      { id: 'x', name: 'Tirar louça', category: 'cooperacao', is_active: false },
      { id: 'y', name: 'Esvaziar lava-louças', category: 'habitos', is_active: false },
    ]);
    expect(pairs).toEqual([]);
  });
});
