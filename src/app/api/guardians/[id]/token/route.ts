// ============================================================
// Casa Quest — API: Guardian Access Link
// POST   /api/guardians/[id]/token  → gera/regenera o link
// DELETE /api/guardians/[id]/token  → revoga o link
//
// Só quem gerencia a casa (Mor, ou Conselheiro com poderes iguais).
// ============================================================

import { NextResponse } from 'next/server';
import { requireAdult, apiError } from '@/lib/require-mor';

const TOKEN_TTL_DAYS = 90;

/**
 * Derive the app's public base URL from the incoming request so generated
 * guardian links never hard-code `localhost`. Priority:
 *   1. A real (non-localhost) NEXT_PUBLIC_APP_URL, if configured
 *   2. The forwarded host/proto (works on Vercel & behind proxies)
 *   3. The request host
 *   4. localhost fallback (local dev)
 */
function getBaseUrl(request: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env && !/^https?:\/\/localhost\b/i.test(env)) {
    return env.replace(/\/+$/, '');
  }

  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = request.headers.get('host');

  const resolvedHost = forwardedHost || host;
  if (resolvedHost) {
    return `${forwardedProto || 'http'}://${resolvedHost}`;
  }

  return env || 'http://localhost:3000';
}

async function sha256Hex(value: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** The target must be a child (link access) of the caller's family. */
async function loadTarget(id: string) {
  const auth = await requireAdult({ manage: true });
  if (!auth.ok) return { error: auth.response };
  const { db, me } = auth.ctx;

  const { data: target } = await db
    .from('guardians')
    .select('id, family_id, name, is_mor, user_id')
    .eq('id', id)
    .eq('family_id', me.family_id)
    .maybeSingle();

  if (!target) return { error: apiError('NOT_FOUND', 'Guardião não encontrado', 404) };
  if (target.is_mor || target.user_id) {
    return { error: apiError('INVALID_TARGET', 'Adultos entram com e-mail e senha, não por link', 422) };
  }
  return { db, target };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const loaded = await loadTarget(id);
    if (loaded.error) return loaded.error;
    const { db } = loaded;

    const token = crypto.randomUUID();
    const tokenHash = await sha256Hex(token);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TOKEN_TTL_DAYS);

    // Store the hash (used for the indexed /g/[token] lookup) plus the plain
    // token, so the family can reopen and reshare the link at any time.
    const { error: updateError } = await db
      .from('guardians')
      .update({
        access_token: token,
        access_token_hash: tokenHash,
        token_expires_at: expiresAt.toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      return apiError('DB_ERROR', `Não foi possível salvar o link: ${updateError.message}`, 500);
    }

    return NextResponse.json({
      data: {
        accessLink: `${getBaseUrl(request)}/g/${token}`,
        expiresAt: expiresAt.toISOString(),
        expired: false,
      },
    });
  } catch {
    return apiError('INTERNAL', 'Erro interno', 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const loaded = await loadTarget(id);
    if (loaded.error) return loaded.error;
    const { db } = loaded;

    const { error: updateError } = await db
      .from('guardians')
      .update({ access_token: null, access_token_hash: null, token_expires_at: null })
      .eq('id', id);

    if (updateError) {
      return apiError('DB_ERROR', `Não foi possível revogar o link: ${updateError.message}`, 500);
    }

    return NextResponse.json({ data: { accessLink: null, revoked: true } });
  } catch {
    return apiError('INTERNAL', 'Erro interno', 500);
  }
}
