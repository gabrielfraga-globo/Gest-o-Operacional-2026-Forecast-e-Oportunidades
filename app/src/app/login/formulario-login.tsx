'use client';

import { useState, type FormEvent } from 'react';
import { authClient } from '@/lib/auth-client';

export function FormularioLogin() {
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEnviando(true);
    // Resposta é sempre a mesma, autorizado ou não, para não revelar quem tem acesso.
    await authClient.signIn.magicLink({
      email,
      callbackURL: '/',
      errorCallbackURL: '/login?erro=link-invalido',
    });
    setEnviando(false);
    setEnviado(true);
  }

  if (enviado) {
    return (
      <p className="lead" role="status">
        Se o e-mail estiver autorizado, você receberá um link em instantes. Ele vale por 15 minutos.
      </p>
    );
  }

  return (
    <form className="formulario-login" onSubmit={enviar}>
      <label className="campo-rotulo" htmlFor="email">
        E-mail
      </label>
      <input
        id="email"
        className="campo-entrada"
        type="email"
        name="email"
        autoComplete="email"
        required
        value={email}
        onChange={(evento) => setEmail(evento.target.value)}
      />
      <button className="botao-primario" type="submit" disabled={enviando}>
        {enviando ? 'Enviando…' : 'Enviar link'}
      </button>
    </form>
  );
}
