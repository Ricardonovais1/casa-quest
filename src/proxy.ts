// ============================================================
// Casa Quest — Next.js Proxy (formerly middleware)
// DECISION: Simplified auth. The proxy only refreshes the session cookie.
// Auth checks happen at page/API level via createServerSupabaseClient.
// This avoids cookie-handling race conditions in the proxy layer.
// ============================================================

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Keep request and response in sync so server components rendered
          // in this same pass see the refreshed cookie too.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, { ...options, sameSite: 'lax' })
          );
        },
      },
    }
  );

  // Refreshes the token when expired. No-op without a session.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|icons/|api/cron/|.*\\.(?:png|svg|ico)$).*)',
  ],
};
