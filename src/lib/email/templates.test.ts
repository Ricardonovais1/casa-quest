// ============================================================
// Casa Quest — Lib: modelos de e-mail (testes)
// ============================================================

import { htmlToText } from './mailer';
import { advisorInviteEmail, escapeHtml, performanceAlertEmail } from './templates';
import type { GuardianSnapshot } from '@/domain/alerts/performance';

describe('escapeHtml', () => {
  it('neutraliza marcação vinda do usuário', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'
    );
  });
});

describe('advisorInviteEmail', () => {
  const invite = {
    inviterName: 'Marina',
    familyName: 'Novais',
    inviteeName: 'Rafael',
    acceptUrl: 'https://casaquest.fun/convite?token=abc',
    roleLabel: 'Conselheiro',
  };

  it('diz quem convidou e para qual família, já no assunto', () => {
    const { subject } = advisorInviteEmail(invite);
    expect(subject).toContain('Marina');
    expect(subject).toContain('Novais');
  });

  it('leva o link de aceite no botão e em texto', () => {
    const { html } = advisorInviteEmail(invite);
    expect(html).toContain(`href="${invite.acceptUrl}"`);
    // Quem usa cliente que bloqueia botão ainda consegue copiar.
    expect(htmlToText(html)).toContain(invite.acceptUrl);
  });

  it('escapa o nome da família em vez de injetar marcação', () => {
    const { html } = advisorInviteEmail({ ...invite, familyName: '<b>hack</b>' });
    expect(html).not.toContain('<b>hack</b>');
    expect(html).toContain('&lt;b&gt;hack&lt;/b&gt;');
  });

  it('cai num rótulo neutro quando o gênero não foi informado', () => {
    const { html } = advisorInviteEmail({ ...invite, roleLabel: undefined });
    expect(html).toContain('Conselheiro(a)');
  });
});

describe('performanceAlertEmail', () => {
  const snapshot: GuardianSnapshot = {
    guardianId: 'g1',
    guardianName: 'Ana Clara',
    percentage: 62,
    missed: 5,
    done: 12,
    recoveries: 1,
    streakDays: 0,
  };

  const input = {
    familyName: 'Novais',
    missionName: 'Missão de setembro',
    snapshot,
    severity: 'atencao' as const,
    thresholdPercent: 70,
    dashboardUrl: 'https://casaquest.fun/dashboard/hoje',
  };

  it('o assunto traz o primeiro nome, a energia e a missão', () => {
    const { subject } = performanceAlertEmail(input);
    expect(subject).toBe('Ana está com 62% de energia na Missão de setembro');
  });

  it('mostra o retrato da missão', () => {
    const text = htmlToText(performanceAlertEmail(input).html);
    expect(text).toContain('62%');
    expect(text).toContain('Meta da casa: 70% ou mais');
    expect(text).toContain('Compensações');
  });

  it('traz dicas de uso do app e orientações de apoio', () => {
    const text = htmlToText(performanceAlertEmail(input).html);
    expect(text).toContain('O que dá para fazer no app hoje');
    expect(text).toContain('Registre missões extras');
    expect(text).toContain('Revisem a rotina juntos');
    expect(text).toContain('Alinhem os horários da casa');
    expect(text).toContain('Escuta ativa antes da cobrança');
  });

  it('deixa claro que a criança não recebe nem vê a mesada', () => {
    const text = htmlToText(performanceAlertEmail(input).html);
    expect(text).toContain('só para os adultos da casa');
    expect(text).toContain('não recebe e não vê nenhum valor de mesada');
  });

  it('leva o link do painel', () => {
    expect(performanceAlertEmail(input).html).toContain(`href="${input.dashboardUrl}"`);
  });
});
