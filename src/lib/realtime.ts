// ============================================================
// Casa Quest — Lib: Avisos em tempo real (Supabase Broadcast)
//
// Quando algo muda no dia da família — a distribuição das atividades,
// uma ação marcada como feita, a decisão de um adulto — o servidor
// manda um aviso no canal da família. As telas abertas (o link de cada
// guardião) ouvem e se atualizam sozinhas, sem recarregar o app.
//
// O aviso não carrega dado nenhum, só "mudou". O nome do canal é um
// hash do id da família, para não expor o id na página do guardião.
//
// Servidor-only: usa node:crypto e a service role. O navegador recebe
// o nome do canal pronto, como propriedade.
// ============================================================

import { createHash } from 'node:crypto';
import { FAMILY_CHANGED_EVENT } from './constants';

export type FamilyChangeScope = 'distribution' | 'actions' | 'day';

/** Nome do canal de broadcast de uma família. Estável e opaco. */
export function familyChannelName(familyId: string): string {
  const digest = createHash('sha256').update(`casaquest:family:${familyId}`).digest('hex');
  return `family-${digest.slice(0, 32)}`;
}

/**
 * Avisa as telas abertas da família que algo mudou.
 *
 * Best-effort de propósito: um aviso perdido (rede, Realtime fora do ar)
 * nunca pode derrubar a operação que acabou de dar certo. Sem ele, a tela
 * ainda atualiza ao voltar para o primeiro plano ou na checagem periódica.
 */
export async function notifyFamilyChanged(
  familyId: string,
  scope: FamilyChangeScope
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            topic: familyChannelName(familyId),
            event: FAMILY_CHANGED_EVENT,
            payload: { scope, at: Date.now() },
            private: false,
          },
        ],
      }),
      // O aviso é secundário: não vale segurar a resposta da API por ele.
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // silêncio proposital
  }
}
