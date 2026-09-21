// ============================================================
// Casa Quest — Lib: Modelos de e-mail
//
// HTML com estilo inline: cliente de e-mail não carrega folha de
// estilo e ignora boa parte do CSS moderno. Tudo aqui é puro
// (dados → string), então dá para testar sem tocar em SMTP.
// ============================================================

import type { AlertSeverity, AlertTip, GuardianSnapshot } from '@/domain/alerts/performance';
import { appTips, headlineFor, supportTips } from '@/domain/alerts/performance';

const BRAND = {
  indigo: '#4f46e5',
  ink: '#111827',
  muted: '#6b7280',
  line: '#e5e7eb',
  paper: '#ffffff',
  canvas: '#f9fafb',
};

/** Escapa o que vem do usuário (nomes de família, de guardião). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface LayoutOptions {
  /** Linha de prévia que a caixa de entrada mostra ao lado do assunto. */
  preheader: string;
  title: string;
  /** Blocos de HTML já montados. */
  body: string;
  cta?: { label: string; url: string };
  footer?: string;
}

function layout({ preheader, title, body, cta, footer }: LayoutOptions): string {
  const ctaBlock = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
                <tr><td style="border-radius:12px;background:${BRAND.indigo};">
                  <a href="${cta.url}" style="display:inline-block;padding:13px 22px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">${escapeHtml(cta.label)}</a>
                </td></tr>
              </table>
              <p style="margin:8px 0 0;font-size:12px;color:${BRAND.muted};word-break:break-all;">Se o botão não abrir, copie este endereço: ${cta.url}</p>`
    : '';

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.canvas};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.ink};">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.canvas};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.paper};border:1px solid ${BRAND.line};border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:#6366f1;padding:20px 24px;color:#ffffff;">
              <p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;">Casa Quest</p>
              <h1 style="margin:6px 0 0;font-size:20px;line-height:1.3;font-weight:700;">${escapeHtml(title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              ${body}
              ${ctaBlock}
            </td>
          </tr>
          <tr>
            <td style="border-top:1px solid ${BRAND.line};padding:16px 24px;font-size:12px;color:${BRAND.muted};">
              ${footer ?? 'Responsabilidade não se compra. Se cultiva.'}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function paragraph(html: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${BRAND.ink};">${html}</p>`;
}

function sectionTitle(text: string): string {
  return `<p style="margin:22px 0 10px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${BRAND.muted};">${escapeHtml(text)}</p>`;
}

function tipList(tips: AlertTip[]): string {
  const rows = tips
    .map(
      (t) => `<tr>
        <td style="padding:0 10px 12px 0;font-size:18px;line-height:1.4;vertical-align:top;">${t.icon}</td>
        <td style="padding:0 0 12px;font-size:14px;line-height:1.55;color:${BRAND.ink};vertical-align:top;">
          <strong style="display:block;">${escapeHtml(t.title)}</strong>
          <span style="color:${BRAND.muted};">${escapeHtml(t.text)}</span>
        </td>
      </tr>`
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
}

// ------------------------------------------------------------
// 1. Convite de Conselheiro(a)
// ------------------------------------------------------------

export interface AdvisorInviteInput {
  /** Nome de quem convidou. */
  inviterName: string;
  familyName: string;
  inviteeName: string;
  /** Link de aceite (define a senha e entra na família). */
  acceptUrl: string;
  /** Rótulo já flexionado: "Conselheira", "Conselheiro(a)". */
  roleLabel?: string;
}

export function advisorInviteEmail(input: AdvisorInviteInput): { subject: string; html: string } {
  const role = input.roleLabel ?? 'Conselheiro(a)';
  const body = [
    paragraph(
      `Oi, <strong>${escapeHtml(input.inviteeName)}</strong>! ${escapeHtml(input.inviterName)} convidou você para o conselho da família <strong>${escapeHtml(input.familyName)}</strong> no Casa Quest, como <strong>${escapeHtml(role)}</strong>.`
    ),
    paragraph(
      'O Casa Quest organiza as tarefas da casa em missões. Cada criança tem um link próprio, marca o que fez, e a constância vira uma energia de compromisso que orienta a mesada no fim do período.'
    ),
    sectionTitle('O que você vai poder fazer'),
    tipList([
      { icon: '✅', title: 'Confirmar ações', text: 'Ver o que cada guardião marcou como feito e confirmar.' },
      { icon: '⚠️', title: 'Registrar tropeços e extras', text: 'Anotar o que aconteceu no dia, para os dois lados.' },
      { icon: '⚡', title: 'Acompanhar a energia', text: 'Ver como está o compromisso de cada um na missão.' },
    ]),
    paragraph(
      'Clique no botão para criar sua senha e entrar. Sua conta já vem ligada à família — você não precisa cadastrar casa nenhuma. O link é pessoal, vale 14 dias e pode ser aberto de novo se algo der errado no meio do caminho.'
    ),
  ].join('');

  return {
    subject: `${input.inviterName} convidou você para a Casa Quest da família ${input.familyName}`,
    html: layout({
      preheader: `Aceite o convite e entre na família ${input.familyName} como ${role}.`,
      title: 'Bem-vindo ao conselho da casa',
      body,
      cta: { label: 'Criar minha senha e entrar', url: input.acceptUrl },
      footer: 'Se você não esperava este convite, é só ignorar este e-mail.',
    }),
  };
}

// ------------------------------------------------------------
// 2. Alerta de desempenho (≤ 70% da meta)
// ------------------------------------------------------------

export interface PerformanceAlertInput {
  familyName: string;
  missionName: string;
  snapshot: GuardianSnapshot;
  severity: AlertSeverity;
  thresholdPercent: number;
  /** Link do painel "Hoje". */
  dashboardUrl: string;
}

function statBlock(snapshot: GuardianSnapshot, thresholdPercent: number): string {
  const pct = Math.max(0, Math.min(100, Math.round(snapshot.percentage)));
  const bar = pct >= 70 ? '#f59e0b' : pct >= 50 ? '#fb923c' : '#ef4444';
  const cells: [string, string][] = [
    ['Energia', `${Math.round(snapshot.percentage)}%`],
    ['Feitas', String(snapshot.done)],
    ['Faltas', String(snapshot.missed)],
    ['Compensações', String(snapshot.recoveries)],
  ];
  const cellsHtml = cells
    .map(
      ([label, value]) =>
        `<td align="center" style="padding:6px 4px;">
                <div style="font-size:18px;font-weight:700;color:${BRAND.ink};">${escapeHtml(value)}</div>
                <div style="font-size:11px;color:${BRAND.muted};">${escapeHtml(label)}</div>
              </td>`
    )
    .join('');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.canvas};border:1px solid ${BRAND.line};border-radius:12px;padding:14px;">
    <tr>
      <td style="padding-bottom:10px;">
        <div style="height:10px;border-radius:999px;background:#e5e7eb;">
          <div style="height:10px;width:${pct}%;border-radius:999px;background:${bar};"></div>
        </div>
        <p style="margin:8px 0 0;font-size:12px;color:${BRAND.muted};">Meta da casa: ${thresholdPercent}% ou mais de energia.</p>
      </td>
    </tr>
    <tr><td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>${cellsHtml}</tr>
      </table>
    </td></tr>
  </table>`;
}

export function performanceAlertEmail(input: PerformanceAlertInput): {
  subject: string;
  html: string;
} {
  const { snapshot } = input;
  const firstName = snapshot.guardianName.split(' ')[0] ?? snapshot.guardianName;
  const rounded = Math.round(snapshot.percentage);

  const body = [
    paragraph(escapeHtml(headlineFor(snapshot, input.severity))),
    paragraph(
      `Na missão <strong>${escapeHtml(input.missionName)}</strong>, a energia de ${escapeHtml(firstName)} está em <strong>${rounded}%</strong> — igual ou abaixo dos ${input.thresholdPercent}% combinados na casa. Energia não é nota nem castigo: é o retrato de quanto do combinado está de pé.`
    ),
    statBlock(snapshot, input.thresholdPercent),
    sectionTitle('O que dá para fazer no app hoje'),
    tipList(appTips(snapshot)),
    sectionTitle('E fora do app, com a família'),
    tipList(supportTips()),
    paragraph(
      `<span style="color:${BRAND.muted};font-size:14px;">Este aviso é só para os adultos da casa. ${escapeHtml(firstName)} não recebe e não vê nenhum valor de mesada.</span>`
    ),
  ].join('');

  return {
    subject: `${firstName} está com ${rounded}% de energia na ${input.missionName}`,
    html: layout({
      preheader: `Um ajuste de rota para ${firstName} — dicas práticas no app e em casa.`,
      title: `Como está ${firstName} nesta missão`,
      body,
      cta: { label: 'Abrir o painel de hoje', url: input.dashboardUrl },
      footer: `Família ${escapeHtml(input.familyName)} · você recebe este aviso no máximo a cada poucos dias, e pode desligá-lo em Configurações.`,
    }),
  };
}
