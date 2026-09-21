// ============================================================
// Casa Quest — API: uma ação do catálogo
// GET    /api/action-templates/[id]  → o que a exclusão vai afetar
// DELETE /api/action-templates/[id]  → apaga a ação do catálogo
//
// Desativar esconde a ação do dia mas mantém tudo; excluir apaga de
// vez. Por isso o GET existe: a tela confirma dizendo quantos
// registros do histórico perdem o nome e quantas pendências de hoje
// somem. Só quem gerencia a casa exclui.
// ============================================================

import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAdult, apiError } from '@/lib/require-mor';
import { notifyFamilyChanged } from '@/lib/realtime';

async function loadTemplate(id: string) {
  const auth = await requireAdult({ manage: true });
  if (!auth.ok) return { error: auth.response };
  const { db, me } = auth.ctx;

  const { data: template } = await db
    .from('action_templates')
    .select('id, name, category')
    .eq('id', id)
    .eq('family_id', me.family_id)
    .maybeSingle();

  if (!template) return { error: apiError('NOT_FOUND', 'Ação não encontrada', 404) };
  return { db, me, template };
}

/** Quantos registros existem hoje e no histórico para esta ação. */
async function countUsage(db: SupabaseClient, templateId: string) {
  const [{ count: total }, { count: pending }] = await Promise.all([
    db
      .from('mission_actions')
      .select('*', { count: 'exact', head: true })
      .eq('action_template_id', templateId),
    db
      .from('mission_actions')
      .select('*', { count: 'exact', head: true })
      .eq('action_template_id', templateId)
      .eq('status', 'pending'),
  ]);
  const pendingCount = pending ?? 0;
  return { historyCount: Math.max(0, (total ?? 0) - pendingCount), pendingCount };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadTemplate(id);
  if (loaded.error) return loaded.error;
  const { db, template } = loaded;

  const usage = await countUsage(db, id);
  return NextResponse.json({ data: { id: template.id, name: template.name, ...usage } });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadTemplate(id);
  if (loaded.error) return loaded.error;
  const { db, me, template } = loaded;

  const usage = await countUsage(db, id);

  // O que ainda está pendente sai junto: uma linha órfã no painel de hoje,
  // sem nome, só confunde. O que já foi feito ou virou falta fica — é
  // história, e a energia da missão depende dela.
  await db.from('mission_actions').delete().eq('action_template_id', id).eq('status', 'pending');

  // action_assignments cai por cascata; mission_actions guarda NULL no
  // template (ON DELETE SET NULL), por isso o aviso no GET.
  const { error } = await db
    .from('action_templates')
    .delete()
    .eq('id', id)
    .eq('family_id', me.family_id);

  if (error) return apiError('DB_ERROR', error.message, 500);

  await notifyFamilyChanged(me.family_id, 'actions');

  return NextResponse.json({
    data: {
      id,
      name: template.name,
      deleted: true,
      removedPending: usage.pendingCount,
      historyKept: usage.historyCount,
    },
  });
}
