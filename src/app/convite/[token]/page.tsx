// ============================================================
// Casa Quest — Convite do conselheiro (link com token)
//
// A página resolve o token NO SERVIDOR: quando ela abre, o nome da
// família já está na tela. Isso é o contrário do fluxo antigo, que
// dependia de uma sessão vinda no fragmento da URL e, quando ela não
// chegava, não sabia nem de quem era o convite.
//
// Aqui não existe sessão nenhuma ainda — e não precisa. A pessoa só
// escolhe a senha; o vínculo com a família já veio no link.
// ============================================================

import type { Metadata } from 'next';
import Link from 'next/link';
import { createServiceClient } from '@/infrastructure/supabase/server';
import { resolveInviteToken } from '@/lib/advisor-invite';
import { roleLabel } from '@/lib/roles';
import { AdvisorAcceptForm } from '@/components/auth/advisor-accept-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Seu convite — Casa Quest',
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ token: string }>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-lg shadow-sm">
            🏠
          </span>
          <span className="text-lg font-bold tracking-tight text-gray-900">Casa Quest</span>
        </div>
        {children}
      </div>
    </main>
  );
}

export default async function InviteTokenPage({ params }: PageProps) {
  const { token } = await params;
  const db = await createServiceClient();
  const found = await resolveInviteToken(db, token);

  if (!found.ok) {
    const expired = found.reason === 'expired';
    return (
      <Shell>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
          <span className="text-4xl">🔗</span>
          <h1 className="mt-3 text-base font-semibold text-gray-900">
            {expired ? 'Este convite venceu' : 'Este convite não vale mais'}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {expired
              ? 'Peça ao Guardião-Mor da casa para enviar um convite novo — leva um clique.'
              : 'Ou ele já foi usado, ou foi substituído por um mais novo. Se você já criou sua senha, é só entrar.'}
          </p>
          <Link
            href="/login"
            className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Entrar
          </Link>
        </div>
      </Shell>
    );
  }

  const { advisor } = found;
  const { data: family } = await db
    .from('families')
    .select('name')
    .eq('id', advisor.family_id)
    .maybeSingle();

  return (
    <Shell>
      <h1 className="mb-2 text-2xl font-bold text-gray-900">Bem-vindo ao conselho da casa</h1>
      <p className="mb-6 text-sm text-gray-500">
        Conselheiros confirmam ações, registram tropeços e extras e acompanham a energia dos
        guardiões.
      </p>
      <AdvisorAcceptForm
        token={token}
        email={advisor.email}
        suggestedName={advisor.name}
        familyName={family?.name ?? 'sua família'}
        roleLabel={roleLabel(advisor)}
      />
    </Shell>
  );
}
