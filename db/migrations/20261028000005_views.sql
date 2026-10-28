-- migrate:up
create view vw_saldo_linha as
select
    f.n4_id,
    f.projeto_id,
    coalesce(sum(f.valor) filter (where f.cen2 = 'ORC_BG'), 0) as orc_bg,
    coalesce(sum(f.valor) filter (where f.cen2 = 'REAL'), 0) as realizado,
    coalesce(sum(f.valor) filter (where f.cen2 = 'ORC_BG'), 0)
        - coalesce(sum(f.valor) filter (where f.cen2 = 'REAL'), 0) as saldo_atual,
    count(*) as source_count
from fato_lancamento f
group by f.n4_id, f.projeto_id;

create view vw_saldo_reagrupado as
select
    x.n4_id,
    x.projeto_id,
    sum(x.orc_bg) as orc_bg,
    sum(x.realizado) as realizado,
    sum(x.orc_bg) - sum(x.realizado) as saldo_atual,
    sum(x.source_count) as source_count
from (
    select
        s.n4_id,
        case
            when s.orc_bg = 0 and s.realizado <> 0
                then (select p.projeto_id from dim_projeto p where p.codigo = '__REAL_SEM_ORC__')
            else s.projeto_id
        end as projeto_id,
        s.orc_bg,
        s.realizado,
        s.source_count
    from vw_saldo_linha s
) x
group by x.n4_id, x.projeto_id;

create view vw_forecast as
with base as (
    select
        l.linha_id,
        s.n4_id,
        s.projeto_id,
        n.nome as n4,
        p.nome_curto as projeto,
        p.codigo as projeto_codigo,
        s.orc_bg,
        s.realizado,
        s.saldo_atual,
        i.previsao_futura,
        i.classificacao,
        i.confianca,
        i.justificativa,
        i.proxima_acao,
        coalesce(i.responsavel, l.responsavel) as responsavel,
        coalesce(
            i.previsao_futura is not null
            and i.classificacao <> 'A_VALIDAR'
            and nullif(trim(i.justificativa), '') is not null
            and i.confianca is not null
            and nullif(trim(i.proxima_acao), '') is not null
            and nullif(trim(coalesce(i.responsavel, l.responsavel)), '') is not null,
            false
        ) as input_completo
    from vw_saldo_reagrupado s
    join forecast_linha l using (n4_id, projeto_id)
    join dim_n4 n on n.n4_id = s.n4_id
    join dim_projeto p on p.projeto_id = s.projeto_id
    left join forecast_input i on i.linha_id = l.linha_id
    where l.ativo
),
com_fechamento as (
    select
        b.*,
        b.realizado + coalesce(b.previsao_futura, greatest(b.saldo_atual, 0)) as forecast_fechamento
    from base b
)
select
    c.linha_id,
    c.n4_id,
    c.projeto_id,
    c.n4,
    c.projeto,
    c.projeto_codigo,
    c.orc_bg,
    c.realizado,
    c.saldo_atual,
    c.previsao_futura,
    c.classificacao,
    c.confianca,
    c.justificativa,
    c.proxima_acao,
    c.responsavel,
    c.input_completo,
    c.forecast_fechamento,
    c.orc_bg - c.forecast_fechamento as oportunidade_ajustada,
    case
        when c.saldo_atual < -1 and not c.input_completo then 'PRESSAO'
        when not c.input_completo then 'A_VALIDAR'
        when c.orc_bg - c.forecast_fechamento < -1 then 'PRESSAO'
        when c.orc_bg - c.forecast_fechamento > 1 then 'OPORTUNIDADE'
        else 'COMPROMISSO'
    end as categoria
from com_fechamento c;

create view vw_resumo_n4 as
select
    v.n4,
    sum(v.orc_bg) as orc_bg,
    sum(v.realizado) as realizado,
    coalesce(sum(v.saldo_atual), 0) as saldo_liquido,
    coalesce(sum(v.saldo_atual) filter (where v.saldo_atual > 0), 0) as saldo_bruto_positivo,
    coalesce(sum(v.saldo_atual) filter (where v.saldo_atual < 0), 0) as pressoes,
    coalesce(sum(v.forecast_fechamento), 0) as forecast_fechamento,
    coalesce(sum(v.oportunidade_ajustada) filter (where v.categoria = 'OPORTUNIDADE'), 0)
        as oportunidade_ajustada,
    count(*) as linhas,
    count(*) filter (where v.input_completo) as linhas_com_input,
    coalesce(
        round(count(*) filter (where v.input_completo)::numeric / nullif(count(*), 0), 4),
        0
    ) as pct_com_input
from vw_forecast v
group by v.n4;

create view vw_reconciliacao as
select
    t.orc_bg,
    t.realizado,
    t.orc_bg - t.realizado as saldo,
    round(t.realizado / nullif(t.orc_bg, 0), 4) as utilizacao,
    coalesce(
        (
            select sum(r.realizado)
            from vw_saldo_reagrupado r
            join dim_projeto p on p.projeto_id = r.projeto_id
            where p.codigo = '__REAL_SEM_ORC__'
        ),
        0
    ) as real_sem_orcamento,
    (
        select count(*)
        from vw_saldo_linha s
        where s.orc_bg = 0 and s.realizado <> 0
    ) as linhas_real_sem_orcamento
from (
    select
        coalesce(sum(s.orc_bg), 0) as orc_bg,
        coalesce(sum(s.realizado), 0) as realizado
    from vw_saldo_linha s
) t;

-- migrate:down
drop view vw_reconciliacao;

drop view vw_resumo_n4;

drop view vw_forecast;

drop view vw_saldo_reagrupado;

drop view vw_saldo_linha;
