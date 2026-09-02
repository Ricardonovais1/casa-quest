'use client';

// ============================================================
// Casa Quest — Convite (segundo adulto da casa)
//
// Destino do e-mail de convite do Supabase. O link chega com a sessão
// no fragmento da URL; o client do Supabase a captura, o servidor liga a
// conta ao registro convidado e a pessoa define a senha.
// ============================================================

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/infrastructure/supabase/client';
import { inputClass } from '@/components/ui/page';
import { resetFamilyCache } from '@/hooks/use-family';

type Stage = 'checking' | 'set-password' | 'no-session' | 'done';

function InviteFlow() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('checking');
  const [familyName, setFamilyName] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let cancelled = false;

    async function settle() {
      // Give supabase-js a moment to consume "#access_token=…" from the URL.
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) {
        // Some clients deliver the session slightly later; listen once.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
          if (s && !cancelled) {
            subscription.unsubscribe();
            finish(s.user.user_metadata?.full_name as string | undefined);
          }
        });
        const fallback = setTimeout(() => {
          subscription.unsubscribe();
          if (!cancelled) setStage('no-session');
        }, 4000);
        return () => clearTimeout(fallback);
      }
      finish(session.user.user_metadata?.full_name as string | undefined);
    }

    async function finish(suggestedName?: string) {
      const res = await fetch('/api/auth/claim', { method: 'POST' });
      const body = await res.json().catch(() => null);
      if (cancelled) return;
      if (body?.data?.member) {
        resetFamilyCache();
        const supabase = getSupabaseBrowserClient();
        const { data: fam } = await supabase.from('families').select('name').limit(1).maybeSingle();
        setFamilyName(fam?.name ?? null);
      }
      if (suggestedName) setName(suggestedName);
      setStage('set-password');
    }

    settle();
    return () => {
      cancelled = true;
    };
  }, []);

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
    const supabase = getSupabaseBrowserClient();
    const { error: pwError } = await supabase.auth.updateUser({
      password,
      data: name.trim() ? { full_name: name.trim() } : undefined,
    });
    if (pwError) {
      setError(pwError.message);
      setBusy(false);
      return;
    }
    setStage('done');
    resetFamilyCache();
    router.replace('/dashboard/hoje');
  }

  if (stage === 'checking') {
    return (
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        <p className="mt-3 text-sm text-gray-500">Abrindo seu convite…</p>
      </div>
    );
  }

  if (stage === 'no-session') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
        <span className="text-4xl">🔗</span>
        <h2 className="mt-3 text-base font-semibold text-gray-900">Este link de convite não abriu</h2>
        <p className="mt-1 text-sm text-gray-600">
          Ele pode ter vencido ou já ter sido usado. Se você já definiu uma senha, é só entrar.
          Senão, peça ao Guardião-Mor para convidar de novo.
        </p>
        <Link href="/login" className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
          Entrar
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
        {familyName ? (
          <>Você entrou na família <strong>{familyName}</strong> como Conselheiro(a). Defina uma senha para acessar o painel quando quiser.</>
        ) : (
          <>Defina uma senha para acessar o painel quando quiser.</>
        )}
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">Como a família te chama?</label>
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
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">Senha</label>
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
        <label htmlFor="confirm" className="block text-sm font-medium text-gray-700">Repita a senha</label>
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
        {busy ? 'Salvando…' : 'Entrar na Casa Quest'}
      </button>
    </form>
  );
}

export default function InvitePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-lg shadow-sm">🏠</span>
          <span className="text-lg font-bold tracking-tight text-gray-900">Casa Quest</span>
        </div>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Bem-vindo ao conselho da casa</h1>
        <p className="mb-6 text-sm text-gray-500">
          Conselheiros confirmam ações, registram tropeços e extras e acompanham a energia dos guardiões.
        </p>
        <Suspense fallback={null}>
          <InviteFlow />
        </Suspense>
      </div>
    </main>
  );
}
