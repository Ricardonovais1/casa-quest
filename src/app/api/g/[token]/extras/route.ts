// ============================================================
// Casa Quest — API: o guardião registra a própria missão extra
// POST /api/g/[token]/extras   { templateId }
//
// Autonomia: quem fez algo a mais registra na hora, pelo próprio link,
// sem esperar um adulto aprovar. É o que faz a criança voltar ao app
// depois de uma falta — a recuperação está na mão dela.
//
// A trava fica no tipo: só categorias de "missão extra" passam por
// aqui. Tropeço continua exclusivo dos adultos da casa.
// ============================================================

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/infrastructure/supabase/server';
import { resolveGuardianToken } from '@/lib/guardian-token';
import { registerExtraEvent } from '@/lib/extra-events';
import { notifyFamilyChanged } from '@/lib/realtime';

const STATUS_BY_CODE: Record<string, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  NO_MISSION: 422,
  VALIDATION_ERROR: 422,
  DB_ERROR: 500,
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const db = await createServiceClient();

    const auth = await resolveGuardianToken(db, token);
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

    const body = (await request.json().catch(() => null)) as { templateId?: string } | null;
    if (!body?.templateId) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Escolha o que você fez.' } },
        { status: 400 }
      );
    }

    const result = await registerExtraEvent(db, {
      familyId: auth.guardian.family_id,
      guardianId: auth.guardian.id,
      templateId: body.templateId,
      // Nunca 'tropeco': o guardião não registra falta contra si nem contra ninguém.
      kind: 'extra',
      recordedByGuardianId: auth.guardian.id,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: { code: result.code, message: result.message } },
        { status: STATUS_BY_CODE[result.code] ?? 500 }
      );
    }

    // O painel dos adultos vê o registro na hora.
    await notifyFamilyChanged(auth.guardian.family_id, 'actions');

    return NextResponse.json(
      { data: { id: result.id, effect: result.effect, name: result.name } },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Erro interno' } },
      { status: 500 }
    );
  }
}
