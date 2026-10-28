-- migrate:up
create table dim_n4 (
    n4_id serial primary key,
    nome text not null unique
);

create table dim_projeto (
    projeto_id serial primary key,
    codigo text not null unique,
    nome_curto text not null unique check (char_length(nome_curto) between 1 and 40)
);

insert into dim_projeto (codigo, nome_curto)
values ('__REAL_SEM_ORC__', 'INDIRETO — REAL SEM ORÇAMENTO');

-- migrate:down
drop table dim_projeto;

drop table dim_n4;
