-- Ortsprüfung (Rollen nach Ort, Architekturplan Vereine §5.5):
-- Keine Funktion in `public` darf beide Rollen kennen, also zugleich
-- `ist_team_mitglied` bzw. `meine_team_ids` (Team-Ort) und
-- `ist_verein_verwaltung` (Verein-Ort) im Funktionstext enthalten.
-- Geprüft wird bewusst nicht die Form der Verknüpfung, sondern nur, dass
-- nicht beide Prädikate in einer Funktion stehen. Eine Ausnahmeliste gibt es
-- nicht. Funktionen, die beides nur anzeigen, lesen `team_members` und
-- `verein_verwaltung` direkt.
-- Nur lesend; hinterlässt nichts.

\set ON_ERROR_STOP on

begin;
set local statement_timeout = '30s';

do $$
declare
  treffer text;
begin
  select string_agg(p.oid::regprocedure::text, ', ' order by p.oid::regprocedure::text)
    into treffer
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.prosrc ~ '\m(ist_team_mitglied|meine_team_ids)\M'
     and p.prosrc ~ '\mist_verein_verwaltung\M';

  if treffer is not null then
    raise exception 'Ortsprüfung: Funktionen kennen beide Rollen (Team und Verein): %', treffer;
  end if;
end $$;

rollback;
