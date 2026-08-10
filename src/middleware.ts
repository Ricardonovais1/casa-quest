// ============================================================
// Casa Quest — Next.js Middleware
// Protects routes, validates guardian tokens, handles auth.
// ============================================================

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Public routes — no auth required
  const publicPaths = ['/', '/login', '/signup', '/manifest.json', '/icons'];
  const isPublic = publicPaths.some(
    (p) => pathname === p || pathname.startsWith('/api/auth')
  );

  // Guardian token access — /g/[token]
  if (pathname.startsWith('/g/')) {
    // Guardian access is handled by the page itself (token validation)
    // No Supabase auth required — the token is the auth
    return supabaseResponse;
  }

  // Protected routes
  if (!isPublic && !user) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // If logged in and on public page, redirect to dashboard
  if (user && (pathname === '/' || pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|.*\\.png$).*)',
  ],
};
