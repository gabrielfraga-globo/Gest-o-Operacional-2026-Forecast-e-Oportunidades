-- migrate:up
-- Tabela do rate limit persistente do Better Auth (rateLimit.storage = "database", ADR-005).
-- Definição obtida da própria biblioteca instalada (Better Auth 1.7.14) via getAuthTables.

create table "rateLimit" (
  "id" text not null primary key,
  "key" text not null unique,
  "count" integer not null,
  "lastRequest" bigint not null
);

-- migrate:down
drop table if exists "rateLimit";
