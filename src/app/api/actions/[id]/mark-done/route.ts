// ============================================================
// Casa Quest — API: Mark Action as Done
// POST /api/actions/[id]/mark-done
// ============================================================

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/infrastructure/supabase/server';
import { markActionSchema } from '@/lib/validation';
import { ZodError } from 'zod';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Não autenticado' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const input = markActionSchema.parse(body);

    // Get the mission action
    const { data: missionAction, error: actionError } = await supabase
      .from('mission_actions')
      .select('*, mission_id, guardian_id, action_template_id')
      .eq('id', id)
      .single();

    if (actionError || !missionAction) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Ação não encontrada' } },
        { status: 404 }
      );
    }

    // Verify the user is the action owner
    const { data: guardian } = await supabase
      .from('guardians')
      .select('id')
      .eq('user_id', user.id)
      .eq('id', missionAction.guardian_id)
      .single();

    if (!guardian) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Você não pode marcar esta ação' } },
        { status: 403 }
      );
    }

    // Verify action is pending
    if (missionAction.status !== 'pending') {
      return NextResponse.json(
        { error: { code: 'BUSINESS_RULE_ERROR', message: 'Ação já foi processada' } },
        { status: 422 }
      );
    }

    // Check if within tolerance (recalculable at query time)
    const now = new Date();
    const isLate = now > new Date(missionAction.due_at);

    // Get the action template's confirmation mode
    const { data: template } = await supabase
      .from('action_templates')
      .select('confirmation_mode')
      .eq('id', missionAction.action_template_id)
      .single();

    const confirmationMode = template?.confirmation_mode || 'none';

    // If no confirmation needed, auto-confirm
    if (confirmationMode === 'none') {
      const { error: updateError } = await supabase
        .from('mission_actions')
        .update({
          status: 'confirmed',
          completed_at: now.toISOString(),
          confirmation_status: 'not_required',
        })
        .eq('id', id);

      if (updateError) {
        return NextResponse.json(
          { error: { code: 'INTERNAL', message: 'Erro ao atualizar ação' } },
          { status: 500 }
        );
      }
    } else {
      // Mark as done, needs confirmation
      const { error: updateError } = await supabase
        .from('mission_actions')
        .update({
          status: 'marked_done',
          confirmation_status: 'pending',
        })
        .eq('id', id);

      if (updateError) {
        return NextResponse.json(
          { error: { code: 'INTERNAL', message: 'Erro ao atualizar ação' } },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      data: {
        id,
        status: confirmationMode === 'none' ? 'confirmed' : 'marked_done',
        isLate,
        needsConfirmation: confirmationMode !== 'none',
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos' } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Erro interno' } },
      { status: 500 }
    );
  }
}
