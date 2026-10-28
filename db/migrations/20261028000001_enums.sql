-- migrate:up
create type cen2 as enum ('ORC_BG', 'REAL');

create type classificacao as enum ('COMPROMISSO', 'POSTERGACAO', 'CANCELAMENTO', 'ECONOMIA', 'A_VALIDAR');

create type confianca as enum ('ALTA', 'MEDIA', 'BAIXA');

-- migrate:down
drop type confianca;

drop type classificacao;

drop type cen2;
