'use client';

// ============================================================
// Casa Quest — Dashboard: Guardians CRUD
// ============================================================

import { useState, useEffect } from 'react';
import { useFamily, type GuardianData } from '@/hooks/use-family';
import { getSupabaseBrowserClient } from '@/infrastructure/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function GuardiansPage() {
  const { family, guardians, loading, error, reload } = useFamily();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [saving, setSaving] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<{
    guardianId: string;
    link: string;
    guardianName: string;
  } | null>(null);

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

  async function handleGenerateToken(g: GuardianData) {
    if (g.is_mor) return;
    const supabase = getSupabaseBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();

    const res = await fetch(`/api/guardians/${g.id}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
    });

    if (res.ok) {
      const { data } = await res.json();
      setGeneratedToken({
        guardianId: g.id,
        link: data.accessLink,
        guardianName: g.name,
      });
      reload();
    }
  }

  async function handleRevokeToken(g: GuardianData) {
    const supabase = getSupabaseBrowserClient();
    await supabase
      .from('guardians')
      .update({ access_token_hash: null, token_expires_at: null })
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

              {/* Token section */}
              <div className="mt-3 border-t border-gray-100 pt-3">
                {g.access_token_hash ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-emerald-600">🔗 Link de acesso ativo</span>
                    <button
                      onClick={() => handleRevokeToken(g)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Revogar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleGenerateToken(g)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    + Gerar link de acesso
                  </button>
                )}

                {generatedToken && generatedToken.guardianId === g.id && (
                  <div className="mt-2 rounded-lg bg-emerald-50 p-3">
                    <p className="text-xs font-semibold text-emerald-800">
                      🔗 Link de {generatedToken.guardianName}:
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        readOnly
                        value={generatedToken.link}
                        className="flex-1 rounded border border-emerald-200 bg-white px-2 py-1 text-xs text-emerald-700"
                        onFocus={(e) => e.target.select()}
                      />
                      <a
                        href={generatedToken.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Abrir ↗
                      </a>
                      <button
                        onClick={() => navigator.clipboard.writeText(generatedToken.link)}
                        className="rounded bg-emerald-500 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-600"
                      >
                        Copiar
                      </button>
                    </div>
                    <p className="mt-1 text-[10px] text-emerald-600">
                      ⚠️ Guarde esse link. Ele só aparece uma vez.
                    </p>
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
