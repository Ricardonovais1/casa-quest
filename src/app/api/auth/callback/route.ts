// ============================================================
// Casa Quest — API: Auth Callback (Supabase OAuth)
// ============================================================

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/infrastructure/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
