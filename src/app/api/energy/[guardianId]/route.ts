// ============================================================
// Casa Quest — API: Calculate Guardian Energy
// GET /api/energy/[guardianId]?missionId=xxx
// ============================================================

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/infrastructure/supabase/server';
import { getGuardianEnergy } from '@/lib/guardian-energy';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ guardianId: string }> }
) {
  try {
    const { guardianId } = await params;
    const { searchParams } = new URL(request.url);
    const missionId = searchParams.get('missionId');

    if (!missionId) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'missionId é obrigatório' } },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Não autenticado' } },
        { status: 401 }
      );
    }

    const { data: guardian } = await supabase
      .from('guardians')
      .select('family_id')
      .eq('id', guardianId)
      .single();

    if (!guardian) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Guardião não encontrado' } },
        { status: 404 }
      );
    }

    const { data: mission } = await supabase
      .from('missions')
      .select('start_at')
      .eq('id', missionId)
      .single();

    if (!mission) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Missão não encontrada' } },
        { status: 404 }
      );
    }

    const energy = await getGuardianEnergy(
      supabase,
      guardianId,
      missionId,
      guardian.family_id,
      new Date(mission.start_at)
    );

    return NextResponse.json({ data: energy });
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Erro ao calcular energia' } },
      { status: 500 }
    );
  }
}
