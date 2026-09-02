// ============================================================
// Casa Quest — API: Distribution of collaborative actions
// GET  /api/families/distribution           → current period (generates if missing)
// POST /api/families/distribution { mode }  → 'auto' (force regenerate)
//                                             'manual' (save explicit assignments)
//                                             'interval' (change rotation months)
//
// Roda no servidor com a service role (depois de autorizar o Mor): a
// tabela action_assignments é protegida por RLS e o navegador não deve
// depender de política para gerar a rodada.
// ============================================================

import { NextResponse } from 'next/server';
import { requireAdult, apiError } from '@/lib/require-mor';
import {
  ensureCurrentDistribution,
  computePeriod,
  getCurrentAssignments,
} from '@/lib/distribution';
import { ROTATION_INTERVAL_OPTIONS } from '@/lib/constants';
import { isChild } from '@/lib/roles';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdult();
  if (!auth.ok) return auth.response;
  const { db, mor } = auth.ctx;

  const { assignments, generated } = await ensureCurrentDistribution(db, mor.family_id);
  return NextResponse.json({ data: { assignments, generated } });
}

interface ManualBody {
  mode: 'manual';
  assignments: { templateId: string; guardianId: string }[];
}
interface AutoBody {
  mode: 'auto';
}
interface IntervalBody {
  mode: 'interval';
  intervalMonths: number;
}

export async function POST(request: Request) {
  const auth = await requireAdult({ manage: true });
  if (!auth.ok) return auth.response;
  const { db, mor } = auth.ctx;

  const body = (await request.json().catch(() => null)) as ManualBody | AutoBody | IntervalBody | null;
  if (!body?.mode) return apiError('VALIDATION_ERROR', 'Informe o modo', 400);

  if (body.mode === 'interval') {
    const months = Number(body.intervalMonths);
    if (!(ROTATION_INTERVAL_OPTIONS as readonly number[]).includes(months)) {
      return apiError('VALIDATION_ERROR', 'Intervalo inválido', 400);
    }
    const { error } = await db
      .from('families')
      .update({ rotation_interval_months: months })
      .eq('id', mor.family_id);
    if (error) return apiError('DB_ERROR', error.message, 500);
    return NextResponse.json({ data: { intervalMonths: months } });
  }

  if (body.mode === 'auto') {
    const { assignments } = await ensureCurrentDistribution(db, mor.family_id, {
      force: true,
      seed: Math.floor(Math.random() * 100000),
    });
    return NextResponse.json({ data: { assignments } });
  }

  if (body.mode === 'manual') {
    const wanted = Array.isArray(body.assignments) ? body.assignments : [];

    // Only this family's active collaborative templates and active guardians.
    const [{ data: templates }, { data: guardians }, { data: family }] = await Promise.all([
      db
        .from('action_templates')
        .select('id')
        .eq('family_id', mor.family_id)
        .eq('category', 'cooperacao')
        .eq('is_active', true),
      db
        .from('guardians')
        .select('*')
        .eq('family_id', mor.family_id)
        .eq('is_active', true),
      db.from('families').select('rotation_interval_months').eq('id', mor.family_id).single(),
    ]);
    const templateIds = new Set((templates ?? []).map((t) => t.id));
    const guardianIds = new Set((guardians ?? []).filter(isChild).map((g) => g.id));

    const rows = wanted.filter((a) => templateIds.has(a.templateId) && guardianIds.has(a.guardianId));
    const { validFrom, validUntil } = computePeriod(family?.rotation_interval_months ?? 1);

    const { error: delError } = await db
      .from('action_assignments')
      .delete()
      .eq('family_id', mor.family_id)
      .gte('valid_until', validFrom);
    if (delError) return apiError('DB_ERROR', delError.message, 500);

    if (rows.length > 0) {
      const { error } = await db.from('action_assignments').insert(
        rows.map((a) => ({
          family_id: mor.family_id,
          action_template_id: a.templateId,
          guardian_id: a.guardianId,
          valid_from: validFrom,
          valid_until: validUntil,
        }))
      );
      if (error) return apiError('DB_ERROR', error.message, 500);
    }

    const assignments = await getCurrentAssignments(db, mor.family_id);
    return NextResponse.json({ data: { assignments } });
  }

  return apiError('VALIDATION_ERROR', 'Modo inválido', 400);
}
