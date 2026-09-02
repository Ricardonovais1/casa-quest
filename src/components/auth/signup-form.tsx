'use client';

// ============================================================
// Casa Quest — Signup Form
//
// O Supabase pode exigir confirmação de e-mail. Nesse caso o signUp
// não devolve sessão: mostramos "confira seu e-mail" em vez de mandar
// o usuário para um onboarding que vai falhar por falta de sessão.
// ============================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/infrastructure/supabase/client';
import { inputClass } from '@/components/ui/page';

export function SignupForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const [resent, setResent] = useState<string | null>(null);
  const router = useRouter();

  function callbackUrl() {
    return `${window.location.origin}/api/auth/callback?next=${encodeURIComponent('/onboarding')}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: callbackUrl(),
          data: { full_name: name.trim(), role: 'mor' },
        },
      });

      if (authError) {
        if (/already registered|already exists/i.test(authError.message)) {
          setError('Este e-mail já tem conta. Entre ou recupere a senha.');
        } else if (/rate limit/i.test(authError.message)) {
          setError('Muitas tentativas em pouco tempo. Aguarde alguns minutos.');
        } else {
          setError(authError.message);
        }
        return;
      }

      // Supabase returns an "obfuscated" user with no identities when the
      // e-mail already exists and confirmation is on.
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setError('Este e-mail já tem conta. Entre ou recupere a senha.');
        return;
      }

      if (data.session) {
        router.push('/onboarding');
        router.refresh();
        return;
      }

      setCheckEmail(true);
    } catch {
      setError('Ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setResent(null);
    const supabase = getSupabaseBrowserClient();
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: callbackUrl() },
    });
    setResent(resendError ? `Não foi possível reenviar: ${resendError.message}` : 'E-mail reenviado.');
  }

  if (checkEmail) {
    return (
      <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-5 text-center">
        <span className="text-4xl">📬</span>
        <h2 className="mt-3 text-base font-semibold text-gray-900">Confira seu e-mail</h2>
        <p className="mt-1 text-sm text-gray-600">
          Enviamos um link de confirmação para <strong>{email}</strong>. Clique nele para
          continuar e montar a sua casa.
        </p>
        <p className="mt-3 text-xs text-gray-500">
          Não chegou? Veja a caixa de spam ou{' '}
          <button type="button" onClick={resend} className="font-semibold text-indigo-600 underline">
            reenvie o e-mail
          </button>
          .
        </p>
        {resent && <p className="mt-2 text-xs text-gray-600">{resent}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Seu nome
        </label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${inputClass} mt-1`}
          placeholder="Como a família te chama"
        />
      </div>

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

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:opacity-50"
      >
        {loading ? 'Criando conta…' : 'Criar conta'}
      </button>

      <p className="text-center text-[11px] text-gray-400">
        Só você (Guardião-Mor) precisa de conta. Os guardiões entram por link.
      </p>
    </form>
  );
}
