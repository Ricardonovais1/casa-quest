// ============================================================
// Casa Quest — Login Page
// ============================================================

import Link from 'next/link';
import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        {/* Back link */}
        <Link
          href="/"
          className="mb-8 inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          ← Voltar
        </Link>

        <h1 className="mb-2 text-2xl font-bold text-gray-900">Entrar</h1>
        <p className="mb-8 text-sm text-gray-500">
          Acesse sua conta de Guardião-Mor
        </p>

        <LoginForm />

        <p className="mt-6 text-center text-sm text-gray-500">
          Não tem conta?{' '}
          <Link
            href="/signup"
            className="font-semibold text-indigo-600 hover:text-indigo-500"
          >
            Criar conta
          </Link>
        </p>
      </div>
    </main>
  );
}
