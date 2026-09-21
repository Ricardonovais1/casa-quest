// ============================================================
// Casa Quest — API: Alerta de desempenho sob demanda
// POST /api/alerts/performance   { force?: boolean }
//
// A rotina roda sozinha no cron diário. Esta rota existe para o Mor
// conferir a configuração de SMTP sem esperar a madrugada: `force`
// ignora o intervalo entre avisos (e o desligamento) e manda agora.
// ============================================================

import { NextResponse } from 'next/server';
import { requireAdult, apiError } from '@/lib/require-mor';
import { runPerformanceAlerts } from '@/lib/performance-alerts';
import { isEmailConfigured } from '@/lib/email/mailer';

export const dynamic = 'force-dynamic';

const SKIP_MESSAGES: Record<string, string> = {
  email_not_configured:
    'SMTP não configurado. Defina SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS e SMTP_FROM.',
  migration_required: 'Aplique a migração 00010 (alertas) no Supabase.',
  history_unavailable: 'Não foi possível ler o histórico de alertas. Tente de novo.',
  no_mission: 'Nenhuma missão em andamento — não há energia para medir.',
  no_recipients: 'Nenhum adulto da casa tem e-mail cadastrado.',
  disabled: 'O alerta de desempenho está desligado em Configurações.',
  no_family: 'Família não encontrada.',
};

export async function POST(request: Request) {
  const auth = await requireAdult({ manage: true });
  if (!auth.ok) return auth.response;
  const { db, me } = auth.ctx;

  if (!isEmailConfigured()) {
    return apiError('EMAIL_NOT_CONFIGURED', SKIP_MESSAGES.email_not_configured!, 503);
  }

  const body = (await request.json().catch(() => null)) as { force?: boolean } | null;

  const summary = await runPerformanceAlerts(db, me.family_id, {
    request,
    force: body?.force === true,
  });

  return NextResponse.json({
    data: {
      ...summary,
      message: summary.skipped
        ? SKIP_MESSAGES[summary.skipped] ?? 'Nada a enviar agora.'
        : summary.sent > 0
          ? `${summary.sent} alerta${summary.sent === 1 ? '' : 's'} enviado${summary.sent === 1 ? '' : 's'} para os adultos da casa.`
          : 'Nenhum guardião está abaixo da meta agora — nada foi enviado.',
    },
  });
}
