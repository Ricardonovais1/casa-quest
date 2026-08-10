// ============================================================
// Casa Quest — API: Calculate Guardian Energy
// GET /api/energy/[guardianId]?missionId=xxx
// ============================================================

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/infrastructure/supabase/server';
import { computeEnergy, getQualitativeState, getEnergyPercentage } from '@/domain/energy/engine';
import type { AbsenceSequence } from '@/domain/energy/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ guardianId: string }> }
) {
  try {
    const { guardianId } = await params;
    const { searchParams } = new URL(request.url);
    const missionId = searchParams.get('missionId');

    if (!missionId) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'missionId é obrigatório' } },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Não autenticado' } },
        { status: 403 }
      );
    }

    // Get mission_guardian initial state
    const { data: mg } = await supabase
      .from('mission_guardians')
      .select('initial_energy, cooperation_score')
      .eq('guardian_id', guardianId)
      .eq('mission_id', missionId)
      .single();

    const initialEnergy = mg?.initial_energy || 100;

    // Get all energy events for this guardian/mission
    const { data: events } = await supabase
      .from('energy_events')
      .select('*')
      .eq('guardian_id', guardianId)
      .eq('mission_id', missionId)
      .order('created_at', { ascending: true });

    // Get missed actions for sequence analysis
    const { data: missedActions } = await supabase
      .from('mission_actions')
      .select('id, action_template_id, missed_at')
      .eq('guardian_id', guardianId)
      .eq('mission_id', missionId)
      .eq('status', 'missed')
      .order('missed_at', { ascending: true });

    // Get recovery count
    const { count: recoveryCount } = await supabase
      .from('mission_actions')
      .select('*', { count: 'exact', head: true })
      .eq('guardian_id', guardianId)
      .eq('mission_id', missionId)
      .eq('status', 'confirmed')
      .not('recovers_action_id', 'is', null);

    // Get escalada points
    const { data: escaladaActions } = await supabase
      .from('mission_actions')
      .select('escalada_points_earned')
      .eq('guardian_id', guardianId)
      .eq('mission_id', missionId)
      .eq('status', 'confirmed')
      .not('escalada_points_earned', 'is', null);

    const escaladaPoints = (escaladaActions || []).reduce(
      (sum, a) => sum + (a.escalada_points_earned || 0),
      0
    );

    // Build sequences from missed actions grouped by template
    const byTemplate = new Map<string, Date[]>();
    for (const action of missedActions || []) {
      if (action.missed_at) {
        const dates = byTemplate.get(action.action_template_id) || [];
        dates.push(new Date(action.missed_at));
        byTemplate.set(action.action_template_id, dates);
      }
    }

    const sequences: AbsenceSequence[] = [];
    for (const [templateId, dates] of byTemplate) {
      sequences.push({
        guardianId,
        missionId,
        actionTemplateId: templateId,
        absenceDates: dates.sort((a, b) => a.getTime() - b.getTime()),
        length: dates.length,
      });
    }

    // Get family config for energy params
    const { data: family } = await supabase
      .from('guardians')
      .select('family_id')
      .eq('id', guardianId)
      .single();

    let recoveryValue = 2;
    let recurrenceWeight = 0.5;

    if (family) {
      const { data: familyConfig } = await supabase
        .from('families')
        .select('recovery_value, recurrence_weight')
        .eq('id', family.family_id)
        .single();

      if (familyConfig) {
        recoveryValue = familyConfig.recovery_value || 2;
        // DECISION: recurrence_weight is not stored as a column in families table
        // Default to 0.5. Can be added as a migration later.
      }
    }

    // Compute energy
    const result = computeEnergy(sequences, recoveryCount || 0, escaladaPoints, {
      initialEnergy,
      recurrenceWeight,
      recoveryValue,
    });

    const qualitative = getQualitativeState(result.finalEnergy, initialEnergy);
    const percentage = getEnergyPercentage(result.finalEnergy, initialEnergy);

    return NextResponse.json({
      data: {
        ...result,
        qualitative,
        percentage,
        cooperationScore: mg?.cooperation_score || 0,
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Erro ao calcular energia' } },
      { status: 500 }
    );
  }
}
