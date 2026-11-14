-- Ortsprüfung (Rollen nach Ort, Architekturplan Vereine §5.5):
-- Keine Funktion in `public` darf beide Rollen kennen, also zugleich
-- `ist_team_mitglied` bzw. `meine_team_ids` (Team-Ort) und
-- `ist_verein_verwaltung` (Verein-Ort) im Funktionstext enthalten. Auf der
-- Verein-Seite zählen auch die Bausteine `verwaltung_sperren` und
-- `verwaltung_team_sperren` (Story 5), die das Prädikat in sich tragen: Die
-- `verein_*`-RPCs nennen es sonst nicht mehr selbst.
-- Geprüft wird bewusst nicht die Form der Verknüpfung, sondern nur, dass
-- nicht beide Prädikate in einer Funktion stehen. Eine Ausnahmeliste gibt es
-- nicht. Funktionen, die beides nur anzeigen, lesen `team_members` und
-- `verein_verwaltung` direkt.
--
-- Funktionstext ist `prosrc` und, für Funktionen mit SQL-Standard-Rumpf
-- (`begin atomic … end`, dort ist `prosrc` leer), `pg_get_function_sqlbody`.
--
-- Dazu (ab Story 3): Jede RPC `verein_*` beginnt mit nur_in_der_anwendung()
-- und weist ein KI-Token ab.
--
-- Selbsttest zuerst: vier Attrappen in `public` (plpgsql und SQL-Standard-
-- Rumpf mit beiden Prädikatnamen, dazu je eine mit dem Team-Prädikat und dem
-- Baustein `verwaltung_team_sperren` bzw. `verwaltung_spieler_sperren`) muss
-- die Abfrage finden. Sonst
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
     and t.rumpf ~ '\m(ist_verein_verwaltung|verwaltung_sperren|verwaltung_team_sperren|verwaltung_spieler_sperren)\M'
$$;

create function public.v0_ortspruefung_attrappe_plpgsql() returns void
language plpgsql as $$
begin
  perform 'ist_team_mitglied';
  perform 'ist_verein_verwaltung';
end $$;

create function public.v0_ortspruefung_attrappe_baustein() returns void
language plpgsql as $$
begin
  perform 'ist_team_mitglied';
  perform 'verwaltung_team_sperren';
end $$;

create function public.v0_ortspruefung_attrappe_spieler() returns void
language plpgsql as $$
begin
  perform 'meine_team_ids';
  perform 'verwaltung_spieler_sperren';
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
     or position('v0_ortspruefung_attrappe_sql()' in treffer) = 0
     or position('v0_ortspruefung_attrappe_baustein()' in treffer) = 0
     or position('v0_ortspruefung_attrappe_spieler()' in treffer) = 0 then
    raise exception 'Selbsttest der Ortsprüfung: Attrappen nicht gefunden (Treffer: %)', treffer;
  end if;
end $$;

drop function public.v0_ortspruefung_attrappe_plpgsql();
drop function public.v0_ortspruefung_attrappe_sql();
drop function public.v0_ortspruefung_attrappe_baustein();
drop function public.v0_ortspruefung_attrappe_spieler();

do $$
declare
  treffer text := pg_temp.ortspruefung_treffer();
begin
  if treffer is not null then
    raise exception 'Ortsprüfung: Funktionen kennen beide Rollen (Team und Verein): %', treffer;
  end if;
end $$;

-- Vereinsverwaltung nie per KI (AP §4.1, Pflicht-Inventar 8): Jede RPC
-- `verein_*` mit API-Recht ruft als erste Anweisung `nur_in_der_anwendung()`
-- (Prüfung am Funktionstext), und ein KI-Token (Claim `client_id`) scheitert
-- daran tatsächlich (ein Aufruf je RPC mit Null-Argumenten; die Prüfung kommt
-- vor allem anderen).
do $$
declare
  f regprocedure;
  ohne text;
begin
  select string_agg(p.oid::regprocedure::text, ', ') into ohne
    from pg_catalog.pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname like 'verein\_%'
     and has_function_privilege('authenticated', p.oid, 'execute')
     and p.prosrc !~ '^\s*(declare\M.*?)?\mbegin\s+perform\s+nur_in_der_anwendung\(\);';
  if ohne is not null then
    raise exception 'verein_*-RPCs ohne nur_in_der_anwendung() als erste Anweisung: %', ohne;
  end if;
end $$;

select set_config('request.jwt.claims',
         jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated', 'client_id', 'ki-client')::text, true)
       is not null as ortspruefung_ki_claims \gset
set local role authenticated;
do $$
declare
  r record;
  aufruf text;
  meldung text;
begin
  for r in select p.oid::regprocedure as f, p.proname, p.pronargs
             from pg_catalog.pg_proc p
            where p.pronamespace = 'public'::regnamespace and p.proname like 'verein\_%'
              and has_function_privilege('authenticated', p.oid, 'execute') loop
    aufruf := format('select %I(%s)', r.proname, (select string_agg('null', ', ') from generate_series(1, r.pronargs)));
    meldung := null;
    begin
      execute aufruf;
    exception when others then
      meldung := sqlerrm;
    end;
    if position('NUR_IN_DER_ANWENDUNG' in coalesce(meldung, '')) = 0 then
      raise exception '% mit KI-Token: erwartet NUR_IN_DER_ANWENDUNG, bekommen: %', r.f, coalesce(meldung, 'kein Fehler');
    end if;
  end loop;
end $$;
reset role;

rollback;
