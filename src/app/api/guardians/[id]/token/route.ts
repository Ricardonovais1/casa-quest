// ============================================================
// Casa Quest — API: Generate/Regenerate Guardian Token
// POST /api/guardians/[id]/token
// ============================================================

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/infrastructure/supabase/server';

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Não autenticado' } },
        { status: 403 }
      );
    }

    // Verify user is Mor of the guardian's family
    const { data: targetGuardian } = await supabase
      .from('guardians')
      .select('id, family_id, name')
      .eq('id', id)
      .single();

    if (!targetGuardian) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Guardião não encontrado' } },
        { status: 404 }
      );
    }

    const { data: morGuardian } = await supabase
      .from('guardians')
      .select('id')
      .eq('user_id', user.id)
      .eq('family_id', targetGuardian.family_id)
      .eq('is_mor', true)
      .single();

    if (!morGuardian) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Apenas o Guardião-Mor pode gerar tokens' } },
        { status: 403 }
      );
    }

    // Generate new token
    const token = crypto.randomUUID();

    // Hash it
    // DECISION: Use Web Crypto API for SHA-256 hashing
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const tokenHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    // Set expiry: 90 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    // Store hash
    await supabase
      .from('guardians')
      .update({
        access_token_hash: tokenHash,
        token_expires_at: expiresAt.toISOString(),
      })
      .eq('id', id);

    const appUrl = getBaseUrl(request);
    const accessLink = `${appUrl}/g/${token}`;

    return NextResponse.json({
      data: {
        token, // Only returned once! Store it securely.
        accessLink,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Erro interno' } },
      { status: 500 }
    );
  }
}
