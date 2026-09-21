// ============================================================
// Casa Quest — Lib: e-mail transacional (testes)
// Só a parte que não abre conexão: configuração e conversão.
// ============================================================

import { explainSendError, htmlToText, isEmailConfigured, readSmtpConfig, sendEmail } from './mailer';

describe('readSmtpConfig', () => {
  it('exige host e remetente', () => {
    expect(readSmtpConfig({})).toBeNull();
    expect(readSmtpConfig({ SMTP_HOST: 'smtp.exemplo.com' })).toBeNull();
    expect(readSmtpConfig({ SMTP_FROM: 'casa@exemplo.com' })).toBeNull();
  });

  it('usa 587 com STARTTLS por padrão', () => {
    const config = readSmtpConfig({
      SMTP_HOST: 'smtp.exemplo.com',
      SMTP_FROM: 'Casa Quest <casa@exemplo.com>',
    });
    expect(config).toMatchObject({ port: 587, secure: false });
  });

  it('liga TLS implícito na 465', () => {
    const config = readSmtpConfig({
      SMTP_HOST: 'smtp.exemplo.com',
      SMTP_FROM: 'casa@exemplo.com',
      SMTP_PORT: '465',
    });
    expect(config).toMatchObject({ port: 465, secure: true });
  });

  it('leva o SMTP_REPLY_TO para a configuração, e sem ele fica indefinido', () => {
    const base = { SMTP_HOST: 'smtp.exemplo.com', SMTP_FROM: 'Casa Quest <contato@exemplo.com>' };
    expect(readSmtpConfig(base)?.replyTo).toBeUndefined();
    expect(readSmtpConfig({ ...base, SMTP_REPLY_TO: ' pessoa@gmail.com ' })?.replyTo).toBe(
      'pessoa@gmail.com'
    );
  });

  it('ignora uma porta inválida em vez de quebrar o envio', () => {
    const config = readSmtpConfig({
      SMTP_HOST: 'smtp.exemplo.com',
      SMTP_FROM: 'casa@exemplo.com',
      SMTP_PORT: 'não é número',
    });
    expect(config).toMatchObject({ port: 587, secure: false });
  });

  it('SMTP sem usuário é válido (relay interno)', () => {
    const config = readSmtpConfig({
      SMTP_HOST: 'localhost',
      SMTP_FROM: 'casa@exemplo.com',
      SMTP_USER: '  ',
    });
    expect(config?.user).toBeUndefined();
  });

  it('isEmailConfigured segue a mesma regra', () => {
    expect(isEmailConfigured({})).toBe(false);
    expect(
      isEmailConfigured({
        SMTP_HOST: 'smtp.exemplo.com',
        SMTP_FROM: 'casa@exemplo.com',
      })
    ).toBe(true);
  });
});

describe('sendEmail', () => {
  it('sem configuração, avisa em vez de lançar', async () => {
    const previous = process.env.SMTP_HOST;
    delete process.env.SMTP_HOST;

    const result = await sendEmail({ to: 'a@b.com', subject: 'oi', html: '<p>oi</p>' });
    expect(result).toMatchObject({ ok: false, code: 'NOT_CONFIGURED' });

    if (previous !== undefined) process.env.SMTP_HOST = previous;
  });
});

describe('explainSendError', () => {
  it('domínio não verificado: diz qual e onde resolver', () => {
    // O erro exato que o convite de conselheiro devolveu em produção.
    const hint = explainSendError(
      'Message failed: 550 The casaquest.fun domain is not verified. Please, add and verify your domain on https://resend.com/domains'
    );
    expect(hint).toContain('(casaquest.fun)');
    expect(hint).toContain('Add Domain');
  });

  it('modo de teste do Resend não é confundido com domínio não verificado', () => {
    const hint = explainSendError(
      'You can only send testing emails to your own email address (dono@exemplo.com). To send emails to other recipients, please verify a domain at resend.com/domains'
    );
    expect(hint).toContain('remetente de teste');
  });

  it('login recusado aponta SMTP_USER e SMTP_PASS', () => {
    expect(explainSendError('Invalid login: 535 Authentication credentials invalid')).toContain('SMTP_USER/SMTP_PASS');
  });

  it('falha de conexão aponta host e porta', () => {
    expect(explainSendError('connect ETIMEDOUT 1.2.3.4:465')).toContain('SMTP_HOST');
  });

  it('erro desconhecido passa como veio', () => {
    expect(explainSendError('451 algo inesperado')).toBe('451 algo inesperado');
  });
});

describe('htmlToText', () => {
  it('vira texto legível para quem não renderiza HTML', () => {
    const text = htmlToText(
      '<style>p{color:red}</style><h1>Oi</h1><p>Primeiro<br/>segundo</p><ul><li>um</li><li>dois</li></ul>'
    );
    expect(text).toBe('Oi\nPrimeiro\nsegundo\n• um\n• dois');
  });

  it('desfaz as entidades que o modelo escapou', () => {
    expect(htmlToText('<p>Bom &amp; barato &lt;sempre&gt;</p>')).toBe('Bom & barato <sempre>');
  });
});
