'use client';

// ============================================================
// Casa Quest — Dashboard: Action Templates CRUD
// Grouped by category. Supports create, edit, toggle and
// bulk-adding from the pre-registered catalog.
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import { useFamily } from '@/hooks/use-family';
import { getSupabaseBrowserClient } from '@/infrastructure/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/page';
import {
  ACTION_CATEGORY_META,
  DEFAULT_ACTION_CATALOG,
  FREQUENCY_OPTIONS,
  CATEGORY_TO_ACTION_TYPE,
  categoryMeta,
} from '@/lib/default-actions';

interface ActionTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  action_type: string;
  default_due_time: string;
  confirmation_mode: string;
  is_active: boolean;
  points: number;
  frequency: string | null;
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

export default function ActionsPage() {
  const { family, canManage, loading: familyLoading } = useFamily();
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
  const [dueTime, setDueTime] = useState('20:00');
  const [description, setDescription] = useState('');
  const [confirmMode, setConfirmMode] = useState('none');

  // Suggested actions state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [addingSuggestions, setAddingSuggestions] = useState(false);

  const supabase = getSupabaseBrowserClient();

  async function loadTemplates() {
    if (!family) return;
    const { data } = await supabase
      .from('action_templates')
      .select('*')
      .eq('family_id', family.id)
      .order('created_at', { ascending: false });
    if (data) setTemplates(data as ActionTemplate[]);
    setLoading(false);
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
    setDueTime('20:00');
    setDescription('');
    setConfirmMode('none');
    setEditingId(null);
    setShowForm(false);
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(t: ActionTemplate) {
    setName(t.name);
    setCategory(t.category);
    setPoints(t.points != null ? String(t.points) : '');
    setFrequency(t.frequency || 'diária');
    setDueTime(t.default_due_time || '20:00');
    setDescription(t.description || '');
    setConfirmMode(normalizeConfirmation(t.confirmation_mode));
    setEditingId(t.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      default_due_time: dueTime,
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
      default_due_time: '20:00',
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
      items: templates.filter((t) => t.category === c.value),
    }));
    const visible = new Set<string>(ACTION_CATEGORY_META.map((c) => c.value));
    const others = templates.filter((t) => !visible.has(t.category));
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
            <CardTitle>{editingId ? 'Editar Ação' : 'Nova Ação'}</CardTitle>
            <CardDescription>Defina uma responsabilidade, recuperação ou escalada</CardDescription>
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

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-500">Horário</label>
                <input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                />
              </div>
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
            {template.default_due_time} • {modeLabel}
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
