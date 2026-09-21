// ============================================================
// Casa Quest — Identidade jurídica, versões e prazos dos textos legais
//
// Os Termos de Uso e a Política de Privacidade saem daqui, para os dois
// nunca discordarem um do outro — nem do que o app faz de verdade.
//
// REGRA: texto de uma versão já publicada não se edita. Mudar o que se
// promete é criar uma VERSÃO NOVA, com data nova. Quando o aceite passar
// a ser gravado no banco (junto com a cobrança), a coluna vai apontar
// para uma destas versões, e o texto dela tem de continuar a existir.
//
// ATENÇÃO — falta a revisão de um advogado, e nada aqui a substitui. O
// que está escrito é verdadeiro em relação ao código (conferido tabela a
// tabela em 16/09/2026) e organizado para ser revisto.
// ============================================================

/** Quem responde pelos dados. Dada pelo Ricardo em 04/08/2026, a mesma do Amigo Violão. */
export const CONTROLADOR = {
  razaoSocial: '51.747.455 RICARDO MIRANDA DE NOVAIS',
  cnpj: '51.747.455/0001-06',
  contato: 'contato@casaquest.fun',
} as const;

export const TERMOS_VERSAO = '1.0-2026-09-16';
export const PRIVACIDADE_VERSAO = '1.0-2026-09-16';
export const VIGENTE_DESDE = '16 de setembro de 2026';

/**
 * Onde os dados ficam. Confirmado por Ricardo em 16/09/2026, no painel do
 * Supabase (Project Settings → General → Region): o projeto está em
 * `us-east-2`, que é Ohio, nos Estados Unidos — e NÃO no Brasil.
 *
 * Isso é o que torna a transferência internacional real, e por isso está
 * escrito por extenso na política. Se um dia o projeto migrar para
 * sa-east-1 (São Paulo), este valor muda e a política muda com ele, em
 * versão nova.
 */
export const REGIAO_DOS_DADOS = 'Ohio, Estados Unidos (AWS us-east-2)';

/** Prazos prometidos. Iguais aos do Amigo Violão, por decisão do Ricardo em 16/09/2026. */
export const RETENCAO = {
  /** Casa sem nenhum acesso por este tempo é apagada sozinha. */
  inatividadeMeses: 12,
  /** As cópias de segurança se apagam sozinhas neste prazo. */
  backupDias: 90,
  /** Prazo de resposta a um pedido de dados (LGPD, art. 19). */
  respostaDias: 15,
} as const;
