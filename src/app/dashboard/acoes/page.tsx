'use client';

// ============================================================
// Casa Quest — Dashboard: Action Templates CRUD
// Agrupadas por categoria e em ordem alfabética dentro de cada uma.
// Criar, editar, ativar/desativar, excluir (dentro das configurações
// da ação) e adicionar em lote a partir do catálogo pronto.
//
// Também procura ações repetidas ("Colocar louça" e "Encher a
// lava-louça") e pergunta se é para fundir. Na fusão, quem gerencia
// escolhe qual configuração fica valendo e com que nome.
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import { useFamily } from '@/hooks/use-family';
import { getSupabaseBrowserClient } from '@/infrastructure/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/page';
import { hhmm, dayEndOf } from '@/lib/day-range';
import {
  ACTION_CATEGORY_META,
  DEFAULT_ACTION_CATALOG,
  FREQUENCY_OPTIONS,
  CATEGORY_TO_ACTION_TYPE,
  categoryMeta,
} from '@/lib/default-actions';
import { canMerge, findSimilarActions, pairKey } from '@/domain/actions/similarity';
import { readDismissedPairs, saveDismissedPairs } from '@/lib/similar-dismissals';

interface ActionTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  action_type: string;
  /** Hora marcada. null = sem hora: vale o dia todo. */
  default_due_time: string | null;
  confirmation_mode: string;
  is_active: boolean;
  points: number;
  frequency: string | null;
  created_at?: string;
}

const CONFIRMATION_MODES = [
  { value: 'none', label: 'Sem confirmação' },
  { value: 'one_peer', label: '1 pessoa confirma' },
];

function formatPoints(points: number): string {
  if (points > 0) return `+${points}`;
  if (points < 0) return `−${Math.abs(points)}`;
  return '0';
}

function normalizeConfirmation(mode: string): string {
  return mode === 'none' ? 'none' : 'one_peer';
}

/** Ordem alfabética de verdade em português (acento não vai para o fim). */
function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
}

/**
 * Qual das duas fica, por padrão: a ativa; entre duas ativas, a mais nova —
 * em geral é a que a casa criou para substituir a do catálogo pronto.
 */
function defaultKeep(x: ActionTemplate, y: ActionTemplate): { keepId: string; mergeId: string } {
  const xStays = x.is_active !== y.is_active ? x.is_active : (x.created_at ?? '') >= (y.created_at ?? '');
  return xStays ? { keepId: x.id, mergeId: y.id } : { keepId: y.id, mergeId: x.id };
}

function categoryName(category: string): string {
  const meta = categoryMeta(category);
  return meta ? `${meta.emoji} ${meta.label}` : `📋 ${category}`;
}

/** Quem faz a ação no dia a dia — é o que muda quando a categoria muda. */
function whoDoes(t: ActionTemplate, owner: string | undefined): string {
  if (t.category === 'cooperacao') return owner ? `Com ${owner} nesta rodada` : 'Sem ninguém nesta rodada';
  if (t.category === 'habitos') return 'Todos os guardiões fazem';
  return 'Registrada quando acontece';
}

/** O recado quando as duas eram de categorias diferentes. */
function categoryChange(keep: ActionTemplate, out: ActionTemplate, owner: string | undefined): string | null {
  if (keep.category === out.category) return null;
  if (keep.category === 'habitos') {
    return 'Fica como hábito: todos os guardiões fazem, e a tarefa sai da distribuição.';
  }
  if (keep.category === 'cooperacao') {
    return owner
      ? `Fica como colaboração: só quem está com ela na distribuição faz — nesta rodada, ${owner}.`
      : 'Fica como colaboração, e está sem ninguém nesta rodada: atribua em Distribuição depois.';
  }
  return `Fica como ${categoryMeta(keep.category)?.label ?? keep.category}: os próximos registros seguem essa categoria; os já feitos mantêm o que valeram.`;
}

export default function ActionsPage() {
  const { family, canManage, loading: familyLoading } = useFamily();
  const dayEnd = dayEndOf(family ?? {});
  const [templates, setTemplates] = useState<ActionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('habitos');
  const [points, setPoints] = useState('');
  const [frequency, setFrequency] = useState<string>('diária');
  const [hasDueTime, setHasDueTime] = useState(false);
  const [dueTime, setDueTime] = useState('20:00');
  const [description, setDescription] = useState('');
  const [confirmMode, setConfirmMode] = useState('none');

  // Exclusão da ação (dentro das configurações dela)
  const [usage, setUsage] = useState<{ historyCount: number; pendingCount: number } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Suggested actions state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [addingSuggestions, setAddingSuggestions] = useState(false);

  // Ações parecidas e fusão
  const [dismissedPairs, setDismissedPairs] = useState<Set<string>>(new Set());
  const [merge, setMerge] = useState<{ keepId: string; mergeId: string } | null>(null);
  /** Id da ação cujo nome fica, ou 'custom' para um nome novo. */
  const [mergeNameSource, setMergeNameSource] = useState('custom');
  const [mergeCustomName, setMergeCustomName] = useState('');
  /** Registros no histórico de cada uma das duas (feitos, perdidos e pendentes). */
  const [mergeUsage, setMergeUsage] = useState<Record<string, number>>({});
  /** Nome de quem está com cada atividade de colaboração nesta rodada. */
  const [owners, setOwners] = useState<Record<string, string>>({});
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [merging, setMerging] = useState(false);

  const supabase = getSupabaseBrowserClient();

  const byId = useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates]);
  const similarPairs = useMemo(
    () => findSimilarActions(templates).filter((p) => !dismissedPairs.has(pairKey(p.a, p.b))),
    [templates, dismissedPairs]
  );

  const mergeKeep = merge ? byId.get(merge.keepId) : undefined;
  const mergeOut = merge ? byId.get(merge.mergeId) : undefined;
  const mergeName =
    mergeNameSource === 'custom' ? mergeCustomName.trim() : (byId.get(mergeNameSource)?.name ?? '');
  const editing = editingId ? byId.get(editingId) : undefined;
  const mergeTargets = editing
    ? templates.filter((t) => t.id !== editing.id && canMerge(t, editing))
    : [];

  async function loadTemplates() {
    if (!family) return;
    const { data } = await supabase
      .from('action_templates')
      .select('*')
      .eq('family_id', family.id)
      // Ordem alfabética é a que a pessoa usa para procurar uma ação.
      .order('name', { ascending: true });
    const list = ((data ?? []) as ActionTemplate[]).sort(byName);
    if (data) setTemplates(list);
    setDismissedPairs(readDismissedPairs(family.id));
    setLoading(false);

    // Vindo da revisão da divisão (/dashboard/acoes?fundir=fica,sai): abre a fusão.
    const wanted = new URLSearchParams(window.location.search).get('fundir');
    if (wanted) {
      window.history.replaceState(null, '', window.location.pathname);
      const [keepId, mergeId] = wanted.split(',');
      const keep = list.find((t) => t.id === keepId);
      const out = list.find((t) => t.id === mergeId);
      if (canManage && keep && out && keep.id !== out.id && canMerge(keep, out)) {
        openMerge(keep.id, out.id);
      }
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data load on mount; state is only set after the await resolves
    if (family) loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family]);

  function resetForm() {
    setName('');
    setCategory('habitos');
    setPoints('');
    setFrequency('diária');
    setHasDueTime(false);
    setDueTime('20:00');
    setDescription('');
    setConfirmMode('none');
    setEditingId(null);
    setShowForm(false);
    setUsage(null);
    setConfirmingDelete(false);
    setMergeTargetId('');
    setMerge(null);
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(t: ActionTemplate) {
    setMerge(null);
    setMergeTargetId('');
    setName(t.name);
    setCategory(t.category);
    setPoints(t.points != null ? String(t.points) : '');
    setFrequency(t.frequency || 'diária');
    setHasDueTime(!!t.default_due_time);
    setDueTime(hhmm(t.default_due_time) ?? '20:00');
    setDescription(t.description || '');
    setConfirmMode(normalizeConfirmation(t.confirmation_mode));
    setEditingId(t.id);
    setShowForm(true);
    setConfirmingDelete(false);
    setUsage(null);
    // Quanto a exclusão afeta: a confirmação precisa ser concreta.
    fetch(`/api/action-templates/${t.id}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) =>
        body?.data &&
        setUsage({ historyCount: body.data.historyCount, pendingCount: body.data.pendingCount })
      )
      .catch(() => null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** Abre a fusão já com uma sugestão de qual fica; a pessoa pode inverter. */
  function openMerge(keepId: string, mergeId: string) {
    resetForm();
    setShowSuggestions(false);
    setMerge({ keepId, mergeId });
    setMergeNameSource(keepId);
    setMergeCustomName('');
    setMergeUsage({});
    // O tamanho do histórico e quem está com cada uma: a decisão precisa ser concreta.
    for (const id of [keepId, mergeId]) {
      fetch(`/api/action-templates/${id}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((body) =>
          body?.data &&
          setMergeUsage((prev) => ({ ...prev, [id]: body.data.historyCount + body.data.pendingCount }))
        )
        .catch(() => null);
    }
    fetch('/api/families/distribution', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        const map: Record<string, string> = {};
        for (const a of body?.data?.assignments ?? []) map[a.action_template_id] = a.guardian_name;
        setOwners(map);
      })
      .catch(() => null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleMerge() {
    if (!merge || !mergeName) return;
    setMerging(true);
    try {
      const res = await fetch('/api/action-templates/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keepId: merge.keepId, mergeId: merge.mergeId, name: mergeName }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setNotice({ kind: 'error', text: body?.error?.message || 'Não foi possível fundir as ações.' });
      } else {
        const moved: number = body?.data?.moved ?? 0;
        const removed: number = body?.data?.removedDuplicates ?? 0;
        setNotice({
          kind: 'success',
          text:
            `Pronto: agora é uma ação só, “${body?.data?.name ?? mergeName}”.` +
            (moved > 0
              ? ` ${moved} registro${moved === 1 ? '' : 's'} do histórico passa${moved === 1 ? '' : 'm'} a contar nela.`
              : '') +
            (removed > 0
              ? ` ${removed} pendência${removed === 1 ? '' : 's'} repetida${removed === 1 ? '' : 's'} sa${removed === 1 ? 'iu' : 'íram'} do dia.`
              : ''),
        });
        setMerge(null);
        loadTemplates();
      }
    } catch {
      setNotice({ kind: 'error', text: 'Sem conexão com o servidor.' });
    }
    setMerging(false);
  }

  /** "Não são iguais": o par some da lista neste aparelho. */
  function dismissPair(a: string, b: string) {
    if (!family) return;
    const next = new Set(dismissedPairs);
    next.add(pairKey(a, b));
    setDismissedPairs(next);
    saveDismissedPairs(family.id, next);
  }

  async function handleDelete() {
    if (!editingId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/action-templates/${editingId}`, { method: 'DELETE' });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setNotice({ kind: 'error', text: body?.error?.message || 'Não foi possível excluir a ação.' });
      } else {
        const kept = body?.data?.historyKept ?? 0;
        setNotice({
          kind: 'success',
          text:
            `Ação "${body?.data?.name}" excluída.` +
            (kept > 0 ? ` ${kept} registro${kept === 1 ? '' : 's'} do histórico continua${kept === 1 ? '' : 'm'} contando na energia.` : ''),
        });
        resetForm();
        loadTemplates();
      }
    } catch {
      setNotice({ kind: 'error', text: 'Sem conexão com o servidor.' });
    }
    setDeleting(false);
  }

  async function handleSave() {
    if (!family || !name.trim()) return;
    setSaving(true);

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      category,
      action_type: CATEGORY_TO_ACTION_TYPE[category] ?? 'basic',
      points: points.trim() === '' ? 0 : parseInt(points, 10) || 0,
      frequency,
      // Sem hora marcada é o padrão: a ação vale o dia todo.
      default_due_time: hasDueTime ? dueTime : null,
      confirmation_mode: confirmMode,
    };

    let error = null;
    if (editingId) {
      ({ error } = await supabase
        .from('action_templates')
        .update(payload)
        .eq('id', editingId));
    } else {
      ({ error } = await supabase
        .from('action_templates')
        .insert({ ...payload, family_id: family.id, is_active: true }));
    }

    if (error) {
      setNotice({ kind: 'error', text: 'Não foi possível salvar: ' + error.message });
    } else {
      setNotice({ kind: 'success', text: editingId ? 'Ação atualizada.' : 'Ação criada.' });
      resetForm();
      loadTemplates();
    }
    setSaving(false);
  }

  async function handleToggle(id: string, currentActive: boolean) {
    await supabase
      .from('action_templates')
      .update({ is_active: !currentActive })
      .eq('id', id);
    loadTemplates();
  }

  function toggleSuggestion(name: string) {
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleCategory(names: string[]) {
    setSelectedNames((prev) => {
      const next = new Set(prev);
      const allSelected = names.every((n) => next.has(n));
      if (allSelected) names.forEach((n) => next.delete(n));
      else names.forEach((n) => next.add(n));
      return next;
    });
  }

  function selectAll(select: boolean) {
    setSelectedNames(
      select ? new Set(DEFAULT_ACTION_CATALOG.map((s) => s.name)) : new Set()
    );
  }

  async function handleAddSuggested() {
    if (!family) return;
    setAddingSuggestions(true);

    const existingNames = new Set(
      templates.map((t) => t.name.trim().toLowerCase())
    );
    const toInsert = DEFAULT_ACTION_CATALOG.filter(
      (s) => selectedNames.has(s.name) && !existingNames.has(s.name.toLowerCase())
    ).map((s) => ({
      family_id: family.id,
      name: s.name,
      description: s.description ?? null,
      category: s.category,
      action_type: CATEGORY_TO_ACTION_TYPE[s.category] ?? 'basic',
      points: s.points,
      frequency: s.frequency,
      default_due_time: null,
      confirmation_mode: 'none',
      is_active: true,
    }));

    if (toInsert.length > 0) {
      const { error } = await supabase.from('action_templates').insert(toInsert);
      if (error) {
        setNotice({ kind: 'error', text: 'Não foi possível adicionar: ' + error.message });
      } else {
        setNotice({ kind: 'success', text: `${toInsert.length} ação${toInsert.length === 1 ? '' : 'ões'} adicionada${toInsert.length === 1 ? '' : 's'}.` });
        setSelectedNames(new Set());
        setShowSuggestions(false);
        loadTemplates();
      }
    } else {
      setNotice({ kind: 'warning', text: 'Nenhuma ação nova selecionada: as marcadas já existem na sua família.' });
    }
    setAddingSuggestions(false);
  }

  const grouped = useMemo(() => {
    const groups = ACTION_CATEGORY_META.map((c) => ({
      meta: c,
      items: templates.filter((t) => t.category === c.value).sort(byName),
    }));
    const visible = new Set<string>(ACTION_CATEGORY_META.map((c) => c.value));
    const others = templates.filter((t) => !visible.has(t.category)).sort(byName);
    return { groups, others };
  }, [templates]);

  if (familyLoading || loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="h-40 rounded-xl bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ações</h1>
          <p className="mt-1 text-sm text-gray-500">
            {templates.length} ação{templates.length !== 1 ? 'ões' : ''} cadastrada{templates.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowSuggestions((v) => !v)}>
              {showSuggestions ? 'Fechar sugeridas' : '✨ Ações sugeridas'}
            </Button>
            <Button onClick={showForm ? resetForm : openCreate}>
              {showForm ? 'Cancelar' : '+ Nova Ação'}
            </Button>
          </div>
        )}
      </div>

      {!canManage && (
        <Notice kind="info">O catálogo de ações é definido pelo Guardião-Mor. Aqui você consulta o que vale na casa.</Notice>
      )}

      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

      {/* Fusão de duas ações */}
      {merge && mergeKeep && mergeOut && (
        <Card>
          <CardHeader>
            <CardTitle>🔀 Fundir ações</CardTitle>
            <CardDescription>
              As duas viram uma ação só, com o histórico das duas. Escolha qual configuração fica valendo e com que nome.
            </CardDescription>
          </CardHeader>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-gray-500">
                Qual fica valendo? (categoria, pontos, frequência e horário)
              </p>
              <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                {[mergeKeep, mergeOut].map((t) => {
                  const stays = t.id === merge.keepId;
                  const count = mergeUsage[t.id];
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={stays}
                      onClick={() => !stays && setMerge({ keepId: t.id, mergeId: merge.keepId })}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        stays
                          ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                      <p className="mt-0.5 text-[11px] text-gray-500">
                        {categoryName(t.category)} · {t.frequency || '—'} · {formatPoints(t.points)} pts ·{' '}
                        {hhmm(t.default_due_time) ?? 'sem hora'}
                        {!t.is_active && ' · inativa'}
                      </p>
                      <p className="text-[11px] text-gray-500">{whoDoes(t, owners[t.id])}</p>
                      <p className="text-[11px] text-gray-400">
                        {count === undefined
                          ? 'Contando o histórico…'
                          : `${count} registro${count === 1 ? '' : 's'} no histórico`}
                      </p>
                      <p className={`mt-1 text-[11px] font-semibold ${stays ? 'text-indigo-700' : 'text-gray-400'}`}>
                        {stays ? '✓ Fica' : 'Sai — toque para ficar com esta'}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500">Nome que fica</p>
              <div className="mt-1.5 space-y-1.5">
                {[mergeKeep, mergeOut].map((t) => (
                  <label key={t.id} className="flex cursor-pointer items-center gap-2 text-sm text-gray-800">
                    <input
                      type="radio"
                      name="merge-name"
                      checked={mergeNameSource === t.id}
                      onChange={() => setMergeNameSource(t.id)}
                      className="h-4 w-4 border-gray-300 text-indigo-600"
                    />
                    {t.name}
                  </label>
                ))}
                <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800">
                  <input
                    type="radio"
                    name="merge-name"
                    checked={mergeNameSource === 'custom'}
                    onChange={() => setMergeNameSource('custom')}
                    className="h-4 w-4 border-gray-300 text-indigo-600"
                  />
                  Outro nome
                </label>
                {mergeNameSource === 'custom' && (
                  <div className="pl-6">
                    <input
                      type="text"
                      value={mergeCustomName}
                      onChange={(e) => setMergeCustomName(e.target.value)}
                      placeholder="Ex: Lava-louça"
                      maxLength={120}
                      autoFocus
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>
            </div>

            <ul className="space-y-0.5 rounded-lg bg-amber-50 p-3 text-[11px] text-amber-800">
              <li>
                • “{mergeOut.name}” sai do catálogo{mergeOut.category === 'cooperacao' ? ' e da distribuição' : ''}, e o
                histórico dela passa para “{mergeName || '…'}”.
              </li>
              {categoryChange(mergeKeep, mergeOut, owners[mergeKeep.id]) && (
                <li>• {categoryChange(mergeKeep, mergeOut, owners[mergeKeep.id])}</li>
              )}
              <li>
                • Onde as duas caíam no mesmo dia para a mesma pessoa, fica uma só: a pendência repetida some, e duas
                faltas no mesmo dia contam como uma.
              </li>
              <li>• A energia passa a ser calculada como se sempre tivesse sido uma ação só.</li>
              <li>• Não dá para desfazer.</li>
            </ul>

            <div className="flex gap-2">
              <Button onClick={handleMerge} loading={merging} disabled={!mergeName}>
                Fundir
              </Button>
              <Button variant="ghost" onClick={() => setMerge(null)} disabled={merging}>
                Cancelar
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Ações parecidas */}
      {canManage && !merge && similarPairs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>🔍 Ações parecidas ({similarPairs.length})</CardTitle>
            <CardDescription>
              Podem ser a mesma tarefa com outro nome. Fundir junta o histórico das duas numa ação só; se forem
              diferentes mesmo, é só dizer.
            </CardDescription>
          </CardHeader>
          <div className="divide-y divide-gray-100">
            {similarPairs.map((p) => {
              const a = byId.get(p.a);
              const b = byId.get(p.b);
              if (!a || !b) return null;
              return (
                <div key={pairKey(p.a, p.b)} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900">
                      <span
                        className={`mr-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          p.kind === 'same' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {p.kind === 'same' ? 'Iguais' : 'Parecidas'}
                      </span>
                      “{a.name}” <span className="text-gray-400">e</span> “{b.name}”
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      {a.category === b.category
                        ? categoryName(a.category)
                        : `${categoryName(a.category)} · ${categoryName(b.category)}`}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const { keepId, mergeId } = defaultKeep(a, b);
                        openMerge(keepId, mergeId);
                      }}
                    >
                      Fundir…
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => dismissPair(p.a, p.b)}>
                      Não são iguais
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Suggested actions */}
      {showSuggestions && (
        <Card>
          <CardHeader>
            <CardTitle>✨ Ações sugeridas</CardTitle>
            <CardDescription>
              Marque as que quiser adicionar à sua família. As que já existem são ignoradas.
            </CardDescription>
          </CardHeader>
          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={() => selectAll(true)}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
            >
              Selecionar todos
            </button>
            <span className="text-gray-300">•</span>
            <button
              onClick={() => selectAll(false)}
              className="text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              Limpar
            </button>
          </div>
          <div className="space-y-4">
            {ACTION_CATEGORY_META.map((c) => {
              const items = DEFAULT_ACTION_CATALOG.filter((s) => s.category === c.value);
              if (items.length === 0) return null;
              return (
                <div key={c.value}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-700">
                      {c.emoji} {c.label}
                    </p>
                    <button
                      onClick={() => toggleCategory(items.map((i) => i.name))}
                      className="text-[11px] font-medium text-gray-400 hover:text-gray-600"
                    >
                      Marcar categoria
                    </button>
                  </div>
                  <div className="mt-1 divide-y divide-gray-50">
                    {items.map((s) => (
                      <label
                        key={s.name}
                        className="flex cursor-pointer items-center gap-2 py-1.5"
                      >
                        <input
                          type="checkbox"
                          checked={selectedNames.has(s.name)}
                          onChange={() => toggleSuggestion(s.name)}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-800">{s.name}</span>
                        <span className={`text-xs font-medium ${s.points < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                          {formatPoints(s.points)}
                        </span>
                        <span className="text-[11px] text-gray-400">{s.frequency}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4">
            <Button
              onClick={handleAddSuggested}
              loading={addingSuggestions}
              disabled={selectedNames.size === 0}
            >
              Adicionar selecionadas ({selectedNames.size})
            </Button>
          </div>
        </Card>
      )}

      {/* Create / edit form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? `Configurações de "${name}"` : 'Nova Ação'}</CardTitle>
            <CardDescription>
              {editingId
                ? 'Nome, categoria, pontos, frequência, horário — e, no fim, fundir com outra ou excluir.'
                : 'Defina uma responsabilidade, uma missão extra ou um tropeço.'}
            </CardDescription>
          </CardHeader>
          <div className="space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome da ação (ex: Arrumar cama)"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição (opcional)"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />

            {/* Category */}
            <div>
              <label className="text-xs font-medium text-gray-500">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500"
              >
                {ACTION_CATEGORY_META.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.emoji} {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-500">Pontos</label>
                <input
                  type="number"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  placeholder="0"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-500">Frequência</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500"
                >
                  {FREQUENCY_OPTIONS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 p-3">
              <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={hasDueTime}
                  onChange={(e) => setHasDueTime(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                />
                Marcar um horário
              </label>
              {hasDueTime ? (
                <input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="mt-2 w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              ) : (
                <p className="mt-1 text-[11px] text-gray-500">
                  Sem hora marcada: vale o dia todo e só vira falta no fim do dia, às {dayEnd}.
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-500">Confirmação</label>
                <select
                  value={confirmMode}
                  onChange={(e) => setConfirmMode(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                >
                  {CONFIRMATION_MODES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <Button onClick={handleSave} loading={saving} disabled={!name.trim()}>
              {editingId ? 'Salvar alterações' : 'Criar Ação'}
            </Button>

            {/* Fundir: para o par que a busca automática não pegou */}
            {editing && mergeTargets.length > 0 && (
              <div className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
                <p className="text-xs font-semibold text-indigo-800">É a mesma tarefa de outra ação?</p>
                <p className="text-[11px] text-indigo-700/80">
                  Funda as duas: o histórico se junta e fica uma ação só.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <select
                    value={mergeTargetId}
                    onChange={(e) => setMergeTargetId(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Escolha a outra ação…</option>
                    {mergeTargets.map((t) => (
                      <option key={t.id} value={t.id}>
                        {categoryMeta(t.category)?.emoji ?? '📋'} {t.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!mergeTargetId}
                    onClick={() => openMerge(editing.id, mergeTargetId)}
                  >
                    Fundir…
                  </Button>
                </div>
              </div>
            )}

            {/* Excluir vive dentro das configurações da ação, longe da lista */}
            {editingId && (
              <div className="mt-2 rounded-lg border border-red-100 bg-red-50/60 p-3">
                {!confirmingDelete ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-red-700">Excluir esta ação</p>
                      <p className="text-[11px] text-red-600/80">
                        Some do catálogo e da distribuição. Para só tirar do dia a dia, desative na lista.
                      </p>
                    </div>
                    <Button size="sm" variant="danger" onClick={() => setConfirmingDelete(true)}>
                      Excluir ação
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-red-800">
                      Excluir &quot;{name}&quot; de vez?
                    </p>
                    <ul className="space-y-0.5 text-[11px] text-red-700">
                      <li>• Sai do catálogo e da distribuição do período.</li>
                      {usage && usage.pendingCount > 0 && (
                        <li>
                          • {usage.pendingCount} pendência{usage.pendingCount === 1 ? '' : 's'} de hoje
                          some{usage.pendingCount === 1 ? '' : 'm'} da lista dos guardiões.
                        </li>
                      )}
                      {usage && usage.historyCount > 0 && (
                        <li>
                          • {usage.historyCount} registro{usage.historyCount === 1 ? '' : 's'} já
                          concluído{usage.historyCount === 1 ? '' : 's'} ou perdido{usage.historyCount === 1 ? '' : 's'}
                          continua{usage.historyCount === 1 ? '' : 'm'} contando na energia, mas sem o nome da ação.
                        </li>
                      )}
                      <li>• Não dá para desfazer.</li>
                    </ul>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="danger" onClick={handleDelete} loading={deleting}>
                        Excluir definitivamente
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Grouped by category */}
      {grouped.groups.map(({ meta, items }) =>
        items.length > 0 ? (
          <Card key={meta.value}>
            <CardHeader>
              <CardTitle>
                {meta.emoji} {meta.label} ({items.length})
              </CardTitle>
              <CardDescription>
                {meta.actionType === 'recovery'
                  ? 'Recuperação de energia'
                  : meta.actionType === 'escalada'
                    ? 'Ir além — energia extra'
                    : meta.value === 'tropecos'
                      ? 'Tiram ponto por deixar de fazer'
                      : 'Responsabilidades'}
              </CardDescription>
            </CardHeader>
            <div className="divide-y divide-gray-100">
              {items.map((t) => (
                <TemplateRow
                  key={t.id}
                  template={t}
                  onToggle={handleToggle}
                  onEdit={openEdit}
                  readOnly={!canManage}
                />
              ))}
            </div>
          </Card>
        ) : null
      )}

      {/* Legacy / hidden categories */}
      {grouped.others.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>📋 Outros ({grouped.others.length})</CardTitle>
          </CardHeader>
          <div className="divide-y divide-gray-100">
            {grouped.others.map((t) => (
              <TemplateRow key={t.id} template={t} onToggle={handleToggle} onEdit={openEdit} readOnly={!canManage} />
            ))}
          </div>
        </Card>
      )}

      {templates.length === 0 && !showForm && (
        <Card>
          <div className="text-center py-8">
            <span className="text-4xl">✅</span>
            <p className="mt-2 text-sm font-medium text-gray-700">Nenhuma ação cadastrada</p>
            <p className="mt-1 text-xs text-gray-500">
              Use &quot;✨ Ações sugeridas&quot; para adicionar as tarefas prontas ou crie uma nova.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

function TemplateRow({
  template,
  onToggle,
  onEdit,
  readOnly = false,
}: {
  template: ActionTemplate;
  onToggle: (id: string, active: boolean) => void;
  onEdit: (t: ActionTemplate) => void;
  readOnly?: boolean;
}) {
  const cat = categoryMeta(template.category);
  const modeLabel = CONFIRMATION_MODES.find(
    (m) => m.value === normalizeConfirmation(template.confirmation_mode)
  )?.label;

  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex items-center gap-2">
        <span>{cat?.emoji || '📋'}</span>
        <div>
          <p className={`text-sm font-medium ${template.is_active ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
            {template.name}
          </p>
          <p className="text-[11px] text-gray-400">
            {template.frequency ? `${template.frequency} • ` : ''}
            {hhmm(template.default_due_time) ?? 'sem hora'} • {modeLabel}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            template.points > 0
              ? 'bg-emerald-100 text-emerald-700'
              : template.points < 0
                ? 'bg-red-100 text-red-600'
                : 'bg-gray-100 text-gray-500'
          }`}
        >
          {formatPoints(template.points)}
        </span>
        {!readOnly && (
          <button
            onClick={() => onEdit(template)}
            className="rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
            title="Editar"
          >
            ✏️
          </button>
        )}
        <button
          onClick={() => !readOnly && onToggle(template.id, template.is_active)}
          disabled={readOnly}
          className={`text-[10px] font-medium ${
            template.is_active ? 'text-emerald-600' : 'text-gray-400'
          }`}
        >
          {template.is_active ? 'Ativo' : 'Inativo'}
        </button>
      </div>
    </div>
  );
}
