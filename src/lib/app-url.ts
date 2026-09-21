// ============================================================
// Casa Quest — Lib: Endereço público do app (servidor)
//
// Links que saem por e-mail (convite, alerta) não podem apontar para
// localhost nem para o domínio interno de um deploy de preview. A
// ordem é: o que foi configurado, o host da requisição, o domínio de
// produção da Vercel.
//
// O equivalente no navegador é `getAppBaseUrl()` em `lib/utils`.
// ============================================================

function clean(url: string): string {
  return url.replace(/\/+$/, '');
}

function isUsable(url: string | undefined): url is string {
  return !!url && !/^https?:\/\/localhost\b/i.test(url);
}

/**
 * Base pública do app. Passe a `Request` quando houver uma — é a fonte
 * mais confiável do domínio que a pessoa está usando de fato.
 */
export function appUrl(request?: Request | null): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (isUsable(configured)) return clean(configured);

  if (request) {
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    if (host) return clean(`${proto}://${host}`);
  }

  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return clean(`https://${vercel}`);

  return clean(configured || 'http://localhost:3000');
}
