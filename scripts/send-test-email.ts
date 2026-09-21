// ============================================================
// Casa Quest — Teste de SMTP (convite e alerta de energia)
//
// Manda os dois e-mails do app pelo caminho real — mesmo transporte,
// mesmos modelos — para provar que SMTP_HOST/PORT/USER/PASS/FROM estão
// certos antes de depender deles em produção.
//
// Existe porque o botão "Checar e enviar agora" em Configurações só
// envia quando algum guardião está de fato abaixo da meta: com a casa
// em dia, uma senha errada de SMTP passaria despercebida.
//
// Uso:
//   npx tsx scripts/send-test-email.ts voce@exemplo.com
//   npx tsx scripts/send-test-email.ts voce@exemplo.com --alert
//   npx tsx scripts/send-test-email.ts --dry            (não envia nada)
//
// Lê as variáveis de .env.local, e as do shell ganham do arquivo.
//
// Para conferir a configuração de produção, defina as variáveis à mão no
// shell com os mesmos valores que estão na Vercel. `vercel env pull` não
// serve: variável do tipo Secret/Sensitive volta como "[SENSITIVE]", não
// com o valor. O --production só existe para quem guarda um
// .env.production.local montado à mão.
// ============================================================

import { readFileSync } from 'fs';
import { isEmailConfigured, readSmtpConfig, sendEmail, htmlToText } from '../src/lib/email/mailer';
import { advisorInviteEmail, performanceAlertEmail } from '../src/lib/email/templates';
import { severityFor } from '../src/domain/alerts/performance';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const to = args.find((a) => a.includes('@'));
const only = args.includes('--alert') ? 'alert' : args.includes('--invite') ? 'invite' : 'both';
const envFile = args.includes('--production') ? '../.env.production.local' : '../.env.local';

// Fora do Next ninguém carrega o .env: o mailer lê process.env.
try {
  for (const line of readFileSync(new URL(envFile, import.meta.url), 'utf8').split('\n')) {
    if (!line.includes('=') || line.trim().startsWith('#')) continue;
    const i = line.indexOf('=');
    const key = line.slice(0, i).trim();
    // Uma variável já definida no shell ganha do arquivo.
    if (!process.env[key]) {
      process.env[key] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
} catch {
  console.error(`❌ Não achei ${envFile.replace('../', '')}.`);
  process.exit(1);
}

const config = readSmtpConfig();
if (!config) {
  console.error('❌ SMTP não configurado. Faltam SMTP_HOST e/ou SMTP_FROM.');
  console.error('   Defina SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS e SMTP_FROM.');
  process.exit(1);
}

const pass = process.env.SMTP_PASS;
console.log('Configuração encontrada:');
console.log(`  host   ${config.host}:${config.port} (${config.secure ? 'TLS implícito' : 'STARTTLS'})`);
console.log(`  user   ${config.user ?? '(sem autenticação)'}`);
console.log(`  senha  ${pass ? `definida (${pass.length} caracteres)` : '❌ AUSENTE'}`);
console.log(`  from   ${config.from}`);
console.log(`  app    ${process.env.NEXT_PUBLIC_APP_URL || '(NEXT_PUBLIC_APP_URL não definida)'}`);
console.log(`  pronto ${isEmailConfigured() ? 'sim' : 'não'}\n`);

if (!to && !dry) {
  console.error('❌ Informe o destino. Ex: npx tsx scripts/send-test-email.ts voce@exemplo.com');
  process.exit(1);
}

const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://casaquest.fun').replace(/\/+$/, '');

const snapshot = {
  guardianId: 'teste',
  guardianName: 'Guardião de Teste',
  percentage: 62,
  missed: 5,
  done: 12,
  recoveries: 1,
  streakDays: 0,
};

const messages = [
  only !== 'alert' && {
    label: 'Convite de Conselheiro(a)',
    ...advisorInviteEmail({
      inviterName: 'Casa Quest',
      familyName: 'Família de Teste',
      inviteeName: 'Você',
      acceptUrl: `${base}/convite?teste=1`,
      roleLabel: 'Conselheiro(a)',
    }),
  },
  only !== 'invite' && {
    label: 'Alerta de energia',
    ...performanceAlertEmail({
      familyName: 'Família de Teste',
      missionName: 'Missão de Teste',
      snapshot,
      severity: severityFor(snapshot.percentage),
      thresholdPercent: 70,
      dashboardUrl: `${base}/dashboard/hoje`,
    }),
  },
].filter(Boolean) as { label: string; subject: string; html: string }[];

async function main() {
  let failed = false;

  for (const message of messages) {
    console.log(`── ${message.label}`);
    console.log(`   assunto: ${message.subject}`);

    if (dry) {
      console.log('   (--dry: nada foi enviado)');
      const preview = htmlToText(message.html).split('\n').slice(0, 5);
      console.log(preview.map((l) => `   │ ${l}`).join('\n'));
      console.log('');
      continue;
    }

    const result = await sendEmail({
      to: to!,
      subject: `[teste] ${message.subject}`,
      html: message.html,
    });

    if (result.ok) {
      console.log(`   ✅ enviado para ${to} (id ${result.messageId})\n`);
    } else {
      failed = true;
      console.log(`   ❌ ${result.code}: ${result.message}\n`);
    }
  }

  if (failed) {
    console.log('Erros comuns:');
    console.log('  535 → autenticação. No Resend, SMTP_USER é a palavra "resend" e a senha é a API key.');
    console.log('  550 "only send testing emails to your own address" → as credenciais estão certas!');
    console.log('       O remetente é o de teste (onboarding@resend.dev), que só entrega para o e-mail');
    console.log('       da conta — o próprio erro diz qual é. Para outros destinos, verifique um domínio');
    console.log('       e use um SMTP_FROM dele.');
    console.log('  550 / 403 "domain not verified" → SMTP_FROM está fora do domínio verificado.');
    console.log('  ETIMEDOUT → porta bloqueada na rede local; tente 587 no lugar de 465.');
    process.exit(1);
  }

  if (!dry) console.log('Tudo certo. Confira a caixa de entrada (e o spam, na primeira vez).');
  // O pool do transporte deixa conexões abertas: sem isto o processo não sai.
  process.exit(0);
}

main();
