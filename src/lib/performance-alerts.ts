// ============================================================
// Casa Quest — Lib: Rotina do alerta de desempenho
//
// Varre os guardiões de uma família com missão em andamento e avisa os
// adultos por e-mail quando alguém está com a energia igual ou abaixo
// da meta da casa (70% por padrão).
//
// A decisão é do domínio (`domain/alerts/performance`); aqui é só I/O:
// buscar energia, achar os destinatários, mandar e registrar o envio —
// o registro é o que impede o mesmo aviso de sair todo dia.
//
// Roda no cron diário e sob demanda pela rota /api/alerts/performance.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_ALERT_COOLDOWN_DAYS,
  DEFAULT_ALERT_THRESHOLD,
  decideAlert,
  type GuardianSnapshot,
} from '@/domain/alerts/performance';
import { getGuardianEnergy } from './guardian-energy';
import { isAdult, isChild } from './roles';
import { sendEmail, isEmailConfigured } from './email/mailer';
import { performanceAlertEmail } from './email/templates';
import { appUrl } from './app-url';

export interface AlertOutcome {
  guardianId: string;
  guardianName: string;
  percentage: number;
  status: 'sent' | 'failed' | 'skipped';
  reason?: string;
}

export interface AlertRunSummary {
  familyId: string;
  checked: number;
  sent: number;
  outcomes: AlertOutcome[];
  /** Por que a família inteira foi pulada, quando foi. */
  skipped?:
    | 'no_mission'
    | 'no_family'
    | 'disabled'
    | 'no_recipients'
    | 'email_not_configured'
    | 'migration_required'
    | 'history_unavailable';
}

function emptyRun(familyId: string, skipped: AlertRunSummary['skipped']): AlertRunSummary {
  return { familyId, checked: 0, sent: 0, outcomes: [], skipped };
}

type AlertHistory =
  | { ok: true; last: Map<string, string> }
  | { ok: false; reason: 'migration_required' | 'history_unavailable' };

/**
 * Último alerta de cada guardião nesta missão que realmente chegou.
 *
 * Sem esse histórico não dá para saber o que já foi avisado, e mandar o
 * mesmo e-mail todo dia seria pior que ficar quieto — então qualquer
 * falha de leitura cancela a rodada em vez de arriscar o spam.
 *
 * Só conta o que foi entregue: uma tentativa que falhou (cota do
 * provedor estourada, senha errada, provedor fora do ar) não pode
 * iniciar o intervalo de silêncio e engolir o aviso por três dias. A
 * linha da falha continua na tabela, para diagnóstico, e a rodada do
 * dia seguinte tenta de novo.
 */
async function loadLastAlerts(
  db: SupabaseClient,
  missionId: string
): Promise<AlertHistory> {
  const { data, error } = await db
    .from('performance_alerts')
    .select('guardian_id, created_at')
    .eq('mission_id', missionId)
    .eq('delivered', true)
    .order('created_at', { ascending: false });

  if (error) {
    // 42P01 = relação inexistente (migração 00010 ainda não aplicada).
    return { ok: false, reason: error.code === '42P01' ? 'migration_required' : 'history_unavailable' };
  }

  const last = new Map<string, string>();
  for (const row of data ?? []) {
    if (!last.has(row.guardian_id)) last.set(row.guardian_id, row.created_at);
  }
  return { ok: true, last };
}

/**
 * Roda a checagem para uma família. Não lança: um e-mail que não sai não
 * pode derrubar o cron nem a rota que chamou.
 */
export async function runPerformanceAlerts(
  db: SupabaseClient,
  familyId: string,
  options: { now?: Date; request?: Request | null; force?: boolean } = {}
): Promise<AlertRunSummary> {
  const now = options.now ?? new Date();

  if (!isEmailConfigured()) return emptyRun(familyId, 'email_not_configured');

  // select('*') para seguir funcionando antes da migração 00010.
  const { data: family } = await db.from('families').select('*').eq('id', familyId).maybeSingle();
  if (!family) return emptyRun(familyId, 'no_family');

  const enabled = family.performance_alerts_enabled !== false;
  if (!enabled && !options.force) return emptyRun(familyId, 'disabled');

  const threshold = Number(family.performance_alert_threshold ?? DEFAULT_ALERT_THRESHOLD);

  const { data: mission } = await db
    .from('missions')
    .select('id, name, start_at')
    .eq('family_id', familyId)
    .eq('status', 'active')
    .order('start_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!mission) return emptyRun(familyId, 'no_mission');

  const { data: members } = await db
    .from('guardians')
    .select('*')
    .eq('family_id', familyId)
    .eq('is_active', true);

  const recipients = (members ?? [])
    .filter((g) => isAdult(g) && typeof g.email === 'string' && g.email.includes('@'))
    .map((g) => g.email as string);
  if (recipients.length === 0) return emptyRun(familyId, 'no_recipients');

  const history = await loadLastAlerts(db, mission.id);
  if (!history.ok) return emptyRun(familyId, history.reason);
  const lastAlerts = history.last;

  const kids = (members ?? []).filter(isChild);
  const dashboardUrl = `${appUrl(options.request)}/dashboard/hoje`;
  const missionStart = new Date(`${mission.start_at}T12:00:00Z`);

  const outcomes: AlertOutcome[] = [];
  let sent = 0;

  for (const kid of kids) {
    let snapshot: GuardianSnapshot;
    try {
      const energy = await getGuardianEnergy(db, kid.id, mission.id, familyId, missionStart, now);
      snapshot = {
        guardianId: kid.id,
        guardianName: kid.name,
        percentage: energy.percentage,
        missed: energy.counts.missed,
        done: energy.counts.done,
        recoveries: energy.counts.recoveries,
        streakDays: energy.streakDays,
      };
    } catch (e) {
      outcomes.push({
        guardianId: kid.id,
        guardianName: kid.name,
        percentage: 0,
        status: 'skipped',
        reason: e instanceof Error ? e.message : 'Falha ao calcular a energia',
      });
      continue;
    }

    const decision = decideAlert({
      snapshot,
      lastAlertAt: options.force ? null : lastAlerts.get(kid.id),
      thresholdPercent: threshold,
      cooldownDays: DEFAULT_ALERT_COOLDOWN_DAYS,
      now,
    });

    if (!decision.alert) {
      outcomes.push({
        guardianId: kid.id,
        guardianName: kid.name,
        percentage: snapshot.percentage,
        status: 'skipped',
        reason: decision.reason,
      });
      continue;
    }

    const { subject, html } = performanceAlertEmail({
      familyName: family.name,
      missionName: mission.name,
      snapshot,
      severity: decision.severity,
      thresholdPercent: threshold,
      dashboardUrl,
    });

    const result = await sendEmail({ to: recipients, subject, html });

    await db.from('performance_alerts').insert({
      family_id: familyId,
      guardian_id: kid.id,
      mission_id: mission.id,
      energy_percentage: Math.round(snapshot.percentage),
      threshold_percentage: threshold,
      severity: decision.severity,
      recipients,
      delivered: result.ok,
      error: result.ok ? null : result.message,
    });

    if (result.ok) sent++;
    outcomes.push({
      guardianId: kid.id,
      guardianName: kid.name,
      percentage: snapshot.percentage,
      status: result.ok ? 'sent' : 'failed',
      reason: result.ok ? undefined : result.message,
    });
  }

  return { familyId, checked: kids.length, sent, outcomes };
}
