// ============================================================
// Casa Quest — Lib: E-mails transacionais (SMTP)
//
// Um único ponto de saída de e-mail no app. A configuração vem do
// ambiente (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM);
// sem ela o app continua funcionando — quem chama recebe
// `{ ok: false, code: 'NOT_CONFIGURED' }` e decide o que fazer
// (o convite, por exemplo, cai no SMTP embutido do Supabase).
//
// Servidor-only: nunca importe isto de um componente de cliente.
// ============================================================

import nodemailer, { type Transporter } from 'nodemailer';

export interface SmtpConfig {
  host: string;
  port: number;
  /** TLS implícito (porta 465). Nas demais portas usa STARTTLS. */
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
  /**
   * Para onde vai a resposta de quem recebe. O remetente é um endereço do
   * domínio verificado, que pode não ter caixa de entrada; sem isto, quem
   * responde ao convite fala com o vazio.
   */
  replyTo?: string;
}

export type SendResult =
  | { ok: true; messageId: string }
  | {
      ok: false;
      code: 'NOT_CONFIGURED' | 'SEND_FAILED';
      /** O erro como veio do servidor — é o que vai para o histórico. */
      message: string;
      /** O mesmo erro em português e com o próximo passo, para mostrar a um adulto. */
      hint?: string;
    };

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  /** Alternativa em texto puro. Derivada do HTML quando ausente. */
  text?: string;
  replyTo?: string;
}

/**
 * Lê a configuração do ambiente. Devolve null quando falta o essencial
 * (host e remetente) — é assim que o app sabe que o SMTP não está ligado.
 */
export type EnvLike = Record<string, string | undefined>;

export function readSmtpConfig(env: EnvLike = process.env): SmtpConfig | null {
  const host = env.SMTP_HOST?.trim();
  const from = env.SMTP_FROM?.trim();
  if (!host || !from) return null;

  const port = Number(env.SMTP_PORT ?? 587);

  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 587,
    secure: (Number.isFinite(port) ? port : 587) === 465,
    user: env.SMTP_USER?.trim() || undefined,
    pass: env.SMTP_PASS || undefined,
    from,
    replyTo: env.SMTP_REPLY_TO?.trim() || undefined,
  };
}

/** O SMTP está configurado? Usado para escolher o caminho do convite. */
export function isEmailConfigured(env: EnvLike = process.env): boolean {
  return readSmtpConfig(env) !== null;
}

/**
 * O erro do servidor SMTP em português, com o que fazer.
 *
 * DECISION (2026-09-15): o motivo aparecia cru na tela de Família —
 * "Message failed: 550 The casaquest.fun domain is not verified…" — e quem
 * lê é o Mor, não quem configurou o provedor. Os casos conhecidos viram um
 * recado com o próximo passo; o resto passa como veio, para não esconder a
 * pista.
 */
export function explainSendError(raw: string): string {
  const text = raw ?? '';

  // Antes do "domínio não verificado": a mensagem do modo de teste do Resend
  // também fala em "verify a domain".
  if (/only send testing emails|to your own email address/i.test(text)) {
    return 'O remetente de teste do provedor só entrega para o dono da conta. Verifique um domínio e use-o em SMTP_FROM.';
  }
  if (/domain is not verified|domain not verified/i.test(text)) {
    const domain = text.match(/the\s+([a-z0-9.-]+\.[a-z]{2,})\s+domain is not verified/i)?.[1];
    // O Resend dá a mesma resposta para domínio pendente e para domínio que nem
    // está cadastrado no time dono da API key — foi o segundo caso nesta casa.
    return `O domínio do remetente${domain ? ` (${domain})` : ''} não está verificado no provedor de e-mail, e sem isso nenhum e-mail sai. No Resend, no mesmo time da API key: Domains → Add Domain (se não estiver na lista) → publique os registros DNS → Verify.`;
  }
  if (/\b535\b|invalid login|authentication failed|invalid api key|api key is invalid/i.test(text)) {
    return 'O provedor de e-mail recusou o login (SMTP_USER/SMTP_PASS). No Resend, o usuário é "resend" e a senha é a API key.';
  }
  if (/rate limit|too many requests|\b429\b/i.test(text)) {
    return 'O provedor de e-mail segurou os envios por excesso. Tente de novo em alguns minutos.';
  }
  if (/ETIMEDOUT|ECONNREFUSED|ENOTFOUND|ECONNRESET|EAI_AGAIN|greeting never received|connection timeout/i.test(text)) {
    return 'Não deu para conectar ao servidor de e-mail (confira SMTP_HOST e SMTP_PORT).';
  }
  return text || 'Falha ao enviar o e-mail.';
}

let cached: { key: string; transporter: Transporter } | null = null;

function getTransporter(config: SmtpConfig): Transporter {
  // Uma conexão por configuração: o pool sobrevive entre requisições da
  // mesma instância serverless, o que evita um handshake TLS por e-mail.
  const key = `${config.host}:${config.port}:${config.user ?? ''}`;
  if (cached?.key === key) return cached.transporter;

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
    pool: true,
    maxConnections: 2,
  });

  cached = { key, transporter };
  return transporter;
}

/** Só para os testes: esquece a conexão em cache. */
export function resetMailerCache() {
  cached = null;
}

/** Texto puro razoável a partir do HTML, para clientes que não renderizam. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h1|h2|h3|li)>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}

/**
 * Envia um e-mail transacional.
 *
 * Nunca lança: um e-mail que não sai não pode derrubar a operação que o
 * disparou (um convite gravado, um alerta calculado). Quem chama decide
 * se avisa a pessoa ou se apenas registra.
 */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const config = readSmtpConfig();
  if (!config) {
    return {
      ok: false,
      code: 'NOT_CONFIGURED',
      message: 'SMTP não configurado (defina SMTP_HOST e SMTP_FROM).',
    };
  }

  try {
    const info = await getTransporter(config).sendMail({
      from: config.from,
      to: Array.isArray(message.to) ? message.to.join(', ') : message.to,
      subject: message.subject,
      html: message.html,
      text: message.text ?? htmlToText(message.html),
      replyTo: message.replyTo ?? config.replyTo,
    });
    return { ok: true, messageId: info.messageId };
  } catch (e) {
    const raw = e instanceof Error ? e.message : 'Falha ao enviar o e-mail.';
    return { ok: false, code: 'SEND_FAILED', message: raw, hint: explainSendError(raw) };
  }
}
