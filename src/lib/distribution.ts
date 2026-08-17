// ============================================================
// Casa Quest — Lib: Distribution (I/O helpers)
// Reads/writes action_assignments and ensures a current
// distribution exists, delegating the balancing to the pure
// domain engine (src/domain/distribution/engine.ts).
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { distribute } from '@/domain/distribution/engine';

export interface AssignmentRow {
  id: string;
  valid_from: string;
  valid_until: string;
  guardian_id: string;
  guardian_name: string;
  action_template_id: string;
  action_name: string;
  points: number;
  frequency: string | null;
}

function toDateString(d: Date): string {
  return d.toISOString().split('T')[0]!;
}

/** Add `months` to a YYYY-MM-DD date, clamping day-overflow (Jan 31 → Feb 28). */
function addMonths(dateStr: string, months: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const originalDay = parseInt(dateStr.slice(8, 10), 10);
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < originalDay) {
    d.setDate(0); // last day of the previous month
  }
  return toDateString(d);
}

function monthOrdinal(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.getFullYear() * 12 + d.getMonth();
}

/** Compute the validity period (valid_from .. valid_until) from today + interval. */
export function computePeriod(intervalMonths: number): {
  validFrom: string;
  validUntil: string;
} {
  const validFrom = toDateString(new Date());
  const validUntil = toDateString(
    new Date(new Date(`${addMonths(validFrom, intervalMonths)}T00:00:00`).getTime() - 86400000)
  );
  return { validFrom, validUntil };
}

interface RawAssignment {
  id: string;
  valid_from: string;
  valid_until: string;
  guardian_id: string;
  action_template_id: string;
  guardians: { name: string } | null;
  action_templates: { name: string; points: number; frequency: string | null } | null;
}

function normalize(rows: RawAssignment[] | null): AssignmentRow[] {
  if (!rows) return [];
  return rows.map((r) => ({
    id: r.id,
    valid_from: r.valid_from,
    valid_until: r.valid_until,
    guardian_id: r.guardian_id,
    guardian_name: r.guardians?.name ?? '—',
    action_template_id: r.action_template_id,
    action_name: r.action_templates?.name ?? 'Ação',
    points: r.action_templates?.points ?? 0,
    frequency: r.action_templates?.frequency ?? null,
  }));
}

/** Fetch the current (non-expired) assignments for a family. */
export async function getCurrentAssignments(
  supabase: SupabaseClient,
  familyId: string
): Promise<AssignmentRow[]> {
  const today = toDateString(new Date());
  const { data } = await supabase
    .from('action_assignments')
    .select(
      'id, valid_from, valid_until, guardian_id, action_template_id, guardians(name), action_templates(name, points, frequency)'
    )
    .eq('family_id', familyId)
    .gte('valid_until', today)
    .order('valid_from', { ascending: false });

  return normalize(data as RawAssignment[] | null);
}

/**
 * Ensure a current distribution exists. If the current period has expired
 * (or none exists), generate the next one using the domain engine.
 * Pass `force: true` to delete the current period and regenerate immediately
 * (on-demand "redistribuir agora"), optionally with a custom `seed`.
 * Returns the current assignments and whether a new period was created.
 */
export async function ensureCurrentDistribution(
  supabase: SupabaseClient,
  familyId: string,
  opts?: { force?: boolean; seed?: number }
): Promise<{ assignments: AssignmentRow[]; generated: boolean }> {
  const current = await getCurrentAssignments(supabase, familyId);
  if (!opts?.force && current.length > 0) {
    return { assignments: current, generated: false };
  }

  // Gather inputs
  const [{ data: templates }, { data: guardians }, { data: family }] = await Promise.all([
    supabase
      .from('action_templates')
      .select('id, name, points, frequency')
      .eq('family_id', familyId)
      .eq('category', 'cooperacao')
      .eq('is_active', true),
    supabase
      .from('guardians')
      .select('id, name')
      .eq('family_id', familyId)
      .eq('is_mor', false)
      .eq('is_active', true),
    supabase
      .from('families')
      .select('rotation_interval_months')
      .eq('id', familyId)
      .single(),
  ]);

  const intervalMonths = family?.rotation_interval_months ?? 1;

  if (!templates || templates.length === 0 || !guardians || guardians.length === 0) {
    return { assignments: [], generated: false };
  }

  const today = toDateString(new Date());
  const { validFrom, validUntil } = computePeriod(intervalMonths);

  // On forced redistribute, clear the current period first
  if (opts?.force) {
    await supabase
      .from('action_assignments')
      .delete()
      .eq('family_id', familyId)
      .gte('valid_until', today);
  }

  const seed = opts?.seed ?? monthOrdinal(validFrom);
  const result = distribute(
    templates.map((t) => ({ id: t.id, name: t.name, points: t.points ?? 0 })),
    guardians.map((g) => ({ id: g.id, name: g.name })),
    seed
  );

  if (result.assignments.length > 0) {
    await supabase.from('action_assignments').insert(
      result.assignments.map((a) => ({
        family_id: familyId,
        action_template_id: a.actionTemplateId,
        guardian_id: a.guardianId,
        valid_from: validFrom,
        valid_until: validUntil,
      }))
    );
  }

  const assignments = await getCurrentAssignments(supabase, familyId);
  return { assignments, generated: true };
}
