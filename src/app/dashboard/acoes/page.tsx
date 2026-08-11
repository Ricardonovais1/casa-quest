'use client';

// ============================================================
// Casa Quest — Dashboard: Action Templates CRUD
// ============================================================

import { useState, useEffect } from 'react';
import { useFamily } from '@/hooks/use-family';
import { getSupabaseBrowserClient } from '@/infrastructure/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ActionTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  action_type: string;
  default_due_time: string;
  confirmation_mode: string;
  is_active: boolean;
}

const CATEGORIES = [
  { value: 'habitos', label: '🛏️ Hábitos', emoji: '🛏️' },
  { value: 'cooperacao', label: '🤝 Cooperação', emoji: '🤝' },
  { value: 'missoes', label: '🏆 Missões', emoji: '🏆' },
  { value: 'gentilezas', label: '💝 Gentilezas', emoji: '💝' },
  { value: 'autoaperfeicoamento', label: '📚 Autoaperfeiçoamento', emoji: '📚' },
  { value: 'rendimento_escolar', label: '🎓 Rendimento Escolar', emoji: '🎓' },
];

const CONFIRMATION_MODES = [
  { value: 'none', label: 'Sem confirmação' },
  { value: 'one_peer', label: '1 pessoa confirma' },
  { value: 'quorum', label: 'Quórum da família' },
  { value: 'adult_only', label: 'Só o Mor' },
];

export default function ActionsPage() {
  const { family, loading: familyLoading } = useFamily();
  const [templates, setTemplates] = useState<ActionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('habitos');
  const [actionType, setActionType] = useState('basic');
  const [dueTime, setDueTime] = useState('20:00');
  const [description, setDescription] = useState('');
  const [confirmMode, setConfirmMode] = useState('none');

  const supabase = getSupabaseBrowserClient();

  async function loadTemplates() {
    if (!family) return;
    const { data } = await supabase
      .from('action_templates')
      .select('*')
      .eq('family_id', family.id)
      .order('created_at', { ascending: false });
    if (data) setTemplates(data);
    setLoading(false);
  }

  useEffect(() => {
    if (family) loadTemplates();
  }, [family]);

  function resetForm() {
    setName('');
    setCategory('habitos');
    setActionType('basic');
    setDueTime('20:00');
    setDescription('');
    setConfirmMode('none');
    setShowForm(false);
  }

  async function handleCreate() {
    if (!family || !name.trim()) return;
    setSaving(true);

    const { error } = await supabase
      .from('action_templates')
      .insert({
        family_id: family.id,
        name: name.trim(),
        description: description.trim() || null,
        category,
        action_type: actionType,
        default_due_time: dueTime,
        confirmation_mode: confirmMode,
      });

    if (error) {
      alert('Erro: ' + error.message);
    } else {
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

  if (familyLoading || loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="h-40 rounded-xl bg-gray-100" />
      </div>
    );
  }

  const basicTemplates = templates.filter(t => t.action_type === 'basic');
  const recoveryTemplates = templates.filter(t => t.action_type === 'recovery');
  const escaladaTemplates = templates.filter(t => t.action_type === 'escalada');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ações</h1>
          <p className="mt-1 text-sm text-gray-500">
            {templates.length} template{templates.length !== 1 ? 's' : ''} cadastrado{templates.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(!showForm); }}>
          {showForm ? 'Cancelar' : '+ Nova Ação'}
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Nova Ação</CardTitle>
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

            {/* Action type */}
            <div>
              <label className="text-xs font-medium text-gray-500">Tipo</label>
              <div className="mt-1 flex gap-2">
                {[
                  { value: 'basic', label: 'Básica', color: 'bg-blue-50 border-blue-300' },
                  { value: 'recovery', label: 'Recuperação', color: 'bg-orange-50 border-orange-300' },
                  { value: 'escalada', label: 'Escalada', color: 'bg-purple-50 border-purple-300' },
                ].map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setActionType(t.value)}
                    className={`flex-1 rounded-lg border-2 px-3 py-2 text-xs font-semibold transition-colors ${
                      actionType === t.value
                        ? `${t.color} border-indigo-500`
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="text-xs font-medium text-gray-500">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
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

            <Button onClick={handleCreate} loading={saving} disabled={!name.trim()}>
              Criar Ação
            </Button>
          </div>
        </Card>
      )}

      {/* Basic actions */}
      {basicTemplates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>✅ Ações básicas ({basicTemplates.length})</CardTitle>
            <CardDescription>Responsabilidades diárias</CardDescription>
          </CardHeader>
          <div className="divide-y divide-gray-100">
            {basicTemplates.map((t) => (
              <TemplateRow key={t.id} template={t} onToggle={handleToggle} />
            ))}
          </div>
        </Card>
      )}

      {/* Recovery */}
      {recoveryTemplates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>🔄 Recuperação ({recoveryTemplates.length})</CardTitle>
            <CardDescription>+2 energia por execução</CardDescription>
          </CardHeader>
          <div className="divide-y divide-gray-100">
            {recoveryTemplates.map((t) => (
              <TemplateRow key={t.id} template={t} onToggle={handleToggle} />
            ))}
          </div>
        </Card>
      )}

      {/* Escalada */}
      {escaladaTemplates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>⬆️ Escalada ({escaladaTemplates.length})</CardTitle>
            <CardDescription>Energia extra por ir além</CardDescription>
          </CardHeader>
          <div className="divide-y divide-gray-100">
            {escaladaTemplates.map((t) => (
              <TemplateRow key={t.id} template={t} onToggle={handleToggle} />
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
              Crie ações como &quot;Arrumar cama&quot; ou &quot;Tirar lixo&quot;
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
}: {
  template: ActionTemplate;
  onToggle: (id: string, active: boolean) => void;
}) {
  const cat = CATEGORIES.find(c => c.value === template.category);
  const modeLabel = CONFIRMATION_MODES.find(m => m.value === template.confirmation_mode)?.label;

  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex items-center gap-2">
        <span>{cat?.emoji || '📋'}</span>
        <div>
          <p className={`text-sm font-medium ${template.is_active ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
            {template.name}
          </p>
          <p className="text-[11px] text-gray-400">
            {template.default_due_time} • {modeLabel}
          </p>
        </div>
      </div>
      <button
        onClick={() => onToggle(template.id, template.is_active)}
        className={`text-[10px] font-medium ${
          template.is_active ? 'text-emerald-600' : 'text-gray-400'
        }`}
      >
        {template.is_active ? 'Ativo' : 'Inativo'}
      </button>
    </div>
  );
}
