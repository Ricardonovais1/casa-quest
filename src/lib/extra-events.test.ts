// ============================================================
// Casa Quest — Lib: eventos extras (testes da parte pura)
// ============================================================

import {
  ALL_EXTRA_CATEGORIES,
  EXTRA_EVENT_CATEGORIES,
  EXTRA_KIND_META,
  buildExtraActionRow,
  categoriesForKind,
  effectOfCategory,
  escaladaPointsOf,
  extrasEnabled,
  kindOfCategory,
  normalizeKind,
  type ExtraTemplate,
} from './extra-events';

const NOW = '2026-09-06T12:00:00.000Z';

function template(overrides: Partial<ExtraTemplate> = {}): ExtraTemplate {
  return { id: 't1', name: 'Lavar o carro', category: 'missoes', points: 7, ...overrides };
}

describe('effectOfCategory', () => {
  it('separa tropeço, compensação e escalada', () => {
    expect(effectOfCategory('tropecos')).toBe('tropeco');
    expect(effectOfCategory('missoes')).toBe('recovery');
    expect(effectOfCategory('gentilezas')).toBe('escalada');
    expect(effectOfCategory('autoaperfeicoamento')).toBe('escalada');
    expect(effectOfCategory('rendimento_escolar')).toBe('escalada');
  });

  it('ignora o que o dia gera sozinho', () => {
    expect(effectOfCategory('habitos')).toBeNull();
    expect(effectOfCategory('cooperacao')).toBeNull();
  });
});

describe('kindOfCategory', () => {
  it('junta compensação e escalada num tipo só no formulário', () => {
    expect(kindOfCategory('missoes')).toBe('extra');
    expect(kindOfCategory('gentilezas')).toBe('extra');
    expect(kindOfCategory('tropecos')).toBe('tropeco');
    expect(kindOfCategory('habitos')).toBeNull();
  });
});

describe('categoriesForKind', () => {
  it('missão extra cobre as quatro categorias de "fiz algo a mais"', () => {
    expect(categoriesForKind('extra').sort()).toEqual(
      ['autoaperfeicoamento', 'gentilezas', 'missoes', 'rendimento_escolar'].sort()
    );
  });

  it('tropeço fica sozinho', () => {
    expect(categoriesForKind('tropeco')).toEqual(['tropecos']);
  });
});

describe('normalizeKind', () => {
  it('aceita o vocabulário antigo das telas', () => {
    expect(normalizeKind('recovery')).toBe('extra');
    expect(normalizeKind('escalada')).toBe('extra');
    expect(normalizeKind('extra')).toBe('extra');
    expect(normalizeKind('tropeco')).toBe('tropeco');
  });

  it('recusa qualquer outra coisa', () => {
    expect(normalizeKind('qualquer')).toBeNull();
    expect(normalizeKind(undefined)).toBeNull();
    expect(normalizeKind(7)).toBeNull();
  });
});

describe('escaladaPointsOf', () => {
  it('usa os pontos da ação quando são positivos', () => {
    expect(escaladaPointsOf(template({ points: 5 }))).toBe(5);
  });

  it('cai no padrão da escalada quando a ação não pontua', () => {
    expect(escaladaPointsOf(template({ points: 0, escalada_base_points: 3 }))).toBe(3);
    expect(escaladaPointsOf(template({ points: null }))).toBe(2);
  });
});

describe('buildExtraActionRow', () => {
  const base = { missionId: 'm1', guardianId: 'g1', now: NOW };

  it('tropeço nasce como falta, no instante do registro', () => {
    const row = buildExtraActionRow({
      ...base,
      template: template({ category: 'tropecos', points: -1 }),
      effect: 'tropeco',
      recordedByGuardianId: 'adulto',
    });
    expect(row).toMatchObject({
      status: 'missed',
      missed_at: NOW,
      due_at: NOW,
      confirmation_status: 'not_required',
      recorded_by_guardian_id: 'adulto',
    });
    expect(row.escalada_points_earned).toBeUndefined();
  });

  it('compensação nasce confirmada e aponta para a falta que apaga', () => {
    const row = buildExtraActionRow({
      ...base,
      template: template(),
      effect: 'recovery',
      recoversActionId: 'falta-1',
    });
    expect(row).toMatchObject({
      status: 'confirmed',
      completed_at: NOW,
      recovers_action_id: 'falta-1',
    });
    // Compensar não é escalar: a energia volta pelo recovery_value da casa.
    expect(row.escalada_points_earned).toBeUndefined();
  });

  it('compensação sem falta em aberto ainda entra, sem alvo', () => {
    const row = buildExtraActionRow({ ...base, template: template(), effect: 'recovery' });
    expect(row.recovers_action_id).toBeNull();
  });

  it('escalada soma os pontos da ação', () => {
    const row = buildExtraActionRow({
      ...base,
      template: template({ category: 'gentilezas', points: 4 }),
      effect: 'escalada',
    });
    expect(row).toMatchObject({ status: 'confirmed', escalada_points_earned: 4 });
    expect(row.recovers_action_id).toBeUndefined();
  });

  it('sem autor, o registro veio do ciclo e não de alguém', () => {
    const row = buildExtraActionRow({ ...base, template: template(), effect: 'recovery' });
    expect(row.recorded_by_guardian_id).toBeNull();
  });
});

describe('extrasEnabled', () => {
  it('basta uma das duas colunas ligadas', () => {
    expect(extrasEnabled({ recovery_enabled: true, escalada_enabled: false })).toBe(true);
    expect(extrasEnabled({ recovery_enabled: false, escalada_enabled: true })).toBe(true);
  });

  it('desliga só quando as duas estão desligadas', () => {
    expect(extrasEnabled({ recovery_enabled: false, escalada_enabled: false })).toBe(false);
  });

  it('família sem as colunas ainda vale (padrão do banco é ligado)', () => {
    expect(extrasEnabled({})).toBe(true);
    expect(extrasEnabled(null)).toBe(false);
  });
});

describe('catálogo de tipos', () => {
  it('o formulário oferece dois tipos, e só tropeço é de adulto', () => {
    expect(EXTRA_KIND_META.map((k) => k.value)).toEqual(['tropeco', 'extra']);
    expect(EXTRA_KIND_META.find((k) => k.value === 'tropeco')!.adultsOnly).toBe(true);
    expect(EXTRA_KIND_META.find((k) => k.value === 'extra')!.adultsOnly).toBe(false);
  });

  it('tropeço nunca entra nas categorias que o guardião registra', () => {
    expect(EXTRA_EVENT_CATEGORIES).not.toContain('tropecos');
    expect(ALL_EXTRA_CATEGORIES).toContain('tropecos');
  });
});
