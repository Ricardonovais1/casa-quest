// ============================================================
// Casa Quest — API: Auth Callback
//
// Destino dos links de confirmação de e-mail / recuperação de senha do
// Supabase. Troca o `code` por uma sessão e leva o usuário adiante
// (por padrão, para o onboarding — é o primeiro acesso de uma família).
// ============================================================

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/infrastructure/supabase/server';

function safeNext(value: string | null): string {
  // Only allow same-origin relative paths.
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/onboarding';
  return value;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = safeNext(searchParams.get('next'));
  const errorDescription = searchParams.get('error_description');

  if (errorDescription) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription)}`
    );
  }

  const supabase = await createServerSupabaseClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    // The link was opened in another browser/device (no PKCE verifier):
    // the account is confirmed anyway, so a normal login works.
    return NextResponse.redirect(`${origin}/login?confirmed=1&redirect=${encodeURIComponent(next)}`);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as 'signup' | 'email' | 'recovery' | 'magiclink' | 'invite' | 'email_change',
    });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  return NextResponse.redirect(`${origin}/login`);
}
