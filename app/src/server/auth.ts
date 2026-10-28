import 'server-only';
import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { magicLink } from 'better-auth/plugins';
import { obterPool } from './db';
import { enviarLinkMagico } from './link-magico';

const SEGUNDOS_POR_DIA = 60 * 60 * 24;

export const auth = betterAuth({
  database: obterPool(),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  session: {
    expiresIn: 7 * SEGUNDOS_POR_DIA,
  },
  rateLimit: {
    enabled: true,
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
