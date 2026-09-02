// ============================================================
// Casa Quest — API: Mor records an extra event for a guardian
// POST /api/mission-actions   { guardianId, templateId, kind }
//
//   tropeco  — algo que deixou de fazer (categoria "tropecos") → falta
//   recovery — missão extra que compensa uma falta (categoria "missoes")
//   escalada — foi além (gentilezas, autoaperfeiçoamento, escola)
// ============================================================

import { NextResponse } from 'next/server';
import { requireMor, apiError } from '@/lib/require-mor';

const KINDS = ['tropeco', 'recovery', 'escalada'] as const;
type Kind = (typeof KINDS)[number];

const KIND_CATEGORIES: Record<Kind, string[]> = {
  tropeco: ['tropecos'],
  recovery: ['missoes'],
  escalada: ['gentilezas', 'autoaperfeicoamento', 'rendimento_escolar'],
};

export async function POST(request: Request) {
  const auth = await requireMor();
  if (!auth.ok) return auth.response;
  const { db, mor } = auth.ctx;

  const body = (await request.json().catch(() => null)) as
    | { guardianId?: string; templateId?: string; kind?: string }
    | null;

  const kind = body?.kind as Kind | undefined;
  if (!body?.guardianId || !body?.templateId || !kind || !KINDS.includes(kind)) {
    return apiError('VALIDATION_ERROR', 'Informe guardião, ação e tipo', 400);
  }

  const [{ data: guardian }, { data: template }, { data: mission }] = await Promise.all([
    db
      .from('guardians')
      .select('id')
      .eq('id', body.guardianId)
      .eq('family_id', mor.family_id)
      .eq('is_mor', false)
      .maybeSingle(),
    db
      .from('action_templates')
      .select('id, category, points, escalada_base_points, name')
      .eq('id', body.templateId)
      .eq('family_id', mor.family_id)
      .maybeSingle(),
    db
      .from('missions')
      .select('id')
      .eq('family_id', mor.family_id)
      .eq('status', 'active')
      .order('start_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!guardian) return apiError('NOT_FOUND', 'Guardião não encontrado', 404);
  if (!template) return apiError('NOT_FOUND', 'Ação não encontrada', 404);
  if (!mission) {
    return apiError('NO_MISSION', 'Inicie uma missão antes de registrar eventos', 422);
  }
  if (!KIND_CATEGORIES[kind].includes(template.category)) {
    return apiError('VALIDATION_ERROR', 'Essa ação não é desse tipo', 422);
  }

  const now = new Date().toISOString();
  const base = {
    mission_id: mission.id,
    guardian_id: guardian.id,
    action_template_id: template.id,
    due_at: now,
  };

  let row: Record<string, unknown>;

  if (kind === 'tropeco') {
    row = { ...base, status: 'missed', missed_at: now, confirmation_status: 'not_required' };
  } else if (kind === 'recovery') {
    // Link to the most recent miss that nothing has compensated yet.
    const { data: misses } = await db
      .from('mission_actions')
      .select('id')
      .eq('mission_id', mission.id)
      .eq('guardian_id', guardian.id)
      .eq('status', 'missed')
      .order('missed_at', { ascending: false })
      .limit(50);
    const { data: alreadyRecovered } = await db
      .from('mission_actions')
      .select('recovers_action_id')
      .eq('mission_id', mission.id)
      .eq('guardian_id', guardian.id)
      .not('recovers_action_id', 'is', null);
    const taken = new Set((alreadyRecovered ?? []).map((r) => r.recovers_action_id));
    const target = (misses ?? []).find((m) => !taken.has(m.id));

    row = {
      ...base,
      status: 'confirmed',
      completed_at: now,
      confirmation_status: 'not_required',
      recovers_action_id: target?.id ?? null,
    };
  } else {
    const points = template.points > 0 ? template.points : template.escalada_base_points || 2;
    row = {
      ...base,
      status: 'confirmed',
      completed_at: now,
      confirmation_status: 'not_required',
      escalada_points_earned: points,
    };
  }

  const { data, error } = await db.from('mission_actions').insert(row).select('id').single();
  if (error) return apiError('DB_ERROR', error.message, 500);

  return NextResponse.json({ data: { id: data.id, kind, name: template.name } }, { status: 201 });
}
