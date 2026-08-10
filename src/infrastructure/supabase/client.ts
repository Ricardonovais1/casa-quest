// ============================================================
// Casa Quest — Infrastructure: Supabase Browser Client
// Singleton Supabase client for client-side components.
// ============================================================

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/** Singleton instance for the browser */
let clientInstance: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowserClient() {
  if (!clientInstance) {
    clientInstance = createClient();
  }
  return clientInstance;
}
