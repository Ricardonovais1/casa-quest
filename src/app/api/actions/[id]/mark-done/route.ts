// ============================================================
// Casa Quest — API: Mark Action as Done (session auth)
// POST /api/actions/[id]/mark-done
//
// Para quem tem sessão do Supabase (o Guardião-Mor). Guardiões que
// entram por link usam /api/g/[token]/actions/[id]/mark-done.
// ============================================================

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/infrastructure/supabase/server';
import { markActionDone } from '@/lib/mark-action-done';

const STATUS_BY_CODE: Record<string, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  ALREADY_PROCESSED: 422,
  INTERNAL: 500,
};

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Resolve the caller's own guardian record; markActionDone then checks the
    // action actually belongs to them.
    const { data: guardian } = await supabase
      .from('guardians')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!guardian) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Guardião não encontrado' } },
        { status: 403 }
      );
    }

    const result = await markActionDone(supabase, id, guardian.id);

    if (!result.ok) {
      return NextResponse.json(
        { error: { code: result.code, message: result.message } },
        { status: STATUS_BY_CODE[result.code] ?? 500 }
      );
    }

    return NextResponse.json({
      data: {
        id,
        status: result.status,
        isLate: result.isLate,
        needsConfirmation: result.needsConfirmation,
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Erro interno' } },
      { status: 500 }
    );
  }
}
