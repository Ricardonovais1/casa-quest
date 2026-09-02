// ============================================================
// Casa Quest — API: Daily cron
// GET /api/cron/daily   (Vercel Cron → Authorization: Bearer CRON_SECRET)
//
// Roda de madrugada para toda família com missão ativa: gera as ações
// do dia, registra faltas do dia anterior e encerra missões vencidas.
// Também mantém o banco "acordado" (Supabase pausa projetos ociosos).
// ============================================================

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/infrastructure/supabase/server';
import { syncFamilyDay } from '@/lib/daily-actions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: { code: 'NOT_CONFIGURED', message: 'CRON_SECRET não definido' } },
      { status: 500 }
    );
  }

  const header = request.headers.get('authorization') ?? '';
  if (header !== `Bearer ${secret}`) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Não autorizado' } },
      { status: 401 }
    );
  }

  const db = await createServiceClient();
  const { data: missions, error } = await db
    .from('missions')
    .select('family_id')
    .eq('status', 'active');

  if (error) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 }
    );
  }

  const familyIds = Array.from(new Set((missions ?? []).map((m) => m.family_id)));
  const results = [];
  for (const familyId of familyIds) {
    try {
      results.push(await syncFamilyDay(db, familyId));
    } catch (e) {
      results.push({ familyId, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({ data: { families: familyIds.length, results } });
}
