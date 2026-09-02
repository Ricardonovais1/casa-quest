'use client';

// ============================================================
// Casa Quest — Dashboard: Guardiões (crianças e adolescentes)
// ============================================================

import { useState } from 'react';
import Link from 'next/link';
import { useFamily, type GuardianData } from '@/hooks/use-family';
import { getSupabaseBrowserClient } from '@/infrastructure/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader, EmptyState, Notice, PageSkeleton, inputClass } from '@/components/ui/page';
import { GenderSelect, type GenderValue } from '@/components/ui/gender-select';
import { GuardianAccessLink } from '@/components/guardians/guardian-access-link';
import { roleLabel } from '@/lib/roles';

export default function GuardiansPage() {
  const { family, kids, canManage, schemaHasRoles, loading, error, reload } = useFamily();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<GenderValue>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  function resetForm() {
    setName('');
    setAge('');
    setGender(null);
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(g: GuardianData) {
    setName(g.name);
    setAge(g.age?.toString() || '');
    setGender(g.gender ?? null);
    setEditingId(g.id);
    setShowForm(true);
  }

  async function handleSave() {
    if (!family || !name.trim()) return;
    setSaving(true);
    setNotice(null);

    const supabase = getSupabaseBrowserClient();
    const payload: Record<string, unknown> = { name: name.trim(), age: age ? parseInt(age) : null };
    // The gender column only exists after migration 00008.
    if (schemaHasRoles) payload.gender = gender;

    const { error: saveError } = editingId
      ? await supabase.from('guardians').update(payload).eq('id', editingId)
      : await supabase.from('guardians').insert({
          family_id: family.id,
          ...payload,
          is_mor: false,
          is_active: true,
          ...(schemaHasRoles ? { role: 'guardiao' } : {}),
        });

    if (saveError) {
      setNotice({ kind: 'error', text: 'Não foi possível salvar: ' + saveError.message });
    } else {
      setNotice({ kind: 'success', text: editingId ? 'Guardião atualizado.' : 'Guardião cadastrado. Gere o link de acesso abaixo.' });
      resetForm();
      reload();
    }
    setSaving(false);
  }

  async function handleToggleActive(g: GuardianData) {
    const supabase = getSupabaseBrowserClient();
    await supabase.from('guardians').update({ is_active: !g.is_active }).eq('id', g.id);
    reload();
  }

  if (loading) return <PageSkeleton blocks={2} />;

  if (error || !family) {
    return (
      <div className="space-y-6">
        <PageHeader title="Guardiões" />
        <Notice kind="error">{error || 'Erro ao carregar'}</Notice>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="space-y-6">
        <PageHeader title="Guardiões" subtitle="Cadastro das crianças e adolescentes" />
        <Notice kind="info">
          Só o Guardião-Mor cadastra guardiões e gera links. Você vê a lista em{' '}
          <Link href="/dashboard/familia" className="font-semibold underline">Família</Link>.
        </Notice>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Guardiões"
        subtitle={`${kids.length} guardiã${kids.length === 1 ? 'o' : 'es'} na família · crianças e adolescentes que entram por link`}
        actions={
          <Button onClick={() => { resetForm(); setShowForm(!showForm); }}>
            {showForm ? 'Cancelar' : '+ Novo guardião'}
          </Button>
        }
      />

      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Editar guardião' : 'Novo guardião'}</CardTitle>
            <CardDescription>Outro adulto da casa? Convide em Família, como Conselheiro(a).</CardDescription>
          </CardHeader>
          <div className="space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome"
              className={inputClass}
              autoFocus
            />
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="Idade (opcional)"
              className={inputClass}
              min="0"
              max="120"
            />
            {schemaHasRoles && (
              <div>
                <label className="text-xs font-medium text-gray-500">Como chamar</label>
                <GenderSelect value={gender} onChange={setGender} labels={{ f: 'Guardiã', m: 'Guardião' }} className="mt-1" />
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={handleSave} loading={saving} disabled={!name.trim()}>
                {editingId ? 'Salvar' : 'Cadastrar'}
              </Button>
              <Button variant="ghost" onClick={resetForm}>Cancelar</Button>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {kids.length === 0 ? (
          <EmptyState
            icon="🦸"
            title="Nenhum guardião cadastrado"
            description="Cadastre a primeira criança ou adolescente para gerar o link de acesso dela."
            action={<Button onClick={() => setShowForm(true)}>Cadastrar guardião</Button>}
          />
        ) : (
          kids.map((g) => (
            <Card key={g.id}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-lg">🦸</div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {g.name}
                      {!g.is_active && (
                        <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-600">Inativo</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {roleLabel(g)}
                      {g.age ? ` · ${g.age} anos` : ''}
                      {g.access_token && ' · link ativo'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => startEdit(g)}
                    className="rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
                    title="Editar"
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
