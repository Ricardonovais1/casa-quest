// ============================================================
// Casa Quest — Domain: Alerta de desempenho
//
// Quando um guardião fica em 70% da meta ou abaixo, os adultos da casa
// recebem um e-mail. A regra é pura: recebe o retrato do guardião e o
// histórico de avisos, devolve se avisa agora e o que dizer.
//
// O alerta é sobre ritmo, não sobre culpa: quem lê precisa sair do
// e-mail sabendo o que fazer hoje, no app e fora dele.
// ZERO I/O.
// ============================================================

export const DEFAULT_ALERT_THRESHOLD = 70;
/** Dias mínimos entre dois alertas do mesmo guardião na mesma missão. */
export const DEFAULT_ALERT_COOLDOWN_DAYS = 3;

export interface GuardianSnapshot {
  guardianId: string;
  guardianName: string;
  /** Energia atual em % da meta (100 = meta cheia). Pode passar de 100. */
  percentage: number;
  missed: number;
  done: number;
  recoveries: number;
  streakDays: number;
}

export interface AlertDecisionInput {
  snapshot: GuardianSnapshot;
  /** ISO do último alerta enviado para este guardião nesta missão. */
  lastAlertAt?: string | null;
  thresholdPercent?: number;
  cooldownDays?: number;
  now?: Date;
}

export type AlertDecision =
  | { alert: true; severity: AlertSeverity }
  | { alert: false; reason: 'above_threshold' | 'cooldown' };

export type AlertSeverity = 'atencao' | 'recuperacao' | 'critico';

/**
 * Faixa do aviso. Quanto mais longe da meta, mais direto o texto — mas
 * nunca punitivo: o guardião não lê este e-mail.
 *   ≤ 70% → atenção · ≤ 50% → recuperação · ≤ 30% → crítico
 */
export function severityFor(percentage: number): AlertSeverity {
  if (percentage <= 30) return 'critico';
  if (percentage <= 50) return 'recuperacao';
  return 'atencao';
}

/** Avisa agora? Só abaixo da meta e respeitando o intervalo entre avisos. */
export function decideAlert({
  snapshot,
  lastAlertAt,
  thresholdPercent = DEFAULT_ALERT_THRESHOLD,
  cooldownDays = DEFAULT_ALERT_COOLDOWN_DAYS,
  now = new Date(),
}: AlertDecisionInput): AlertDecision {
  if (snapshot.percentage > thresholdPercent) {
    return { alert: false, reason: 'above_threshold' };
  }

  if (lastAlertAt) {
    const elapsedMs = now.getTime() - Date.parse(lastAlertAt);
    if (Number.isFinite(elapsedMs) && elapsedMs < cooldownDays * 86_400_000) {
      return { alert: false, reason: 'cooldown' };
    }
  }

  return { alert: true, severity: severityFor(snapshot.percentage) };
}

/** Uma frase honesta sobre o ritmo, sem rótulo em cima da criança. */
export function headlineFor(snapshot: GuardianSnapshot, severity: AlertSeverity): string {
  const name = snapshot.guardianName.split(' ')[0] ?? snapshot.guardianName;
  switch (severity) {
    case 'critico':
      return `O ritmo de ${name} caiu bastante nesta missão — dá para virar o jogo, e ainda há tempo.`;
    case 'recuperacao':
      return `${name} está bem abaixo do combinado nesta missão. É hora de reaproximar, não de cobrar.`;
    default:
      return `${name} está um pouco abaixo do combinado. Um ajuste pequeno agora evita uma bola de neve.`;
  }
}

export interface AlertTip {
  icon: string;
  title: string;
  text: string;
}

/**
 * Dicas de uso do app. Saem do retrato do guardião: quem tem faltas
 * acumuladas precisa de missão extra; quem nunca faz uma escalada
 * precisa de um caminho para ganhar tração.
 */
export function appTips(snapshot: GuardianSnapshot): AlertTip[] {
  const name = snapshot.guardianName.split(' ')[0] ?? snapshot.guardianName;
  const tips: AlertTip[] = [];

  if (snapshot.missed > snapshot.recoveries) {
    tips.push({
      icon: '🏆',
      title: 'Registre missões extras',
      text: `${name} tem ${snapshot.missed} falta${snapshot.missed === 1 ? '' : 's'} e ${snapshot.recoveries} compensação${snapshot.recoveries === 1 ? '' : 'ões'}. Combine uma tarefa maior — lavar o carro, cuidar do jardim, ajudar numa refeição — e registre em "Hoje". Cada missão extra devolve energia e mostra que dá para recuperar.`,
    });
  }

  tips.push({
    icon: '🎯',
    title: 'Comece pequeno para recuperar tração',
    text: 'Uma sequência curta de acertos vale mais que um dia perfeito. Escolha duas ou três ações do dia e garanta essas primeiro; o resto vem junto quando a constância volta.',
  });

  if (snapshot.streakDays <= 1) {
    tips.push({
      icon: '⏰',
      title: 'Revise as ações e os horários',
      text: 'Em "Ações", veja se alguma tarefa está com hora marcada num momento impossível do dia. Ação sem hora vale o dia todo e só fecha no fim do dia — costuma ser mais justo com a rotina real.',
    });
  }

  tips.push({
    icon: '⬆️',
    title: 'Reconheça o que foi além',
    text: 'Gentilezas, estudo e iniciativas fora do combinado também entram como missão extra e somam energia. Registrar o que deu certo muda o tom da conversa.',
  });

  return tips;
}

/** Orientações de apoio — o que fazer fora do app, com a família. */
export function supportTips(): AlertTip[] {
  return [
    {
      icon: '🗓️',
      title: 'Revisem a rotina juntos',
      text: 'Sente com a criança e leiam a lista do dia lado a lado. Pergunte o que está difícil de encaixar. Muitas faltas são de agenda, não de vontade.',
    },
    {
      icon: '👨‍👩‍👧',
      title: 'Alinhem os horários da casa',
      text: 'Combine com o outro adulto quando cada tarefa acontece — banho, lição, jantar. Regra que muda de adulto para adulto vira falta sem culpa de ninguém.',
    },
    {
      icon: '👂',
      title: 'Escuta ativa antes da cobrança',
      text: 'Comece por "como foi sua semana?" em vez de "por que você não fez?". Ouça até o fim, repita o que entendeu e só então proponham juntos o próximo passo.',
    },
    {
      icon: '🌱',
      title: 'Elogie o processo, não o resultado',
      text: 'Reconheça o esforço e a retomada ("você voltou a arrumar a cama três dias seguidos"). Responsabilidade não se compra: se cultiva.',
    },
  ];
}
