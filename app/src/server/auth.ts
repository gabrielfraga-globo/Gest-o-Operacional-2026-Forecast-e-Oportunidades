import 'server-only';
import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { magicLink } from 'better-auth/plugins';
import { obterAmbiente } from './ambiente';
import { obterPool } from './db';
import { enviarLinkMagico } from './link-magico';

const SEGUNDOS_POR_DIA = 60 * 60 * 24;
const ambiente = obterAmbiente();

// Cookies de sessão são Secure por padrão quando a URL base é https (ou em produção);
// como BETTER_AUTH_URL é https em produção, nenhuma opção extra é necessária.
// Não há rota de cadastro: emailAndPassword está desligado e magicLink usa disableSignUp.
export const auth = betterAuth({
  database: obterPool(),
  secret: ambiente.authSecret,
  baseURL: ambiente.authUrl,
  trustedOrigins: [ambiente.authUrl],
  session: {
    expiresIn: 7 * SEGUNDOS_POR_DIA,
  },
  rateLimit: {
    enabled: true,
    storage: 'database',
    customRules: {
      '/sign-in/magic-link': { window: 300, max: 3 },
    },
  },
  plugins: [
    magicLink({
      expiresIn: 900,
      disableSignUp: true,
      sendMagicLink: async ({ email, url }) => {
        await enviarLinkMagico(email, url);
      },
    }),
    nextCookies(),
  ],
});
