// ============================================================
// Casa Quest — API: Guardian marks an action as done (token auth)
// POST /api/g/[token]/actions/[id]/mark-done
//
// Guardiões acessam por link, sem sessão do Supabase — por isso esta
// rota autentica pelo token e usa o service client. A autorização é
// feita aqui: só a ação do próprio guardião pode ser marcada.
// ============================================================

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/infrastructure/supabase/server';
import { resolveGuardianToken } from '@/lib/guardian-token';
import { markActionDone } from '@/lib/mark-action-done';

const STATUS_BY_CODE: Record<string, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  ALREADY_PROCESSED: 422,
  INTERNAL: 500,
};

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  try {
    const { token, id } = await params;
    const supabase = await createServiceClient();

    const auth = await resolveGuardianToken(supabase, token);
    if (!auth.ok) {
      return NextResponse.json(
        {
          error:
            auth.reason === 'expired'
              ? { code: 'TOKEN_EXPIRED', message: 'Seu link expirou. Peça um novo ao Guardião-Mor.' }
              : { code: 'INVALID_TOKEN', message: 'Link inválido.' },
        },
        { status: auth.reason === 'expired' ? 410 : 404 }
      );
    }

    const result = await markActionDone(supabase, id, auth.guardian.id);

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
