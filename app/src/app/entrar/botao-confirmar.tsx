'use client';

import { useState } from 'react';

type Props = {
  token: string;
  callbackURL?: string;
  errorCallbackURL?: string;
  newUserCallbackURL?: string;
};

// Aceita só caminhos internos: rejeita URLs absolutas e "//" ou "/\" (redirecionamento externo).
function caminhoInterno(valor: string | undefined): string | undefined {
  return valor && /^\/(?![/\\])/.test(valor) ? valor : undefined;
}

export function BotaoConfirmar({ token, callbackURL, errorCallbackURL, newUserCallbackURL }: Props) {
  const [entrando, setEntrando] = useState(false);

  function confirmar() {
    setEntrando(true);
    const params = new URLSearchParams({ token });
    const opcionais = {
      callbackURL: caminhoInterno(callbackURL),
      errorCallbackURL: caminhoInterno(errorCallbackURL),
      newUserCallbackURL: caminhoInterno(newUserCallbackURL),
    };
    for (const [nome, valor] of Object.entries(opcionais)) {
      if (valor) {
        params.set(nome, valor);
      }
    }
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- rota de API, não página do Next.
    window.location.assign(`/api/auth/magic-link/verify?${params.toString()}`);
  }

  return (
    <button className="botao-primario" type="button" onClick={confirmar} disabled={entrando}>
      {entrando ? 'Entrando…' : 'Confirmar entrada'}
    </button>
  );
}
