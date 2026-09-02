// ============================================================
// Casa Quest — API: Missions
// POST /api/missions — Create a new mission (draft)
// ============================================================

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { requireMor, apiError } from '@/lib/require-mor';
import { createMissionSchema } from '@/lib/validation';

export async function POST(request: Request) {
  const auth = await requireMor();
  if (!auth.ok) return auth.response;
  const { db, mor } = auth.ctx;

  try {
    const body = await request.json();
    const input = createMissionSchema.parse(body);

    const { data: mission, error } = await db
      .from('missions')
      .insert({
        family_id: mor.family_id,
        name: input.name,
        start_at: input.startAt.slice(0, 10),
        end_at: input.endAt.slice(0, 10),
        target_reward_amount: input.targetRewardAmount,
        status: 'draft',
      })
      .select()
      .single();

    if (error || !mission) {
      return apiError('DB_ERROR', error?.message || 'Erro ao criar missão', 500);
    }

    // Per-guardian rows are created on activation (see PATCH /api/missions/[id]),
    // so a draft can still gain or lose guardians before it starts.
    return NextResponse.json({ data: mission }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos', details: error.flatten() } },
        { status: 400 }
      );
    }
    return apiError('INTERNAL', 'Erro interno', 500);
  }
}
