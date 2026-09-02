import Link from 'next/link';

export default function GuardianNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="max-w-sm text-center">
        <span className="text-5xl">🔗</span>
        <h1 className="mt-4 text-xl font-bold text-gray-900">Este link não existe mais</h1>
        <p className="mt-2 text-sm text-gray-500">
          Ele pode ter sido trocado ou desativado. Peça ao seu Guardião-Mor o link atual.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm font-semibold text-indigo-600">
          Ir para a página inicial
        </Link>
      </div>
    </main>
  );
}
