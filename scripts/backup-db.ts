// ============================================================
// Casa Quest — Cópia de segurança do banco
//
// O plano gratuito do Supabase não faz backup automático. Este script
// baixa todas as tabelas pela API REST (service role, sem passar pelo
// RLS) e grava um JSON por tabela numa pasta com a data e a hora.
//
// A pasta `backups/` está no .gitignore: o repositório é PÚBLICO e aqui
// dentro vão nomes de crianças e o histórico do dia delas. Nunca commitar,
// nunca subir como artefato de CI.
//
// O script também APAGA cópias com mais de 90 dias, que é o prazo que a
// Política de Privacidade promete — a promessa se cumpre sozinha.
//
// Uso:
//   npx tsx scripts/backup-db.ts                 # grava em ./backups
//   npx tsx scripts/backup-db.ts --out D:/copias # grava noutro lugar
//   npx tsx scripts/backup-db.ts --dry           # só conta as linhas
// ============================================================

import { readFileSync, mkdirSync, writeFileSync, readdirSync, rmSync, statSync } from 'fs';
import { join } from 'path';
import { RETENCAO } from '../src/lib/legal';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !SERVICE) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local');
  process.exit(1);
}

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const outIndex = args.indexOf('--out');
const outRoot = outIndex >= 0 ? args[outIndex + 1]! : 'backups';

const headers = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };

/** As tabelas saem do próprio PostgREST, para uma tabela nova não ficar de fora sem ninguém reparar. */
async function listarTabelas(): Promise<string[]> {
  const spec = (await fetch(`${URL_}/rest/v1/`, { headers }).then((r) => r.json())) as {
    paths?: Record<string, unknown>;
  };
  return Object.keys(spec.paths ?? {})
    .filter((p) => p.startsWith('/') && p.length > 1)
    .map((p) => p.slice(1))
    .filter((t) => !t.startsWith('rpc/'))
    .sort();
}

/** PostgREST devolve no máximo mil linhas por vez; aqui se pede de mil em mil. */
async function baixarTabela(tabela: string): Promise<unknown[]> {
  const pagina = 1000;
  const linhas: unknown[] = [];
  for (let inicio = 0; ; inicio += pagina) {
    const res = await fetch(`${URL_}/rest/v1/${tabela}?select=*&limit=${pagina}&offset=${inicio}`, {
      headers,
    });
    if (!res.ok) throw new Error(`${tabela}: HTTP ${res.status} ${await res.text()}`);
    const lote = (await res.json()) as unknown[];
    linhas.push(...lote);
    if (lote.length < pagina) return linhas;
  }
}

/** Cumpre o prazo do backupDias apagando as pastas antigas. */
function limparAntigas(raiz: string) {
  const limite = Date.now() - RETENCAO.backupDias * 24 * 60 * 60 * 1000;
  let apagadas = 0;
  for (const nome of readdirSync(raiz)) {
    const caminho = join(raiz, nome);
    if (!statSync(caminho).isDirectory()) continue;
    if (statSync(caminho).mtimeMs < limite) {
      rmSync(caminho, { recursive: true, force: true });
      apagadas++;
    }
  }
  if (apagadas > 0) console.log(`\n${apagadas} cópia(s) com mais de ${RETENCAO.backupDias} dias apagadas.`);
}

async function main() {
  const tabelas = await listarTabelas();
  const carimbo = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const destino = join(outRoot, carimbo);

  if (!dry) mkdirSync(destino, { recursive: true });
  console.log(dry ? 'Só contando (--dry)' : `Gravando em ${destino}`);

  let total = 0;
  for (const tabela of tabelas) {
    const linhas = await baixarTabela(tabela);
    total += linhas.length;
    if (!dry) writeFileSync(join(destino, `${tabela}.json`), JSON.stringify(linhas, null, 2), 'utf8');
    console.log(`  ${tabela.padEnd(24)} ${String(linhas.length).padStart(5)} linha(s)`);
  }

  console.log(`\n${tabelas.length} tabelas · ${total} linhas.`);
  if (!dry) limparAntigas(outRoot);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
