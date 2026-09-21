// ============================================================
// Casa Quest — Signup Page
// ============================================================

import Link from 'next/link';
import type { Metadata } from 'next';
import { SignupForm } from '@/components/auth/signup-form';

export const metadata: Metadata = { title: 'Criar conta' };

export default function SignupPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-8 inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          ← Voltar
        </Link>

        <h1 className="mb-2 text-2xl font-bold text-gray-900">Criar a minha casa</h1>
        <p className="mb-8 text-sm text-gray-500">
          Você será o Guardião-Mor: quem configura as regras, confirma as ações e decide a mesada.
        </p>

        <SignupForm />

        {/* O aceite fica aqui, ao lado do botão que cria a casa — não escondido no rodapé. */}
        <p className="mt-5 text-center text-xs leading-relaxed text-gray-500">
          Ao criar a sua casa, você concorda com os{' '}
          <Link href="/termos" className="font-semibold text-gray-600 underline hover:text-gray-800">
            Termos de Uso
          </Link>{' '}
          e a{' '}
          <Link
            href="/privacidade"
            className="font-semibold text-gray-600 underline hover:text-gray-800"
          >
            Política de Privacidade
          </Link>
          , e declara ser responsável pelas crianças que cadastrar.
        </p>

        <p className="mt-6 text-center text-sm text-gray-500">
          Já tem conta?{' '}
          <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-500">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
