// ============================================================
// Casa Quest — API: Convite de um conselheiro
// GET  /api/families/adults/[id]/invite  → em que pé está
// POST /api/families/adults/[id]/invite  → verifica e, se preciso, envia
//
// É o "clicar e resolver": o POST olha se a pessoa já aceitou; se ainda
// não, manda o convite de novo e devolve o link de aceite como plano B.
// Reenviar para quem já aceitou não faz nada — e diz isso.
// ============================================================

import { NextResponse } from 'next/server';
import { requireAdult, apiError } from '@/lib/require-mor';
import { appUrl } from '@/lib/app-url';
import { deliverAdvisorInvite, inviteMessage, inviteStateOf } from '@/lib/advisor-invite';
import { roleOf } from '@/lib/roles';

async function loadAdvisor(id: string) {
  const auth = await requireAdult({ manage: true });
  if (!auth.ok) return { error: auth.response };
  const { db, me } = auth.ctx;

  const { data: advisor } = await db
    .from('guardians')
    .select('*')
    .eq('id', id)
    .eq('family_id', me.family_id)
    .maybeSingle();

  if (!advisor) return { error: apiError('NOT_FOUND', 'Pessoa não encontrada', 404) };
  if (roleOf(advisor) !== 'conselheiro') {
    return { error: apiError('INVALID_TARGET', 'Só um conselheiro tem convite por e-mail.', 422) };
  }
  if (!advisor.email) {
    return { error: apiError('NO_EMAIL', 'Esta pessoa não tem e-mail cadastrado. Convide-a de novo pelo formulário.', 422) };
  }
  return { db, me, advisor };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const loaded = await loadAdvisor(id);
  if (loaded.error) return loaded.error;
  const { advisor } = loaded;

  return NextResponse.json({
    data: {
      id: advisor.id,
      name: advisor.name,
      email: advisor.email,
      inviteState: inviteStateOf(advisor),
      invitedAt: advisor.token_expires_at ?? null,
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const loaded = await loadAdvisor(id);
  if (loaded.error) return loaded.error;
  const { db, me, advisor } = loaded;

  const { data: family } = await db
    .from('families')
    .select('name')
    .eq('id', me.family_id)
    .maybeSingle();

  const delivery = await deliverAdvisorInvite(db, {
    advisor: { ...advisor, email: advisor.email },
    inviterName: me.name,
    familyName: family?.name ?? 'sua família',
    baseUrl: appUrl(request),
  });

  return NextResponse.json({
    data: {
      id: advisor.id,
      invited: delivery.channel === 'sent',
      channel: delivery.channel,
      inviteState: delivery.state,
      message: inviteMessage(delivery, advisor.name, advisor.email),
      // O link não queima ao abrir, então serve de plano B sempre — não
      // só quando o e-mail falha.
      inviteUrl: delivery.inviteUrl,
      ...(delivery.channel === 'not_sent' ? { emailError: delivery.reason } : {}),
    },
  });
}
