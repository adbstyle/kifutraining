-- Sync-Bausteine (supabase/sync/, eingebunden in sync-staging.yml):
-- (a) Stehen alle public-Tabellen in der Liste, leert vor_restore.sql nichts.
-- (b) Eine nicht gelistete Tabelle mit Zeilen ist danach leer, eine gelistete
--     mit Zeilen bleibt unberührt.
-- (c) Fehlt public.staging_nach_sync(), tut nach_restore.sql nichts; ist sie
--     vorhanden, ruft es sie genau einmal auf.
-- Alles in einer Transaktion mit rollback; hinterlässt nichts.

\set ON_ERROR_STOP on

begin;
set local statement_timeout = '30s';

create table public.v0_sync_gelistet (id int primary key);
create table public.v0_sync_eigen (id int primary key);
create table public.v0_sync_aufrufe (id int generated always as identity);
insert into public.v0_sync_gelistet values (1);
insert into public.v0_sync_eigen values (1);

-- (a) Alle public-Tabellen gelistet: nichts wird geleert.
select string_agg(tablename, ' ' order by tablename collate "C") as public_tables
  from pg_tables where schemaname = 'public' \gset
\ir ../sync/vor_restore.sql
do $$
begin
  if (select count(*) from public.v0_sync_gelistet) <> 1
     or (select count(*) from public.v0_sync_eigen) <> 1 then
    raise exception '(a) vor_restore hat geleert, obwohl alle Tabellen gelistet sind';
  end if;
end $$;

-- (b) v0_sync_eigen fehlt in der Liste: nur sie wird geleert.
select string_agg(tablename, ' ' order by tablename collate "C") as public_tables
  from pg_tables where schemaname = 'public' and tablename <> 'v0_sync_eigen' \gset
\ir ../sync/vor_restore.sql
do $$
begin
  if (select count(*) from public.v0_sync_eigen) <> 0 then
    raise exception '(b) nicht gelistete Tabelle ist nicht leer';
  end if;
  if (select count(*) from public.v0_sync_gelistet) <> 1 then
    raise exception '(b) gelistete Tabelle wurde angefasst';
  end if;
end $$;

-- (c1) Ohne staging_nach_sync: kein Fehler, keine Wirkung.
drop function if exists public.staging_nach_sync();
\ir ../sync/nach_restore.sql
do $$
begin
  if (select count(*) from public.v0_sync_aufrufe) <> 0 then
    raise exception '(c) Aufruf ohne Funktion';
  end if;
end $$;

-- (c2) Mit Attrappe: genau ein Aufruf.
create function public.staging_nach_sync() returns void
language sql as $$ insert into public.v0_sync_aufrufe default values $$;
\ir ../sync/nach_restore.sql
do $$
begin
  if (select count(*) from public.v0_sync_aufrufe) <> 1 then
    raise exception '(c) staging_nach_sync wurde % mal statt genau einmal aufgerufen',
      (select count(*) from public.v0_sync_aufrufe);
  end if;
end $$;

rollback;
