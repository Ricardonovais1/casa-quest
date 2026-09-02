'use client';

// ============================================================
// Casa Quest — Login Form
// ============================================================

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/infrastructure/supabase/client';
import { inputClass } from '@/components/ui/page';

function safeRedirect(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirect = safeRedirect(searchParams.get('redirect'));
  const confirmed = searchParams.get('confirmed') === '1';
  const urlError = searchParams.get('error');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError || !data.user) {
        if (/not confirmed/i.test(authError?.message ?? '')) {
          setError('Confirme seu e-mail antes de entrar. Procure o link na sua caixa de entrada.');
        } else {
          setError('E-mail ou senha inválidos.');
        }
        return;
      }

      // First login without a family yet → onboarding.
      const { data: mor } = await supabase
        .from('guardians')
        .select('id')
        .eq('user_id', data.user.id)
        .eq('is_mor', true)
        .maybeSingle();

      const target = !mor ? '/onboarding' : redirect || '/dashboard';
      router.push(target);
      router.refresh();
    } catch {
      setError('Ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot() {
    setResetSent(null);
    if (!email.trim()) {
      setError('Digite seu e-mail para receber o link de redefinição.');
      return;
    }
    const supabase = getSupabaseBrowserClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent('/dashboard/config?reset=1')}`,
    });
    setResetSent(
      resetError ? `Não foi possível enviar: ${resetError.message}` : 'Se o e-mail existir, enviamos um link para redefinir a senha.'
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {confirmed && !error && (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          E-mail confirmado! Entre para continuar.
        </div>
      )}
      {urlError && !error && (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">{urlError}</div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {resetSent && (
        <div className="rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-700">{resetSent}</div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`${inputClass} mt-1`}
          placeholder="voce@email.com"
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Senha
          </label>
          <button
            type="button"
            onClick={handleForgot}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
          >
            Esqueci a senha
          </button>
        </div>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`${inputClass} mt-1`}
          placeholder="Sua senha"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:opacity-50"
      >
        {loading ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
