-- migrate:up
create table usuario (
    email text primary key check (email = lower(email)),
    nome text not null,
    papel text not null check (papel in ('admin', 'responsavel')),
    ativo boolean not null default true,
    criado_em timestamptz not null default now()
);

-- projeto_id nulo = acesso ao N4 inteiro; preenchido = acesso só a esse projeto dentro do N4.
create table usuario_acesso (
    id serial primary key,
    email text not null references usuario (email) on delete cascade,
    n4_id integer not null references dim_n4 (n4_id),
    projeto_id integer references dim_projeto (projeto_id),
    unique nulls not distinct (email, n4_id, projeto_id)
);

create view vw_permissao_linha as
select u.email, l.linha_id
from usuario u
cross join forecast_linha l
where u.ativo
    and u.papel = 'admin'
    and l.ativo
union
select u.email, l.linha_id
from usuario u
join usuario_acesso a on a.email = u.email
join forecast_linha l
    on l.n4_id = a.n4_id
    and (a.projeto_id is null or a.projeto_id = l.projeto_id)
where u.ativo
    and u.papel = 'responsavel'
    and l.ativo;

-- migrate:down
drop view vw_permissao_linha;

drop table usuario_acesso;

drop table usuario;
