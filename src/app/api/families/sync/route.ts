// ============================================================
// Casa Quest — API: Sync the family's day
// POST /api/families/sync
//
// Gera as ações de hoje, marca faltas vencidas e encerra a missão se
// o período acabou. O painel chama ao abrir; o cron chama de madrugada.
// ============================================================

import { NextResponse } from 'next/server';
import { requireAdult, apiError } from '@/lib/require-mor';
import { syncFamilyDay } from '@/lib/daily-actions';

export async function POST() {
  const auth = await requireAdult();
  if (!auth.ok) return auth.response;

  try {
    const summary = await syncFamilyDay(auth.ctx.db, auth.ctx.me.family_id);
    return NextResponse.json({ data: summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao sincronizar o dia';
    return apiError('INTERNAL', message, 500);
  }
}
