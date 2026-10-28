'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITENS = [
  { href: '/', rotulo: 'Início' },
  { href: '/coleta', rotulo: 'Coleta' },
  { href: '/executivo', rotulo: 'Visão executiva' },
] as const;

export function NavPilula() {
  const pathname = usePathname();

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
    </nav>
  );
}
