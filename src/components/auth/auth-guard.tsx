'use client';

// ============================================================
// Casa Quest — AuthGuard
// Wraps protected pages. Redirects to /login if no session.
// ============================================================

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/infrastructure/supabase/client';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function check() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // Not logged in — redirect to login
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
        return;
      }

      setChecking(false);
    }

    check();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace('/login');
      } else {
        setChecking(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, pathname]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <p className="mt-3 text-sm text-gray-500">Carregando...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
