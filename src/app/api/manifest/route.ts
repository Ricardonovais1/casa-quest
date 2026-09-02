// ============================================================
// Casa Quest — API: Web App Manifest with a custom start URL
// GET /api/manifest?start=/g/<token>
//
// Um guardião que instala o app a partir do próprio link precisa que o
// ícone abra a tela dele, não a landing. O manifest estático aponta
// para "/", então a página do guardião usa este manifest dinâmico.
// ============================================================

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ALLOWED_PREFIXES = ['/g/', '/dashboard'];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requested = searchParams.get('start') ?? '/';
  const start =
    ALLOWED_PREFIXES.some((p) => requested.startsWith(p)) && !requested.startsWith('//')
      ? requested
      : '/';

  const manifest = {
    name: 'Casa Quest',
    short_name: 'Casa Quest',
    description:
      'Responsabilidade não se compra, se cultiva. Tarefas da família em missões, com energia de compromisso.',
    id: start,
    start_url: start,
    scope: '/',
    display: 'standalone',
    background_color: '#f9fafb',
    theme_color: '#6366f1',
    orientation: 'portrait-primary',
    lang: 'pt-BR',
    icons: [
      { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  });
}
