// ============================================================
// Casa Quest — Next.js Middleware
// DECISION: Simplified auth. Middleware only refreshes session.
// Auth checks happen at page/API level via createServerSupabaseClient.
// This avoids cookie-handling race conditions in middleware.
// ============================================================

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Create a response that we'll modify
  const response = NextResponse.next({ request });

  // Only set up Supabase client for session refresh
  // NOT for auth gating — that's done at the page level
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Set cookies on the RESPONSE, not the request
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, {
              ...options,
              // Ensure cookies work cross-subdomain in dev
              sameSite: 'lax',
            });
          });
        },
      },
    }
  );

  // Refresh the session — keeps the cookie fresh
  // This is a no-op if there's no session
  await supabase.auth.getSession();

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|.*\\.png$).*)',
  ],
};
