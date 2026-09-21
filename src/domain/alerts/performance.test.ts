// ============================================================
// Casa Quest — Domain: alerta de desempenho (testes)
// ============================================================

import {
  DEFAULT_ALERT_COOLDOWN_DAYS,
  DEFAULT_ALERT_THRESHOLD,
  appTips,
  decideAlert,
  headlineFor,
  severityFor,
  supportTips,
  type GuardianSnapshot,
} from './performance';

function snapshot(overrides: Partial<GuardianSnapshot> = {}): GuardianSnapshot {
  return {
    guardianId: 'g1',
    guardianName: 'Ana Clara',
    percentage: 65,
    missed: 4,
    done: 10,
    recoveries: 1,
    streakDays: 0,
    ...overrides,
  };
}

const NOW = new Date('2026-09-06T09:00:00Z');

describe('severityFor', () => {
  it('classifica pelas faixas de energia', () => {
    expect(severityFor(70)).toBe('atencao');
    expect(severityFor(51)).toBe('atencao');
    expect(severityFor(50)).toBe('recuperacao');
    expect(severityFor(31)).toBe('recuperacao');
    expect(severityFor(30)).toBe('critico');
    expect(severityFor(0)).toBe('critico');
  });
});

describe('decideAlert', () => {
  it('não avisa acima do limite', () => {
    const decision = decideAlert({ snapshot: snapshot({ percentage: 71 }), now: NOW });
    expect(decision).toEqual({ alert: false, reason: 'above_threshold' });
  });

  it('avisa exatamente no limite ("igual ou inferior a 70%")', () => {
    const decision = decideAlert({ snapshot: snapshot({ percentage: 70 }), now: NOW });
    expect(decision).toEqual({ alert: true, severity: 'atencao' });
  });

  it('respeita o limite configurado pela família', () => {
    const at75 = snapshot({ percentage: 75 });
    expect(decideAlert({ snapshot: at75, now: NOW }).alert).toBe(false);
    expect(decideAlert({ snapshot: at75, thresholdPercent: 80, now: NOW }).alert).toBe(true);
  });

  it('cala enquanto o intervalo entre avisos não passou', () => {
    const oneDayAgo = new Date(NOW.getTime() - 86_400_000).toISOString();
    const decision = decideAlert({ snapshot: snapshot(), lastAlertAt: oneDayAgo, now: NOW });
    expect(decision).toEqual({ alert: false, reason: 'cooldown' });
  });

  it('volta a avisar depois do intervalo', () => {
    const old = new Date(NOW.getTime() - (DEFAULT_ALERT_COOLDOWN_DAYS + 1) * 86_400_000).toISOString();
    expect(decideAlert({ snapshot: snapshot(), lastAlertAt: old, now: NOW }).alert).toBe(true);
  });

  it('ignora um último envio com data inválida em vez de calar para sempre', () => {
    const decision = decideAlert({ snapshot: snapshot(), lastAlertAt: 'nunca', now: NOW });
    expect(decision.alert).toBe(true);
  });

  it('usa 70% como limite padrão', () => {
    expect(DEFAULT_ALERT_THRESHOLD).toBe(70);
  });
});

describe('headlineFor', () => {
  it('fala pelo primeiro nome e muda o tom com a gravidade', () => {
    const s = snapshot();
    expect(headlineFor(s, 'atencao')).toContain('Ana');
    expect(headlineFor(s, 'atencao')).not.toContain('Clara');
    expect(headlineFor(s, 'critico')).not.toBe(headlineFor(s, 'atencao'));
  });
});

describe('appTips', () => {
  it('sugere missão extra quando há mais faltas que compensações', () => {
    const tips = appTips(snapshot({ missed: 4, recoveries: 1 }));
    const titles = tips.map((t) => t.title);
    expect(titles).toContain('Registre missões extras');
    expect(tips[0]!.text).toContain('4 faltas');
  });

  it('não insiste em compensar quando as faltas já foram compensadas', () => {
    const tips = appTips(snapshot({ missed: 2, recoveries: 2 }));
    expect(tips.map((t) => t.title)).not.toContain('Registre missões extras');
  });

  it('sugere revisar horários quando a constância zerou', () => {
    const titles = appTips(snapshot({ streakDays: 0 })).map((t) => t.title);
    expect(titles).toContain('Revise as ações e os horários');
  });

  it('não fala de horários para quem está com constância em pé', () => {
    const titles = appTips(snapshot({ streakDays: 5 })).map((t) => t.title);
    expect(titles).not.toContain('Revise as ações e os horários');
  });

  it('sempre entrega pelo menos duas dicas de uso do app', () => {
    expect(appTips(snapshot({ missed: 0, recoveries: 0, streakDays: 9 })).length).toBeGreaterThanOrEqual(2);
  });
});

describe('supportTips', () => {
  it('cobre rotina, horários em família e escuta ativa', () => {
    const text = supportTips().map((t) => `${t.title} ${t.text}`).join(' ');
    expect(text).toContain('rotina');
    expect(text).toContain('horários');
    expect(text).toContain('Escuta ativa');
  });
});
