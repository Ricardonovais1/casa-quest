'use client';

// ============================================================
// Casa Quest — Dashboard: Guardians CRUD
// ============================================================

import { useState } from 'react';
import { useFamily, type GuardianData } from '@/hooks/use-family';
import { getSupabaseBrowserClient } from '@/infrastructure/supabase/client';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GuardianAccessLink } from '@/components/guardians/guardian-access-link';

export default function GuardiansPage() {
  const { family, guardians, loading, error, reload } = useFamily();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setName('');
    setAge('');
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(g: GuardianData) {
    setName(g.name);
    setAge(g.age?.toString() || '');
    setEditingId(g.id);
    setShowForm(true);
  }

  async function handleSave() {
    if (!family || !name.trim()) return;
    setSaving(true);

    const supabase = getSupabaseBrowserClient();

    if (editingId) {
      await supabase
        .from('guardians')
        .update({ name: name.trim(), age: age ? parseInt(age) : null })
        .eq('id', editingId);
    } else {
      await supabase
        .from('guardians')
        .insert({
          family_id: family.id,
          name: name.trim(),
          age: age ? parseInt(age) : null,
          is_mor: false,
          is_active: true,
        });
    }

    resetForm();
    setSaving(false);
    reload();
  }

  async function handleToggleActive(g: GuardianData) {
    if (g.is_mor) return; // Can't deactivate Mor
    const supabase = getSupabaseBrowserClient();
    await supabase
      .from('guardians')
      .update({ is_active: !g.is_active })
      .eq('id', g.id);
    reload();
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="h-40 rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (error || !family) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Guardiões</h1>
        <p className="text-sm text-red-500">{error || 'Erro ao carregar'}</p>
      </div>
    );
  }

  const nonMorGuardians = guardians.filter(g => !g.is_mor);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Guardiões</h1>
          <p className="mt-1 text-sm text-gray-500">
            {nonMorGuardians.length} guardião{nonMorGuardians.length !== 1 ? 'es' : ''} na família
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(!showForm); }}>
          {showForm ? 'Cancelar' : '+ Novo Guardião'}
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Editar Guardião' : 'Novo Guardião'}</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do Guardião"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus
            />
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="Idade (opcional)"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <div className="flex gap-2">
              <Button onClick={handleSave} loading={saving} disabled={!name.trim()}>
                {editingId ? 'Salvar' : 'Criar Guardião'}
              </Button>
              <Button variant="ghost" onClick={resetForm}>Cancelar</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Guardians list */}
      <div className="space-y-3">
        {nonMorGuardians.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <span className="text-4xl">🦸</span>
              <p className="mt-2 text-sm font-medium text-gray-700">
                Nenhum Guardião cadastrado
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Adicione o primeiro Guardião para começar!
              </p>
            </div>
          </Card>
        ) : (
          nonMorGuardians.map((g) => (
            <Card key={g.id}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-lg">
                    🦸
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {g.name}
                      {!g.is_active && (
                        <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-600">
                          Inativo
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {g.age ? `${g.age} anos` : 'Sem idade'}
                      {g.access_token_hash && ' • Link ativo'}
                    </p>

                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => startEdit(g)}
                    className="rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleToggleActive(g)}
                    className="rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
                    title={g.is_active ? 'Desativar' : 'Ativar'}
                  >
                    {g.is_active ? '👁️' : '🚫'}
                  </button>
                </div>
              </div>

              <GuardianAccessLink guardian={g} onChange={reload} />
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
