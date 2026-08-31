'use client';

// ============================================================
// Casa Quest — Guardian Access Link
// Mostra o link de acesso do guardião de forma sempre clicável,
// copiável e compartilhável pelo Guardião-Mor.
// ============================================================

import { useState } from 'react';
import type { GuardianData } from '@/hooks/use-family';
import { buildGuardianLink, formatDate } from '@/lib/utils';

interface Props {
  guardian: GuardianData;
  /** Called after the link changes so the parent can refresh its data. */
  onChange: () => void;
  /**
   * "compact" shows only the shareable link (open/copy/WhatsApp), for the
   * family overview. Generating and revoking stay on the Guardiões screen,
   * which is where guardians are managed.
   */
  variant?: 'full' | 'compact';
}

type Status = 'idle' | 'working' | 'error';

export function GuardianAccessLink({
  guardian,
  onChange,
  variant = 'full',
}: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);

  const link = guardian.access_token
    ? buildGuardianLink(guardian.access_token)
    : null;

  const expiresAt = guardian.token_expires_at;
  const isExpired = !!expiresAt && new Date(expiresAt) < new Date();

  // A token generated before links became recoverable: the hash is stored but
  // the plain token is gone, so it can never be shown again.
  const isLegacy = !guardian.access_token && !!guardian.access_token_hash;

  async function call(method: 'POST' | 'DELETE') {
    setStatus('working');
    setMessage(null);
    try {
      const res = await fetch(`/api/guardians/${guardian.id}/token`, { method });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setStatus('error');
        setMessage(body?.error?.message || `Falha na operação (${res.status})`);
        return;
      }

      setStatus('idle');
      setConfirmingRevoke(false);
      onChange();
    } catch {
      setStatus('error');
      setMessage('Sem conexão com o servidor. Tente novamente.');
    }
  }

  async function handleCopy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setStatus('error');
      setMessage('Não foi possível copiar. Selecione o link e copie manualmente.');
    }
  }

  const whatsappHref = link
    ? `https://wa.me/?text=${encodeURIComponent(
        `Oi, ${guardian.name}! Esse é o seu link do Casa Quest: ${link}`
      )}`
    : '#';

  const working = status === 'working';

  if (variant === 'compact') {
    if (!link || isExpired) {
      return (
        <p className="mt-2 text-[11px] text-gray-400">
          {isExpired
            ? '⏰ Link expirado — gere um novo em Guardiões'
            : isLegacy
              ? '⚠️ Link antigo não exibível — gere um novo em Guardiões'
              : 'Sem link de acesso — gere um em Guardiões'}
        </p>
      );
    }

    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 flex-1 truncate rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-800 underline decoration-emerald-400 underline-offset-2 hover:bg-emerald-100"
          title={link}
        >
          {link}
        </a>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-md bg-gray-800 px-2 py-1 text-[11px] font-semibold text-white hover:bg-gray-700"
        >
          {copied ? 'Copiado ✓' : 'Copiar'}
        </button>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-md bg-[#25D366] px-2 py-1 text-[11px] font-semibold text-white hover:brightness-95"
        >
          WhatsApp
        </a>
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      {link && !isExpired ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700">
              🔗 Link de acesso
            </span>
            {expiresAt && (
              <span className="text-[10px] text-gray-400">
                Expira em {formatDate(expiresAt)}
              </span>
            )}
          </div>

          {/* The link itself — always clickable */}
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 underline decoration-emerald-400 underline-offset-2 hover:bg-emerald-100"
            title={link}
          >
            {link}
          </a>

          <div className="flex flex-wrap gap-2">
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Abrir ↗
            </a>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700"
            >
              {copied ? 'Copiado ✓' : 'Copiar'}
            </button>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95"
            >
              WhatsApp
            </a>
            <button
              type="button"
              onClick={() => call('POST')}
              disabled={working}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-50"
              title="Gera um link novo e invalida o atual"
            >
              {working ? 'Gerando…' : 'Regerar'}
            </button>
            {confirmingRevoke ? (
              <span className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => call('DELETE')}
                  disabled={working}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingRevoke(false)}
                  className="rounded-lg px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100"
                >
                  Cancelar
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingRevoke(true)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
              >
                Revogar
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {isExpired && (
            <p className="text-xs text-amber-600">
              ⏰ Link expirado em {formatDate(expiresAt!)}. Gere um novo para
              devolver o acesso.
            </p>
          )}
          {isLegacy && !isExpired && (
            <p className="text-xs text-amber-600">
              ⚠️ Este link foi criado antes e não pode mais ser exibido. Gere um
              novo para poder compartilhá-lo.
            </p>
          )}
          {!isExpired && !isLegacy && (
            <p className="text-xs text-gray-500">
              {guardian.name} ainda não tem um link de acesso.
            </p>
          )}
          <button
            type="button"
            onClick={() => call('POST')}
            disabled={working}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {working ? 'Gerando…' : isLegacy || isExpired ? 'Gerar novo link' : 'Gerar link de acesso'}
          </button>
        </div>
      )}

      {status === 'error' && message && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {message}
        </p>
      )}
    </div>
  );
}
