-- Ortsprüfung (Rollen nach Ort, Architekturplan Vereine §5.5):
-- Keine Funktion in `public` darf beide Rollen kennen, also zugleich
-- `ist_team_mitglied` bzw. `meine_team_ids` (Team-Ort) und
-- `ist_verein_verwaltung` (Verein-Ort) im Funktionstext enthalten.
-- Geprüft wird bewusst nicht die Form der Verknüpfung, sondern nur, dass
-- nicht beide Prädikate in einer Funktion stehen. Eine Ausnahmeliste gibt es
-- nicht. Funktionen, die beides nur anzeigen, lesen `team_members` und
-- `verein_verwaltung` direkt.
--
-- Funktionstext ist `prosrc` und, für Funktionen mit SQL-Standard-Rumpf
-- (`begin atomic … end`, dort ist `prosrc` leer), `pg_get_function_sqlbody`.
--
-- Selbsttest zuerst: zwei Attrappen in `public` (plpgsql und SQL-Standard-
-- Rumpf), die beide Prädikatnamen tragen, muss die Abfrage finden. Sonst
-- prüfte sie still nichts. Danach fallen die Attrappen, und die eigentliche
-- Prüfung läuft. Alles in einer Transaktion mit rollback; hinterlässt nichts.

\set ON_ERROR_STOP on

begin;
set local statement_timeout = '30s';

-- Die Abfrage, einmal für Selbsttest und Prüfung. pg_temp liegt nicht in
-- `public` und wird darum selbst nicht erfasst.
create function pg_temp.ortspruefung_treffer() returns text
language sql stable as $$
  select string_agg(p.oid::regprocedure::text, ', ' order by p.oid::regprocedure::text)
    from pg_catalog.pg_proc p
    cross join lateral (
      select p.prosrc || ' ' || coalesce(pg_catalog.pg_get_function_sqlbody(p.oid), '') as rumpf
    ) t
   where p.pronamespace = 'public'::regnamespace
     and t.rumpf ~ '\m(ist_team_mitglied|meine_team_ids)\M'
     and t.rumpf ~ '\mist_verein_verwaltung\M'
$$;

create function public.v0_ortspruefung_attrappe_plpgsql() returns void
language plpgsql as $$
begin
  perform 'ist_team_mitglied';
  perform 'ist_verein_verwaltung';
end $$;

create function public.v0_ortspruefung_attrappe_sql() returns text
language sql
begin atomic
  select 'meine_team_ids ist_verein_verwaltung';
end;

do $$
declare
  treffer text := coalesce(pg_temp.ortspruefung_treffer(), '');
begin
  if position('v0_ortspruefung_attrappe_plpgsql()' in treffer) = 0
     or position('v0_ortspruefung_attrappe_sql()' in treffer) = 0 then
    raise exception 'Selbsttest der Ortsprüfung: Attrappen nicht gefunden (Treffer: %)', treffer;
  end if;
end $$;

drop function public.v0_ortspruefung_attrappe_plpgsql();
drop function public.v0_ortspruefung_attrappe_sql();

do $$
declare
  treffer text := pg_temp.ortspruefung_treffer();
begin
  if treffer is not null then
    raise exception 'Ortsprüfung: Funktionen kennen beide Rollen (Team und Verein): %', treffer;
  end if;
end $$;

rollback;
