"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export type ItemNavegacao = {
  id: number;
  rotulo: string;
  pendencias: number;
};

export function NavegacaoColeta({ itens, ativoId }: { itens: ItemNavegacao[]; ativoId: number }) {
  const router = useRouter();

  return (
    <nav className="coleta-nav" aria-label="N4 da coleta">
      <p className="coleta-nav-titulo">NAVEGAÇÃO</p>

      <ul className="coleta-nav-lista">
        {itens.map((item) => {
          const ativo = item.id === ativoId;
          return (
            <li key={item.id}>
              <Link
                href={`/coleta/${item.id}`}
                className={ativo ? "coleta-nav-item coleta-nav-ativo" : "coleta-nav-item"}
                aria-current={ativo ? "page" : undefined}
              >
                <span>{item.rotulo}</span>
                <span className="contador num" aria-label={`${item.pendencias} pendências`}>
                  {item.pendencias}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="coleta-seletor">
        <label htmlFor="seletor-n4" className="campo-rotulo">
          N4
        </label>
        <select
          id="seletor-n4"
          className="campo-entrada"
          value={ativoId}
          onChange={(evento) => router.push(`/coleta/${evento.target.value}`)}
        >
          {itens.map((item) => (
            <option key={item.id} value={item.id}>
              {`${item.rotulo} (${item.pendencias} pendências)`}
            </option>
          ))}
        </select>
      </div>
    </nav>
  );
}
