// ============================================================
// Casa Quest — API: Sign Out
// ============================================================

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/infrastructure/supabase/server';

export async function POST() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'));
}
