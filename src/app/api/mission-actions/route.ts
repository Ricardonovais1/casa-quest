// ============================================================
// Casa Quest — API: um adulto registra um evento extra
// POST /api/mission-actions   { guardianId, templateId, kind }
//
//   tropeco — algo que deixou de fazer (categoria "tropecos") → falta.
//             Registro e edição são exclusivos dos adultos da casa.
//   extra   — missão extra: fez além do combinado. O efeito (compensar
//             uma falta ou somar energia) sai da categoria da ação.
//
// `recovery` e `escalada` continuam aceitos como apelidos de `extra`,
// para telas antigas que ainda mandem o vocabulário anterior.
// ============================================================

import { NextResponse } from 'next/server';
import { requireAdult, apiError } from '@/lib/require-mor';
import { notifyFamilyChanged } from '@/lib/realtime';
import { isChild } from '@/lib/roles';
import { normalizeKind, registerExtraEvent } from '@/lib/extra-events';

const STATUS_BY_CODE: Record<string, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  NO_MISSION: 422,
  VALIDATION_ERROR: 422,
  DB_ERROR: 500,
};

export async function POST(request: Request) {
  const auth = await requireAdult();
  if (!auth.ok) return auth.response;
  const { db, me } = auth.ctx;

  const body = (await request.json().catch(() => null)) as
    | { guardianId?: string; templateId?: string; kind?: string }
    | null;

  const kind = normalizeKind(body?.kind);
  if (!body?.guardianId || !body?.templateId || !kind) {
    return apiError('VALIDATION_ERROR', 'Informe guardião, ação e tipo', 400);
  }

  const { data: guardian } = await db
    .from('guardians')
    .select('*')
    .eq('id', body.guardianId)
    .eq('family_id', me.family_id)
    .maybeSingle();

  if (!guardian || !isChild(guardian)) {
    return apiError('NOT_FOUND', 'Guardião não encontrado', 404);
  }

  const result = await registerExtraEvent(db, {
    familyId: me.family_id,
    guardianId: guardian.id,
    templateId: body.templateId,
    kind,
    recordedByGuardianId: me.id,
  });

  if (!result.ok) {
    return apiError(result.code, result.message, STATUS_BY_CODE[result.code] ?? 500);
  }

  await notifyFamilyChanged(me.family_id, 'actions');

  return NextResponse.json(
    { data: { id: result.id, kind, effect: result.effect, name: result.name } },
    { status: 201 }
  );
}
