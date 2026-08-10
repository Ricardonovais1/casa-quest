// ============================================================
// Casa Quest — API: Create Family
// POST /api/families
// ============================================================

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/infrastructure/supabase/server';
import { createFamilySchema } from '@/lib/validation';
import { ZodError } from 'zod';

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Não autenticado' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const input = createFamilySchema.parse(body);

    // Create the family
    const { data: family, error: familyError } = await supabase
      .from('families')
      .insert({
        name: input.name,
        timezone: input.timezone,
        created_by: user.id,
      })
      .select()
      .single();

    if (familyError) {
      return NextResponse.json(
        { error: { code: 'INTERNAL', message: 'Erro ao criar família' } },
        { status: 500 }
      );
    }

    // Auto-create the Mor as a guardian in the family
    const { error: guardianError } = await supabase
      .from('guardians')
      .insert({
        family_id: family.id,
        name: user.user_metadata?.full_name || 'Guardião-Mor',
        is_mor: true,
        email: user.email,
        user_id: user.id,
      });

    if (guardianError) {
      // Rollback: delete the family
      await supabase.from('families').delete().eq('id', family.id);
      return NextResponse.json(
        { error: { code: 'INTERNAL', message: 'Erro ao criar guardião-mor' } },
        { status: 500 }
      );
    }

    // Seed default escalada categories for this family
    const defaultCategories = [
      { family_id: family.id, name: 'Missões', base_points: 2, bonus_multiplier: 1.5, max_per_mission: 10 },
      { family_id: family.id, name: 'Gentilezas', base_points: 1, bonus_multiplier: 2.0, max_per_mission: 8 },
      { family_id: family.id, name: 'Autoaperfeiçoamento', base_points: 2, bonus_multiplier: 1.2, max_per_mission: 12 },
      { family_id: family.id, name: 'Rendimento Escolar', base_points: 3, bonus_multiplier: 1.0, max_per_mission: 15 },
    ];

    await supabase.from('escalada_categories').insert(defaultCategories);

    return NextResponse.json({ data: family }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos', details: error.flatten() } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Erro interno' } },
      { status: 500 }
    );
  }
}
