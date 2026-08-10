// ============================================================
// Casa Quest — API: Missions
// POST /api/missions — Create a new mission
// ============================================================

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/infrastructure/supabase/server';
import { createMissionSchema } from '@/lib/validation';
import { ZodError } from 'zod';

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Não autenticado' } },
        { status: 403 }
      );
    }

    // Get user's guardian profile to find their family
    const { data: morGuardian } = await supabase
      .from('guardians')
      .select('family_id')
      .eq('user_id', user.id)
      .eq('is_mor', true)
      .single();

    if (!morGuardian) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Família não encontrada' } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const input = createMissionSchema.parse(body);

    // Create mission
    const { data: mission, error } = await supabase
      .from('missions')
      .insert({
        family_id: morGuardian.family_id,
        name: input.name,
        start_at: input.startAt,
        end_at: input.endAt,
        target_reward_amount: input.targetRewardAmount,
        status: 'draft',
      })
      .select()
      .single();

    if (error || !mission) {
      return NextResponse.json(
        { error: { code: 'INTERNAL', message: 'Erro ao criar missão' } },
        { status: 500 }
      );
    }

    // Get all active guardians in the family
    const { data: guardians } = await supabase
      .from('guardians')
      .select('id')
      .eq('family_id', morGuardian.family_id)
      .eq('is_active', true);

    if (guardians) {
      // Create mission_guardians entries
      const missionGuardians = guardians.map((g) => ({
        mission_id: mission.id,
        guardian_id: g.id,
        initial_energy: 100,
        current_energy: 100,
        target_reward: input.targetRewardAmount,
      }));

      await supabase.from('mission_guardians').insert(missionGuardians);

      // Create initial energy events for each guardian
      const energyEvents = guardians.map((g) => ({
        guardian_id: g.id,
        mission_id: mission.id,
        event_type: 'initial_energy',
        amount: 100,
        metadata: { reason: 'mission_start' },
        created_by: morGuardian.family_id,
      }));

      await supabase.from('energy_events').insert(energyEvents);
    }

    return NextResponse.json({ data: mission }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos', details: error.flatten() } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Erro interno' } },
      { status: 500 }
    );
  }
}
