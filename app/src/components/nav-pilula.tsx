'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

const ITENS = [
  { href: '/', rotulo: 'Início' },
  { href: '/coleta', rotulo: 'Coleta' },
  { href: '/executivo', rotulo: 'Visão executiva' },
] as const;

export function NavPilula({ nome }: { nome: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function sair() {
    await authClient.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <nav className="nav-pilula" aria-label="Principal">
      {ITENS.map((item) => {
        const ativo = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={ativo ? 'nav-item nav-item-ativo' : 'nav-item'}
            aria-current={ativo ? 'page' : undefined}
          >
            {item.rotulo}
          </Link>
        );
      })}
      <span className="nav-usuario">{nome}</span>
      <button type="button" className="nav-sair" onClick={sair}>
        Sair
      </button>
    </nav>
  );
}
