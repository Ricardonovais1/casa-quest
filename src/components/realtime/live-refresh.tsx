'use client';

// ============================================================
// Casa Quest — Live Refresh
// Mantém uma tela do servidor sempre em dia, sem recarregar o app.
//
// Ouve o canal da família (Supabase Broadcast) e, a cada aviso de
// mudança, pede ao Next para renderizar de novo a página do servidor.
// Redes de segurança, para o caso do websocket cair no celular:
// atualiza ao voltar para o primeiro plano, ao reconectar e a cada dois
// minutos enquanto a tela está visível.
// ============================================================

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/infrastructure/supabase/client';
import { FAMILY_CHANGED_EVENT } from '@/lib/constants';

/** Janela mínima entre dois refreshes — junta rajadas de avisos. */
const MIN_GAP_MS = 800;
/** Checagem periódica, caso o tempo real esteja indisponível. */
const FALLBACK_MS = 120_000;

export function LiveRefresh({ channel }: { channel: string }) {
  const router = useRouter();
  const lastAt = useRef(0);

  useEffect(() => {
    let alive = true;

    function refresh() {
      if (!alive || document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastAt.current < MIN_GAP_MS) return;
      lastAt.current = now;
      router.refresh();
    }

    const supabase = getSupabaseBrowserClient();
    const sub = supabase
      .channel(channel)
      .on('broadcast', { event: FAMILY_CHANGED_EVENT }, refresh)
      .subscribe();

    // Voltar ao app depois de um tempo fora: recarrega o que perdeu.
    function onWake() {
      if (document.visibilityState === 'visible') refresh();
    }

    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    window.addEventListener('online', onWake);
    const timer = setInterval(onWake, FALLBACK_MS);

    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
      window.removeEventListener('online', onWake);
      supabase.removeChannel(sub);
    };
  }, [channel, router]);

  return null;
}
