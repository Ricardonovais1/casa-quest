'use client';

// ============================================================
// Casa Quest — Aceite do convite: só a senha
//
// O servidor já sabe de quem é o convite e de que família. Aqui a pessoa
// escolhe a senha; o servidor cria a conta ligada à família e devolve o
// e-mail para entrarmos na hora, sem passar pela tela de login.
// ============================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/infrastructure/supabase/client';
import { inputClass } from '@/components/ui/page';
import { resetFamilyCache } from '@/hooks/use-family';

interface Props {
  token: string;
  email: string;
  suggestedName: string;
  familyName: string;
  roleLabel: string;
}

export function AdvisorAcceptForm({ token, email, suggestedName, familyName, roleLabel }: Props) {
  const router = useRouter();
  const [name, setName] = useState(suggestedName);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não conferem.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/convite/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, name: name.trim() }),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setError(body?.error?.message ?? 'Não foi possível concluir o convite.');
        setBusy(false);
        return;
      }

      // A conta acabou de nascer com esta senha: entrar é imediato.
      const supabase = getSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      resetFamilyCache();

      if (signInError) {
        // A conta existe e a senha vale — só a sessão não abriu aqui.
        router.replace('/login?redirect=%2Fdashboard%2Fhoje');
        return;
      }

      router.replace('/dashboard/hoje');
      router.refresh();
    } catch {
      setError('Sem conexão com o servidor. Tente de novo.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
        Você foi convidada(o) para a família <strong>{familyName}</strong> como{' '}
        <strong>{roleLabel}</strong>. Crie uma senha para entrar — sua conta já vem ligada à casa.
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          E-mail
        </label>
        {/* Só leitura: o e-mail é o do convite, trocá-lo mudaria de quem é a conta. */}
        <input
          id="email"
          type="email"
          value={email}
          readOnly
          className={`${inputClass} mt-1 bg-gray-50 text-gray-500`}
        />
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Como a família te chama?
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${inputClass} mt-1`}
          placeholder="Seu nome"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Senha
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`${inputClass} mt-1`}
          placeholder="Mínimo 6 caracteres"
        />
      </div>

      <div>
        <label htmlFor="confirm" className="block text-sm font-medium text-gray-700">
          Repita a senha
        </label>
        <input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={`${inputClass} mt-1`}
        />
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
      >
        {busy ? 'Entrando…' : 'Criar senha e entrar'}
      </button>
    </form>
  );
}
