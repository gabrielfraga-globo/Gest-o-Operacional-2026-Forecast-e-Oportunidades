import 'server-only';
import nodemailer from 'nodemailer';
import { lerSmtp } from './ambiente';

function escaparHtml(texto: string): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function montarMensagem(nome: string, url: string) {
  const saudacao = nome.trim() ? `Olá, ${nome.trim()}.` : 'Olá.';
  const texto = [
    saudacao,
    '',
    'Use o link abaixo para entrar no Forecast Opex 2026:',
    url,
    '',
    'O link vale por 15 minutos e só pode ser usado uma vez.',
    'Se você não pediu este acesso, ignore este e-mail.',
  ].join('\n');
  const html = [
    `<p>${escaparHtml(saudacao)}</p>`,
    '<p>Use o link abaixo para entrar no Forecast Opex 2026:</p>',
    `<p><a href="${escaparHtml(url)}">Entrar no Forecast Opex 2026</a></p>`,
    '<p>O link vale por 15 minutos e só pode ser usado uma vez.</p>',
    '<p>Se você não pediu este acesso, ignore este e-mail.</p>',
  ].join('\n');
  return { texto, html };
}

export async function enviarLinkAcesso(destino: string, nome: string, url: string): Promise<void> {
  const smtp = lerSmtp(process.env);

  if (smtp === null) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[DEV] link de acesso para ${destino}: ${url}`);
      return;
    }
    throw new Error(
      'SMTP não configurado em produção: defina SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS e EMAIL_FROM.',
    );
  }

  const transporte = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.pass },
  });
  const { texto, html } = montarMensagem(nome, url);
  await transporte.sendMail({
    from: smtp.from,
    to: destino,
    subject: 'Seu acesso ao Forecast Opex 2026',
    text: texto,
    html,
  });
}
