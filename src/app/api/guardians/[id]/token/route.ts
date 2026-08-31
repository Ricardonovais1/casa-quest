// ============================================================
// Casa Quest — API: Guardian Access Link
// GET  /api/guardians/[id]/token  → devolve o link atual (se houver)
// POST /api/guardians/[id]/token  → gera/regenera o link
// ============================================================

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/infrastructure/supabase/server';

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
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fail(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * Ensure the caller is the Guardião-Mor of the target guardian's family.
 * Returns the target guardian row, or a ready-to-return error response.
 */
async function authorizeMor(id: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: fail('UNAUTHORIZED', 'Não autenticado', 401) };
  }

  const { data: targetGuardian } = await supabase
    .from('guardians')
    .select('id, family_id, name')
    .eq('id', id)
    .single();

  if (!targetGuardian) {
    return { error: fail('NOT_FOUND', 'Guardião não encontrado', 404) };
  }

  const { data: morGuardian } = await supabase
    .from('guardians')
    .select('id')
    .eq('user_id', user.id)
    .eq('family_id', targetGuardian.family_id)
    .eq('is_mor', true)
    .single();

  if (!morGuardian) {
    return {
      error: fail(
        'FORBIDDEN',
        'Apenas o Guardião-Mor pode gerenciar links de acesso',
        403
      ),
    };
  }

  return { supabase, guardian: targetGuardian };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await authorizeMor(id);
    if (auth.error) return auth.error;

    const { supabase } = auth;

    const token = crypto.randomUUID();
    const tokenHash = await sha256Hex(token);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TOKEN_TTL_DAYS);

    // Store the hash (used for the indexed /g/[token] lookup) plus the plain
    // token, so the Mor can reopen and reshare the link at any time.
    const { error: updateError } = await supabase
      .from('guardians')
      .update({
        access_token: token,
        access_token_hash: tokenHash,
        token_expires_at: expiresAt.toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      return fail('DB_ERROR', `Não foi possível salvar o link: ${updateError.message}`, 500);
    }

    return NextResponse.json({
      data: {
        accessLink: `${getBaseUrl(request)}/g/${token}`,
        expiresAt: expiresAt.toISOString(),
        expired: false,
      },
    });
  } catch {
    return fail('INTERNAL', 'Erro interno', 500);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await authorizeMor(id);
    if (auth.error) return auth.error;

    const { supabase } = auth;

    const { error: updateError } = await supabase
      .from('guardians')
      .update({
        access_token: null,
        access_token_hash: null,
        token_expires_at: null,
      })
      .eq('id', id);

    if (updateError) {
      return fail('DB_ERROR', `Não foi possível revogar o link: ${updateError.message}`, 500);
    }

    return NextResponse.json({ data: { accessLink: null, revoked: true } });
  } catch {
    return fail('INTERNAL', 'Erro interno', 500);
  }
}
