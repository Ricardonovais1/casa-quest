// ============================================================
// Casa Quest — API: Distribution of collaborative actions
// GET  /api/families/distribution           → current period (generates if missing)
// POST /api/families/distribution { mode }  → 'auto' (force regenerate)
//                                             'manual' (save explicit assignments)
//                                             'patch' (troca ou atribuição pontual,
//                                                      mantendo as datas da rodada)
//                                             'interval' (change rotation months)
//
// Roda no servidor com a service role (depois de autorizar o Mor): a
// tabela action_assignments é protegida por RLS e o navegador não deve
// depender de política para gerar a rodada.
// ============================================================

import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAdult, apiError } from '@/lib/require-mor';
import {
  ensureCurrentDistribution,
  computePeriod,
  getCurrentAssignments,
} from '@/lib/distribution';
import { ROTATION_INTERVAL_OPTIONS } from '@/lib/constants';
import { isChild } from '@/lib/roles';
import { syncFamilyDay } from '@/lib/daily-actions';
import { notifyFamilyChanged } from '@/lib/realtime';

/**
 * Uma rodada nova só vale de verdade quando chega no dia do guardião:
 * as ações de hoje que ainda estão pendentes trocam de dono e as telas
 * abertas se atualizam sozinhas.
 */
async function applyToToday(db: SupabaseClient, familyId: string) {
  await syncFamilyDay(db, familyId).catch(() => null);
  await notifyFamilyChanged(familyId, 'distribution');
}

/** Only this family's active collaborative templates and active guardians. */
async function loadEligible(db: SupabaseClient, familyId: string) {
  const [{ data: templates }, { data: guardians }, { data: family }] = await Promise.all([
    db
      .from('action_templates')
      .select('id')
      .eq('family_id', familyId)
      .eq('category', 'cooperacao')
      .eq('is_active', true),
    db
      .from('guardians')
      .select('*')
      .eq('family_id', familyId)
      .eq('is_active', true),
    db.from('families').select('rotation_interval_months').eq('id', familyId).single(),
  ]);
  return {
    templateIds: new Set((templates ?? []).map((t) => t.id as string)),
    guardianIds: new Set((guardians ?? []).filter(isChild).map((g) => g.id as string)),
    intervalMonths: (family?.rotation_interval_months as number | null | undefined) ?? 1,
  };
}

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
interface PatchBody {
  mode: 'patch';
  /** guardianId null = a atividade fica sem ninguém nesta rodada. */
  changes: { templateId: string; guardianId: string | null }[];
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

  const body = (await request.json().catch(() => null)) as
    | ManualBody
    | PatchBody
    | AutoBody
    | IntervalBody
    | null;
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
    await ensureCurrentDistribution(db, mor.family_id, {
      force: true,
      seed: Math.floor(Math.random() * 100000),
    });
    await applyToToday(db, mor.family_id);
    const assignments = await getCurrentAssignments(db, mor.family_id);
    return NextResponse.json({ data: { assignments } });
  }

  if (body.mode === 'manual') {
    const wanted = Array.isArray(body.assignments) ? body.assignments : [];
    const { templateIds, guardianIds, intervalMonths } = await loadEligible(db, mor.family_id);

    const rows = wanted.filter((a) => templateIds.has(a.templateId) && guardianIds.has(a.guardianId));
    const { validFrom, validUntil } = computePeriod(intervalMonths);

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

    await applyToToday(db, mor.family_id);

    const assignments = await getCurrentAssignments(db, mor.family_id);
    return NextResponse.json({ data: { assignments } });
  }

  // Ajuste pontual — a troca ou a atribuição sugerida na revisão da divisão.
  // Mexe só nas atividades citadas e mantém as datas da rodada: o modo manual
  // regrava tudo e recomeça o período a partir de hoje, e trocar uma tarefa
  // não deveria adiar o próximo rodízio.
  if (body.mode === 'patch') {
    const changes = Array.isArray(body.changes) ? body.changes : [];
    if (changes.length === 0) return apiError('VALIDATION_ERROR', 'Nada para ajustar', 400);

    const { templateIds, guardianIds, intervalMonths } = await loadEligible(db, mor.family_id);
    const invalid = changes.some(
      (c) =>
        !c ||
        !templateIds.has(c.templateId) ||
        (c.guardianId !== null && !guardianIds.has(c.guardianId))
    );
    if (invalid) return apiError('VALIDATION_ERROR', 'Atividade ou guardião inválido', 400);

    const current = await getCurrentAssignments(db, mor.family_id);
    const { validFrom, validUntil } = current[0]
      ? { validFrom: current[0].valid_from, validUntil: current[0].valid_until }
      : computePeriod(intervalMonths);

    for (const change of changes) {
      const existing = current.find(
        (a) => a.action_template_id === change.templateId && a.valid_from === validFrom
      );
      let error: { message: string } | null = null;
      if (change.guardianId === null) {
        if (existing) ({ error } = await db.from('action_assignments').delete().eq('id', existing.id));
      } else if (existing) {
        ({ error } = await db
          .from('action_assignments')
          .update({ guardian_id: change.guardianId })
          .eq('id', existing.id));
      } else {
        ({ error } = await db.from('action_assignments').insert({
          family_id: mor.family_id,
          action_template_id: change.templateId,
          guardian_id: change.guardianId,
          valid_from: validFrom,
          valid_until: validUntil,
        }));
      }
      if (error) return apiError('DB_ERROR', error.message, 500);
    }

    await applyToToday(db, mor.family_id);

    const assignments = await getCurrentAssignments(db, mor.family_id);
    return NextResponse.json({ data: { assignments } });
  }

  return apiError('VALIDATION_ERROR', 'Modo inválido', 400);
}
