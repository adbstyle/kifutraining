set lock_timeout = '5s';

-- ============================================================================
-- Story #149 (Epic #148 Pool-Training): Gruppen eines Trainings benennen
-- ============================================================================
-- Ein Trainer mit zwanzig bis dreissig Kindern teilt seinen Hauptteil auf
-- parallel laufende Gruppen auf. Bisher stand diese Aufteilung auf einem
-- Zettel. Diese Migration legt die Gruppe als eigenes Datenobjekt am Training
-- an — vorerst nur die Bezeichnung; die Zuweisung an eine Übung folgt in #150.
--
-- Die Gruppe hängt AM TRAINING, nicht am Konto und nicht am Team: sie gilt
-- allein für die Einheit, an der sie angelegt wurde (PC 1). `on delete cascade`
-- zieht sie mit dem Training ab — eine Gruppe ohne Training hätte keinen
-- Bezugspunkt mehr.
--
-- Die Anwendung führt KEINE Kinder (Out of Scope 1/2): eine Gruppe besteht aus
-- einer Bezeichnung, nicht aus namentlich zugeordneten Kindern, und trägt auch
-- keine Kinderzahl. Darum genügen Name und Anlegezeitpunkt.
--
-- Die Anzeigereihenfolge ist die Anlegereihenfolge (`created_at, id`) — es gibt
-- keine vom Trainer gesetzte Ordnung der Gruppen. Die ID als zweites Kriterium
-- entscheidet zeitgleiche Anlagen eindeutig, statt die Reihenfolge zwischen
-- zwei Abfragen springen zu lassen.

create table training_gruppen (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references trainings(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  -- 1 bis 40 Zeichen auf dem GETRIMMTEN Namen: ein Name aus lauter Leerzeichen
  -- ist keiner, und 40 Zeichen sind das Mass, das eine Zeile im Editor und ein
  -- Chip im Durchlauf noch lesbar tragen.
  constraint tg_name_laenge check (char_length(btrim(name)) between 1 and 40)
);

comment on constraint tg_name_laenge on training_gruppen is
  'Spiegel von GRUPPE_NAME_MAX/nameProblem() in web/lib/gruppen.ts.';

-- Eindeutigkeit je Training, ohne Rücksicht auf Gross-/Kleinschreibung und auf
-- umschliessende Leerzeichen (AK 6/7): «Gruppe 1» und « gruppe 1 » sind
-- dieselbe Gruppe. Der Index ist zugleich der schnelle Zugriffspfad auf die
-- Gruppen eines Trainings — ein zusätzlicher Index auf `training_id` allein
-- wäre redundant, weil `training_id` hier die führende Spalte ist.
create unique index tg_name_je_training
  on training_gruppen (training_id, lower(btrim(name)));

comment on index tg_name_je_training is
  'Spiegel von gruppenSchluessel()/nameProblem() in web/lib/gruppen.ts.';

-- ----------------------------------------------------------------------------
-- RLS: die Gruppe folgt dem Training, dem sie gehört
-- ----------------------------------------------------------------------------
-- Genau die Kette der `te_*`-Policies an den Fassungen: lesen darf, wer das
-- Training lesen darf (öffentlich, eigen, Team); schreiben darf, wer es
-- bearbeiten darf (eigen oder Team). Der öffentliche Zustand schliesst das
-- Bearbeiten nicht aus — Veröffentlichen ist ein Zustand, kein Einfrieren.
alter table training_gruppen enable row level security;

create policy tg_select on training_gruppen for select
  using (exists (select 1 from trainings p
                 where p.id = training_id
                   and (p.visibility = 'public' or p.owner_id = auth.uid()
                        or ist_team_mitglied(p.team_id))));
create policy tg_insert on training_gruppen for insert
  with check (exists (select 1 from trainings p
                      where p.id = training_id
                        and (p.owner_id = auth.uid()
                             or ist_team_mitglied(p.team_id))));
create policy tg_update on training_gruppen for update
  using (exists (select 1 from trainings p
                 where p.id = training_id
                   and (p.owner_id = auth.uid()
                        or ist_team_mitglied(p.team_id))));
create policy tg_delete on training_gruppen for delete
  using (exists (select 1 from trainings p
                 where p.id = training_id
                   and (p.owner_id = auth.uid()
                        or ist_team_mitglied(p.team_id))));

-- Rollen-Grants explizit, obwohl `20260614120000_api_role_grants.sql` eine
-- Default-Privilegie gesetzt hat: Sie greift nur für Tabellen, die derselbe
-- Rollen-Kontext anlegt. Ein 42501 «permission denied for table» fiele sonst
-- erst zur Laufzeit auf, und RLS steht ohnehin darüber.
grant select, insert, update, delete on training_gruppen to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Touch: eine Gruppen-Änderung ist eine Änderung am Training
-- ----------------------------------------------------------------------------
-- Sonst zeigte die Trainingsübersicht «zuletzt geändert» einen Stand, der die
-- Gruppen nicht kennt. Die Funktion der Fassungen passt unverändert: sie liest
-- `coalesce(new.training_id, old.training_id)` und deckt damit auch das
-- Löschen ab.
create trigger tg_touch
  after insert or update or delete on training_gruppen
  for each row execute function training_exercises_touch_training();

-- ----------------------------------------------------------------------------
-- Selbstprüfung
-- ----------------------------------------------------------------------------
-- Vier Policies und der Eindeutigkeits-Index sind die Zusagen dieser Migration
-- an die Anwendung: ohne sie liefe die Zugriffskontrolle ins Leere bzw. liesse
-- die Datenbank doppelte Bezeichnungen durch, die die Anwendung allein nicht
-- verhindern kann (zwei gleichzeitige Anlagen).
do $$
declare
  v_policies int;
  v_index int;
begin
  select count(*) into v_policies
    from pg_policies
   where schemaname = 'public' and tablename = 'training_gruppen';
  if v_policies <> 4 then
    raise exception 'training_gruppen hat % Policies, erwartet 4', v_policies;
  end if;

  select count(*) into v_index
    from pg_class i
    join pg_index x on x.indexrelid = i.oid
   where i.relname = 'tg_name_je_training'
     and x.indrelid = 'training_gruppen'::regclass
     and x.indisunique;
  if v_index <> 1 then
    raise exception 'tg_name_je_training fehlt oder ist nicht eindeutig';
  end if;
end;
$$;

reset lock_timeout;
