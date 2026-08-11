'use client';

import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/infrastructure/supabase/client';

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-sm text-gray-500 hover:text-red-600 transition-colors"
    >
      Sair
    </button>
  );
}
