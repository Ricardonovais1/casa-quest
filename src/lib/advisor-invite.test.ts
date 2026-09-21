// ============================================================
// Casa Quest — Tests: convite do Conselheiro
//
// A regra que estes testes protegem: "aceitou" é um ato NOSSO — criou a
// senha pelo link, ficou ligado à família. Não é existir em auth.users,
// nem ter `email_confirmed_at` preenchido.
//
// O caso real: abrir um magic link marca a conta como confirmada e
// "logada" SEM criar senha nenhuma. A conselheira desta casa ficou assim
// — o app a dava como ativa, ela não conseguia entrar, e o Mor não tinha
// nem o botão de reenviar. Todas as saídas levavam a criar outra família.
// ============================================================

import {
  inviteStateOf,
  inviteMessage,
  buildInviteUrl,
  INVITE_TTL_DAYS,
  type AdvisorRow,
  type InviteDelivery,
} from './advisor-invite';

const daysFromNow = (days: number) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

const advisor = (over: Partial<AdvisorRow> = {}): AdvisorRow => ({
  id: 'g1',
  name: 'Ananda',
  email: 'ananda@exemplo.com',
  user_id: null,
  access_token_hash: null,
  token_expires_at: null,
  role: 'conselheiro',
  ...over,
});

describe('inviteStateOf', () => {
  it('sem ninguém → none', () => {
    expect(inviteStateOf(null)).toBe('none');
    expect(inviteStateOf(undefined)).toBe('none');
  });

  it('cadastrado e nunca convidado → none', () => {
    expect(inviteStateOf(advisor())).toBe('none');
  });

  it('convite em aberto → pending', () => {
    expect(
      inviteStateOf(advisor({ access_token_hash: 'abc', token_expires_at: daysFromNow(10) }))
    ).toBe('pending');
  });

  it('convite sem prazo também conta como em aberto', () => {
    expect(inviteStateOf(advisor({ access_token_hash: 'abc' }))).toBe('pending');
  });

  it('convite vencido não é mais pendente', () => {
    expect(
      inviteStateOf(advisor({ access_token_hash: 'abc', token_expires_at: daysFromNow(-1) }))
    ).toBe('none');
  });

  it('criou a senha pelo link (token queimado, vínculo feito) → active', () => {
    expect(inviteStateOf(advisor({ user_id: 'u1' }))).toBe('active');
  });

  it('o convite novo manda no estado, mesmo para quem já tinha vínculo', () => {
    // O reenvio existe justamente para quem está preso: ele volta a ser
    // pendente até criar a senha de novo.
    expect(
      inviteStateOf(
        advisor({ user_id: 'u1', access_token_hash: 'abc', token_expires_at: daysFromNow(14) })
      )
    ).toBe('pending');
  });
});

describe('buildInviteUrl', () => {
  it('monta o link do token', () => {
    expect(buildInviteUrl('https://www.casaquest.fun', 't0k3n')).toBe(
      'https://www.casaquest.fun/convite/t0k3n'
    );
  });

  it('não duplica a barra quando a base vem com ela', () => {
    expect(buildInviteUrl('https://www.casaquest.fun/', 't0k3n')).toBe(
      'https://www.casaquest.fun/convite/t0k3n'
    );
  });

  it('o link é uma URL comum — sem fragmento, que é o que se perdia no caminho', () => {
    const url = buildInviteUrl('https://www.casaquest.fun', 't0k3n');
    expect(url).not.toContain('#');
    expect(new URL(url).pathname).toBe('/convite/t0k3n');
  });
});

describe('inviteMessage', () => {
  const make = (over: Partial<InviteDelivery> = {}): InviteDelivery => ({
    channel: 'sent',
    state: 'none',
    inviteUrl: 'https://www.casaquest.fun/convite/t0k3n',
    reason: null,
    ...over,
  });

  it('diz "de novo" quando já havia convite em aberto', () => {
    expect(inviteMessage(make({ state: 'pending' }), 'Ananda', 'a@b.com')).toContain('de novo');
  });

  it('não diz "de novo" no primeiro envio', () => {
    expect(inviteMessage(make({ state: 'none' }), 'Ananda', 'a@b.com')).not.toContain('de novo');
  });

  it('quando o e-mail não sai, manda compartilhar o link', () => {
    const text = inviteMessage(make({ channel: 'not_sent', reason: 'SMTP' }), 'Ananda', 'a@b.com');
    expect(text).toContain('não saiu');
    expect(text).toContain('Ananda');
  });

  it('nunca manda usar "a senha de sempre" — foi esse recado que travou a casa', () => {
    for (const state of ['none', 'pending', 'active'] as const) {
      for (const channel of ['sent', 'not_sent'] as const) {
        expect(inviteMessage(make({ state, channel }), 'Ananda', 'a@b.com')).not.toContain(
          'senha de sempre'
        );
      }
    }
  });
});

describe('INVITE_TTL_DAYS', () => {
  it('o prazo do link é o que o e-mail promete', () => {
    expect(INVITE_TTL_DAYS).toBe(14);
  });
});
