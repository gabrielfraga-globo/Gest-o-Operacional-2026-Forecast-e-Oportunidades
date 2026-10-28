-- migrate:up
create table forecast_linha (
    linha_id serial primary key,
    n4_id integer not null references dim_n4 (n4_id),
    projeto_id integer not null references dim_projeto (projeto_id),
    responsavel text,
    ativo boolean not null default true,
    unique (n4_id, projeto_id)
);

create table forecast_input (
    linha_id integer primary key references forecast_linha (linha_id) on delete restrict,
    previsao_futura numeric(18, 2) check (previsao_futura >= 0),
    classificacao classificacao not null default 'A_VALIDAR',
    justificativa text,
    confianca confianca,
    proxima_acao text,
    responsavel text,
    atualizado_por text,
    atualizado_em timestamptz,
    versao integer not null default 1
);

create table forecast_input_hist (
    id bigserial primary key,
    linha_id integer not null,
    versao integer not null,
    dados jsonb not null,
    registrado_em timestamptz not null default now()
);

create function forecast_input_historico() returns trigger
language plpgsql as $$
begin
    insert into forecast_input_hist (linha_id, versao, dados)
    values (OLD.linha_id, OLD.versao, to_jsonb(OLD));

    NEW.versao := OLD.versao + 1;
    NEW.atualizado_em := now();
    return NEW;
end;
$$;

create trigger forecast_input_historico
before update on forecast_input
for each row execute function forecast_input_historico();

-- migrate:down
drop trigger forecast_input_historico on forecast_input;

drop function forecast_input_historico();

drop table forecast_input_hist;

drop table forecast_input;

drop table forecast_linha;
