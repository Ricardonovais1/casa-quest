// ============================================================
// Casa Quest — Login Page
// ============================================================

import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = { title: 'Entrar' };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-8 inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          ← Voltar
        </Link>

        <h1 className="mb-2 text-2xl font-bold text-gray-900">Entrar</h1>
        <p className="mb-8 text-sm text-gray-500">
          Painel do Guardião-Mor. Os guardiões não precisam de conta: eles entram pelo link.
        </p>

        <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-gray-100" />}>
          <LoginForm />
        </Suspense>

        <p className="mt-6 text-center text-sm text-gray-500">
          Ainda não tem conta?{' '}
          <Link href="/signup" className="font-semibold text-indigo-600 hover:text-indigo-500">
            Criar a minha casa
          </Link>
        </p>
      </div>
    </main>
  );
}
