import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

const ARQUIVO_ESTATICO = /\.[a-zA-Z0-9]+$/;

// Barreira leve: só verifica a presença do cookie. A validação real é feita
// em exigirSessao() nas páginas.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const publico =
    pathname === '/login' ||
    pathname === '/api/saude' ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next/') ||
    ARQUIVO_ESTATICO.test(pathname);

  if (publico || getSessionCookie(request)) {
    return NextResponse.next();
  }

  const destino = request.nextUrl.clone();
  destino.pathname = '/login';
  destino.search = '';
  return NextResponse.redirect(destino);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
