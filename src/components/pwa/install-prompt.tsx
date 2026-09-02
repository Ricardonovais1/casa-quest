'use client';

// ============================================================
// Casa Quest — PWA: "Adicionar à tela inicial"
//
// Android/Chrome: usa o evento beforeinstallprompt e instala com um
// toque. iOS/Safari: não existe API, então mostra o caminho
// (Compartilhar → Adicionar à Tela de Início). Some quando já está
// instalado (display-mode: standalone) ou quando a pessoa dispensa.
// ============================================================

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'casaquest:install-dismissed';
const DISMISS_DAYS = 14;

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/i.test(ua) || iPadOs;
}

function recentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

export function InstallPrompt({
  appName = 'Casa Quest',
  compact = false,
}: {
  appName?: string;
  /** Smaller banner for the guardian screen. */
  compact?: boolean;
}) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<'hidden' | 'android' | 'ios'>('hidden');
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    if (isIos()) {
      // Safari only; Chrome on iOS cannot add to home screen from the page.
      const isSafari = /Safari/i.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/i.test(navigator.userAgent);
      if (!isSafari) return;
      // Deferred so the banner appears after hydration, not during it.
      const timer = setTimeout(() => setMode('ios'), 0);
      return () => clearTimeout(timer);
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode('android');
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    const onInstalled = () => setMode('hidden');
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setMode('hidden');
  }

  async function install() {
    if (!deferred) return;
    setInstalling(true);
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') setMode('hidden');
    } finally {
      setInstalling(false);
      setDeferred(null);
    }
  }

  if (mode === 'hidden') return null;

  return (
    <div
      role="dialog"
      aria-label="Instalar o aplicativo"
      className={
        compact
          ? 'mx-auto max-w-md rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3'
          : 'rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3'
      }
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none">📲</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-indigo-900">
            {compact ? 'Deixe na tela inicial' : `Instale o ${appName} no celular`}
          </p>
          {mode === 'android' ? (
            <p className="mt-0.5 text-xs text-indigo-700">
              Abre como um app, sem barra do navegador, direto na sua tela.
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-indigo-700">
              No Safari, toque em <strong>Compartilhar</strong> (o quadrado com a seta) e depois em{' '}
              <strong>Adicionar à Tela de Início</strong>.
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {mode === 'android' && (
              <button
                type="button"
                onClick={install}
                disabled={installing}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {installing ? 'Abrindo…' : 'Instalar'}
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
            >
              {mode === 'android' ? 'Agora não' : 'Entendi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
