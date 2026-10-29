import { describe, expect, it } from 'vitest';
import { destinoCanonico } from '@/lib/host-canonico';

const OFICIAL = 'https://opex.exemplo.com';

describe('destinoCanonico', () => {
  it('redireciona deploy *.vercel.app de produção para a origem oficial', () => {
    expect(destinoCanonico('opex-abc123.vercel.app', OFICIAL, 'production')).toBe(OFICIAL);
  });

  it('não redireciona quando o host já é o oficial', () => {
    expect(destinoCanonico('opex.exemplo.com', OFICIAL, 'production')).toBeNull();
  });

  it('não redireciona em preview ou desenvolvimento', () => {
    expect(destinoCanonico('opex-git-feature.vercel.app', OFICIAL, 'preview')).toBeNull();
    expect(destinoCanonico('localhost:3000', OFICIAL, 'development')).toBeNull();
    expect(destinoCanonico('opex-abc123.vercel.app', OFICIAL, undefined)).toBeNull();
  });

  it('não redireciona sem urlOficial', () => {
    expect(destinoCanonico('opex-abc123.vercel.app', undefined, 'production')).toBeNull();
  });

  it('ignora domínios que não são .vercel.app', () => {
    expect(destinoCanonico('outro.exemplo.com', OFICIAL, 'production')).toBeNull();
    expect(destinoCanonico('fakevercel.app', OFICIAL, 'production')).toBeNull();
  });
});
