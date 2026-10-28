-- migrate:up
create table import_run (
    id bigserial primary key,
    arquivo text not null,
    sha256 char(64) not null,
    iniciado_em timestamptz not null default now(),
    linhas_lidas integer not null,
    status text not null check (status in ('ok', 'failed')),
    relatorio_dq text,
    reconciliacao jsonb
);

create unique index import_run_sha256_ok on import_run (sha256) where status = 'ok';

create table fato_lancamento (
    row_key char(40) primary key,
    import_run_id bigint not null references import_run (id),
    cen2 cen2 not null,
    cenario text not null,
    n4_id integer not null references dim_n4 (n4_id),
    n5 text,
    centro_custo text not null,
    projeto_id integer not null references dim_projeto (projeto_id),
    projeto_texto text not null,
    finalidade text,
    fornecedor text,
    conta text not null,
    grupo text,
    mes smallint not null check (mes between 1 and 12),
    valor numeric(18, 2) not null,
    origem text,
    lancamento text,
    oc_rc text,
    dt_contabilizacao date,
    linha_planilha integer not null
);

create index fato_lancamento_n4_projeto on fato_lancamento (n4_id, projeto_id);

create index fato_lancamento_cen2 on fato_lancamento (cen2);

-- migrate:down
drop index fato_lancamento_cen2;

drop index fato_lancamento_n4_projeto;

drop table fato_lancamento;

drop index import_run_sha256_ok;

drop table import_run;
