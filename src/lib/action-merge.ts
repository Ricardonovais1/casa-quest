// ============================================================
// Casa Quest — Lib: Fundir duas ações do catálogo
//
// Duas ações que são a mesma tarefa viram uma só: a que sai entrega o
// histórico, a distribuição e o dia de hoje para a que fica, e some do
// catálogo. Quem gerencia a casa escolhe qual fica e com que nome.
//
// A energia é por ação (as sequências de falta são por template), então
// depois da fusão ela é calculada como se sempre tivesse sido uma ação
// só — faltas das duas no mesmo dia contam uma vez.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

export interface MergeRow {
  id: string;
  mission_id: string;
  guardian_id: string;
  due_at: string;
  status: string;
}

export interface MergePlan {
  /** Linhas da que sai que passam, como estão, para a que fica. */
  repoint: string[];
  /** Pendências da que sai que a que fica já tem (mesma pessoa, mesmo horário). */
  dropMerged: string[];
  /** Pendências da que fica que dão lugar a um registro já feito ou perdido da que sai. */
  dropKept: string[];
  /**
   * As duas já são história no mesmo horário: nenhum registro se perde — o da
   * que sai anda alguns segundos para caber no índice único do dia.
   */
  shift: { id: string; dueAt: string }[];
}

/**
 * O que acontece com cada linha da que sai. Pura.
 *
 * O índice único de mission_actions é (missão, guardião, ação, horário):
 * onde as duas caíam no mesmo lugar, só uma linha pode ficar com o nome da
 * que fica. A regra é não perder história — o que foi feito ou virou falta
 * sempre fica; pendência repetida é que sai.
 */
export function planMerge(kept: MergeRow[], merged: MergeRow[]): MergePlan {
  const plan: MergePlan = { repoint: [], dropMerged: [], dropKept: [], shift: [] };
  // O banco devolve "…+00:00"; o instante é o que importa, não o texto.
  const slot = (missionId: string, guardianId: string, at: number) => `${missionId}|${guardianId}|${at}`;
  const occupied = new Map<string, MergeRow>();
  for (const k of kept) occupied.set(slot(k.mission_id, k.guardian_id, Date.parse(k.due_at)), k);

  for (const m of merged) {
    const at = Date.parse(m.due_at);
    const key = slot(m.mission_id, m.guardian_id, at);
    const there = occupied.get(key);

    if (!there) {
      plan.repoint.push(m.id);
      occupied.set(key, m);
      continue;
    }

    if (m.status === 'pending') {
      plan.dropMerged.push(m.id);
      continue;
    }

    if (there.status === 'pending') {
      plan.dropKept.push(there.id);
      plan.repoint.push(m.id);
      occupied.set(key, m);
      continue;
    }

    let next = at;
    do next += 1000;
    while (occupied.has(slot(m.mission_id, m.guardian_id, next)));
    const dueAt = new Date(next).toISOString();
    plan.shift.push({ id: m.id, dueAt });
    occupied.set(slot(m.mission_id, m.guardian_id, next), { ...m, due_at: dueAt });
  }

  return plan;
}

export interface MergeTemplate {
  id: string;
  name: string;
  category: string;
  is_active: boolean;
}

export interface MergeOutcome {
  name: string;
  /** Registros da que saiu que agora são da que ficou. */
  moved: number;
  /** Pendências repetidas que saíram (mesma pessoa, mesmo dia). */
  removedDuplicates: number;
  /** Rodadas da distribuição que passaram para a que ficou. */
  assignmentsMoved: number;
}

const PAGE = 1000;
const CHUNK = 200;

async function rowsOf(db: SupabaseClient, templateId: string): Promise<MergeRow[]> {
  const rows: MergeRow[] = [];
  // O PostgREST devolve no máximo mil linhas por vez; um hábito de um ano passa disso.
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('mission_actions')
      .select('id, mission_id, guardian_id, due_at, status')
      .eq('action_template_id', templateId)
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Não foi possível ler o histórico: ${error.message}`);
    rows.push(...((data ?? []) as MergeRow[]));
    if (!data || data.length < PAGE) return rows;
  }
}

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) out.push(items.slice(i, i + CHUNK));
  return out;
}

/**
 * Funde `merge` em `keep`. Quem chama já validou que as duas são da família
 * e que podem ser fundidas (mesmo grupo de categoria).
 *
 * Se algo falhar no meio, a que sai não é apagada e volta a ficar como
 * estava: o que já passou para a que fica está certo, e repetir a fusão
 * termina o resto.
 */
export async function mergeActionTemplates(
  db: SupabaseClient,
  familyId: string,
  keep: MergeTemplate,
  merge: MergeTemplate,
  name: string
): Promise<MergeOutcome> {
  // A que sai para de gerar dia: um sync no meio da fusão não cria linha nova dela.
  await db.from('action_templates').update({ is_active: false }).eq('id', merge.id).eq('family_id', familyId);

  try {
    const [kept, merged] = await Promise.all([rowsOf(db, keep.id), rowsOf(db, merge.id)]);
    const plan = planMerge(kept, merged);

    for (const ids of chunks([...plan.dropMerged, ...plan.dropKept])) {
      const { error } = await db.from('mission_actions').delete().in('id', ids).eq('status', 'pending');
      if (error) throw new Error(`Não foi possível tirar as pendências repetidas: ${error.message}`);
    }

    for (const s of plan.shift) {
      const { error } = await db
        .from('mission_actions')
        .update({ action_template_id: keep.id, due_at: s.dueAt })
        .eq('id', s.id);
      if (error) throw new Error(`Não foi possível mover o histórico: ${error.message}`);
    }

    for (const ids of chunks(plan.repoint)) {
      const { error } = await db.from('mission_actions').update({ action_template_id: keep.id }).in('id', ids);
      if (!error) continue;
      if (error.code !== '23505') throw new Error(`Não foi possível mover o histórico: ${error.message}`);

      // Alguém gerou o dia ou marcou "Fiz!" no meio do caminho: uma por uma.
      for (const id of ids) {
        const { error: one } = await db.from('mission_actions').update({ action_template_id: keep.id }).eq('id', id);
        if (one?.code === '23505') {
          // A que fica já tem essa linha; se esta ainda é só pendência, sai.
          await db.from('mission_actions').delete().eq('id', id).eq('status', 'pending');
        } else if (one) {
          throw new Error(`Não foi possível mover o histórico: ${one.message}`);
        }
      }
    }

    // Apagar a que sai com linhas ainda apontando para ela deixaria registros sem nome.
    const { count: left } = await db
      .from('mission_actions')
      .select('*', { count: 'exact', head: true })
      .eq('action_template_id', merge.id);
    if ((left ?? 0) > 0) {
      throw new Error('Parte do histórico mudou durante a fusão. Tente de novo — o que já passou fica.');
    }

    // Rodadas: passam para a que fica quando ela é de colaboração e ainda não
    // tem dono naquele período. O resto cai por cascata com a que sai.
    const [{ data: keptAssignments }, { data: mergedAssignments }] = await Promise.all([
      db.from('action_assignments').select('valid_from').eq('action_template_id', keep.id),
      db.from('action_assignments').select('id, valid_from').eq('action_template_id', merge.id),
    ]);
    const keptPeriods = new Set((keptAssignments ?? []).map((a) => a.valid_from as string));
    let assignmentsMoved = 0;
    if (keep.category === 'cooperacao') {
      for (const a of mergedAssignments ?? []) {
        if (keptPeriods.has(a.valid_from)) continue;
        const { error } = await db.from('action_assignments').update({ action_template_id: keep.id }).eq('id', a.id);
        if (!error) {
          assignmentsMoved++;
          keptPeriods.add(a.valid_from);
        }
      }
    }

    const { error: keepError } = await db
      .from('action_templates')
      .update({ name, is_active: keep.is_active || merge.is_active })
      .eq('id', keep.id)
      .eq('family_id', familyId);
    if (keepError) throw new Error(`Não foi possível renomear a ação: ${keepError.message}`);

    const { error: deleteError } = await db
      .from('action_templates')
      .delete()
      .eq('id', merge.id)
      .eq('family_id', familyId);
    if (deleteError) throw new Error(`Não foi possível tirar a ação do catálogo: ${deleteError.message}`);

    return {
      name,
      moved: plan.repoint.length + plan.shift.length,
      removedDuplicates: plan.dropMerged.length + plan.dropKept.length,
      assignmentsMoved,
    };
  } catch (e) {
    await db
      .from('action_templates')
      .update({ is_active: merge.is_active })
      .eq('id', merge.id)
      .eq('family_id', familyId);
    throw e;
  }
}
