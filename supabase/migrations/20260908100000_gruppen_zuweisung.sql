set lock_timeout = '5s';

-- ============================================================================
-- Story #150 (Epic #148 Pool-Training): Übungen im Hauptteil auf Gruppen
-- verteilen
-- ============================================================================
-- #149 hat die Gruppe als Bezeichnung am Training angelegt. Hier bekommt sie
-- ihren Zweck: die Zuweisung an eine Übung des Hauptteils, in einer Reihenfolge.
--
-- Die Position IN dieser Reihenfolge ist der WECHSEL (AK 11): das Zeitfenster,
-- das über alle Übungen des Hauptteils dasselbe meint — im Juniorenfussball
-- über beide Hauptteil-Blöcke hinweg. Steht «Gruppe 1» an Übung A auf Position
-- 0 und «Torhüter» an Übung B auf Position 0, dann laufen beide gleichzeitig.
-- Der Wechsel wird deshalb nicht gespeichert; er IST die Position.
--
-- Die Zuweisung hängt an der FASSUNG, nicht an der Übung im Bestand: verteilt
-- wird das, was in diesem Training steht (Epic #72). `on delete cascade` an
-- beiden Fremdschlüsseln zieht die Zuweisung mit der Fassung bzw. mit der
-- Gruppe ab (PC 1/PC 3) — eine Zuweisung ohne eine der beiden Seiten hätte
-- keine Bedeutung mehr.

create table training_exercise_gruppen (
  training_exercise_id uuid not null references training_exercises(id) on delete cascade,
  gruppe_id uuid not null references training_gruppen(id) on delete cascade,
  -- Nullbasiert wie `training_exercises.position`: der 1. Wechsel ist die
  -- Position 0. Die Anzeige zählt ab eins, die Datenebene ab null — in beiden
  -- Tabellen gleich, damit nicht zwei Zählweisen nebeneinanderstehen.
  position int not null check (position >= 0),
  -- AK 9: dieselbe Gruppe steht an einer Übung höchstens einmal. Der
  -- Primärschlüssel ist zugleich der Zugriffspfad auf die Folge einer Fassung
  -- (führende Spalte `training_exercise_id`).
  primary key (training_exercise_id, gruppe_id)
);

-- Zwei Gruppen im selben Wechsel derselben Übung wären keine Folge mehr,
-- sondern eine Verzweigung — die Anzeige könnte sie nicht ordnen. Der Index
-- hält die Folge lückenlos aufzählbar.
create unique index teg_position_je_fassung
  on training_exercise_gruppen (training_exercise_id, position);

-- Der Gegenweg: welche Übungen trägt diese Gruppe? Ihn braucht das
-- Kaskaden-Löschen einer Gruppe und die Bestätigungs-Rückfrage (AK 8).
create index teg_gruppe on training_exercise_gruppen (gruppe_id);

-- ----------------------------------------------------------------------------
-- Wo Gruppen gelten: der Hauptteil, in beiden Altersstufen
-- ----------------------------------------------------------------------------
-- Verteilt wird allein der Hauptteil (AK 10 / Out of Scope 1). Im
-- Kinderfussball ist er EIN Trainingsteil, im Juniorenfussball zerfällt er in
-- die beiden Blöcke «Spielformen und unterstützende Übungen» und «Spiel»
-- (AK 5) — die Einordnung einer Junioren-Fassung ist der Block, darum stehen
-- hier drei Werte und nicht einer.
--
-- `immutable`, weil die Antwort allein am Argument hängt: nur so lässt sie
-- sich in der WHEN-Klausel eines Triggers und in einem Index verwenden.
create function einordnung_traegt_gruppen(p_einordnung text) returns boolean
language sql
immutable
parallel safe
as $$
  -- `coalesce`, damit die Antwort nie unbekannt ist: eine WHEN-Klausel mit
  -- `null` liesse den Trigger stillschweigend aus.
  select coalesce(p_einordnung in ('hauptteil', 'jun-spielformen', 'jun-spiel'), false);
$$;

comment on function einordnung_traegt_gruppen(text) is
  'Spiegel von istHauptteil() in web/lib/gruppen.ts.';

-- ----------------------------------------------------------------------------
-- Guard: nur im Hauptteil, nur eigene Gruppen
-- ----------------------------------------------------------------------------
-- Beides liesse sich nicht als CHECK schreiben — es hängt an zwei anderen
-- Tabellen. Die Marker sind der vereinbarte Weg in den Klartext: die
-- Applikation erkennt sie und antwortet mit einem Satz, der den Weg nennt
-- (`fehlerMeldung()` in web/lib/training-bedingungen.ts).
create function teg_guard() returns trigger
language plpgsql
as $$
declare
  v_training uuid;
  v_teil text;
  v_gruppen_training uuid;
begin
  select te.training_id, te.trainingsteil into v_training, v_teil
    from training_exercises te
   where te.id = new.training_exercise_id;

  if not einordnung_traegt_gruppen(v_teil) then
    raise exception 'GRUPPE_NUR_HAUPTTEIL: Einordnung % traegt keine Gruppen', v_teil;
  end if;

  select g.training_id into v_gruppen_training
    from training_gruppen g
   where g.id = new.gruppe_id;

  -- Eine Gruppe gehört genau einem Training (#149 PC 1). Ohne diese Prüfung
  -- liesse sich die Gruppe eines fremden Trainings an eine eigene Übung
  -- hängen — die Anzeige fände dann keinen Namen dazu.
  if v_gruppen_training is distinct from v_training then
    raise exception 'GRUPPE_FREMDES_TRAINING: Gruppe % gehoert nicht zu Training %',
      new.gruppe_id, v_training;
  end if;

  return new;
end;
$$;

create trigger teg_guard
  before insert or update on training_exercise_gruppen
  for each row execute function teg_guard();

-- ----------------------------------------------------------------------------
-- Räumen: verlässt die Fassung den Hauptteil, fallen ihre Zuweisungen weg
-- ----------------------------------------------------------------------------
-- PC 2. Bewusst in der Datenbank und nicht in der Action: die Einordnung
-- ändert sich auf der Fassungs-Bearbeitungsseite (`updateFassung`), und der
-- Guard oben würde die zurückbleibende Zuweisung erst beim nächsten Schreiben
-- bemerken — bis dahin stünde eine Gruppe an einer Übung ausserhalb des
-- Hauptteils.
--
-- Ein Wechsel INNERHALB des Hauptteils räumt nicht: zwischen «Spielformen» und
-- «Spiel» gilt derselbe Durchlauf (AK 5). Darum steht die Bedingung an der
-- neuen Einordnung, nicht am blossen Unterschied.
create function te_gruppen_raeumen() returns trigger
language plpgsql
as $$
begin
  delete from training_exercise_gruppen where training_exercise_id = new.id;
  return null;
end;
$$;

create trigger te_gruppen_raeumen
  after update of trainingsteil on training_exercises
  for each row
  when (old.trainingsteil is distinct from new.trainingsteil
        and not einordnung_traegt_gruppen(new.trainingsteil))
  execute function te_gruppen_raeumen();

-- ----------------------------------------------------------------------------
-- Touch: eine Zuweisung ist eine Änderung am Training
-- ----------------------------------------------------------------------------
-- Die Funktion der Fassungen (`training_exercises_touch_training`) passt hier
-- NICHT: sie liest `new.training_id`, und diese Tabelle trägt keine solche
-- Spalte — die Zuweisung kennt ihr Training nur über die Fassung. Eine eigene
-- Spalte wäre eine zweite Wahrheit; darum die Auflösung im Trigger.
--
-- Beim Kaskaden-Löschen ist die Fassung bereits weg, die Unterabfrage liefert
-- `null` und das UPDATE trifft keine Zeile. Das ist richtig so: dort hat das
-- Löschen der Fassung selbst schon angefasst.
create function training_exercise_gruppen_touch_training() returns trigger
language plpgsql
as $$
begin
  update trainings set updated_at = now()
   where id = (select te.training_id from training_exercises te
                where te.id = coalesce(new.training_exercise_id, old.training_exercise_id));
  return null;
end;
$$;

create trigger teg_touch
  after insert or update or delete on training_exercise_gruppen
  for each row execute function training_exercise_gruppen_touch_training();

-- ----------------------------------------------------------------------------
-- RLS: die Zuweisung folgt dem Training über ihre Fassung
-- ----------------------------------------------------------------------------
-- Dieselben Bedingungen wie bei `tg_*` an den Gruppen, bloss eine Verknüpfung
-- weiter: lesen darf, wer das Training lesen darf (öffentlich, eigen, Team);
-- schreiben darf, wer es bearbeiten darf (eigen oder Team).
alter table training_exercise_gruppen enable row level security;

create policy teg_select on training_exercise_gruppen for select
  using (exists (select 1 from training_exercises te
                   join trainings p on p.id = te.training_id
                  where te.id = training_exercise_id
                    and (p.visibility = 'public' or p.owner_id = auth.uid()
                         or ist_team_mitglied(p.team_id))));
create policy teg_insert on training_exercise_gruppen for insert
  with check (exists (select 1 from training_exercises te
                        join trainings p on p.id = te.training_id
                       where te.id = training_exercise_id
                         and (p.owner_id = auth.uid()
                              or ist_team_mitglied(p.team_id))));
create policy teg_update on training_exercise_gruppen for update
  using (exists (select 1 from training_exercises te
                   join trainings p on p.id = te.training_id
                  where te.id = training_exercise_id
                    and (p.owner_id = auth.uid()
                         or ist_team_mitglied(p.team_id))));
create policy teg_delete on training_exercise_gruppen for delete
  using (exists (select 1 from training_exercises te
                   join trainings p on p.id = te.training_id
                  where te.id = training_exercise_id
                    and (p.owner_id = auth.uid()
                         or ist_team_mitglied(p.team_id))));

-- Rollen-Grants explizit, wie bei `training_gruppen`: die Default-Privilegie
-- aus `20260614120000_api_role_grants.sql` greift nur für Tabellen, die
-- derselbe Rollen-Kontext anlegt.
grant select, insert, update, delete on training_exercise_gruppen to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Die Folge einer Fassung setzen
-- ----------------------------------------------------------------------------
-- Eine Vollersetzung statt einzelner Zuweisungs-Schritte: Zuweisen,
-- Umsortieren und Entfernen sind aus Sicht der Daten dasselbe — eine neue
-- Reihenfolge. Ein Umsortieren als Folge von Einzel-Updates käme unterwegs an
-- der Eindeutigkeit von `teg_position_je_fassung` vorbei (zwei Gruppen kurz
-- auf derselben Position); die Vollersetzung kennt diesen Zwischenstand nicht.
--
-- `security definer`, weil die RPC in einem Rutsch löscht und schreibt und die
-- Berechtigung dabei genau EINMAL prüfen soll. Die Prüfung steht darum als
-- erste Anweisung — dieselbe Bedingung wie in den Policies.
--
-- Doppelte Einträge in `p_gruppen` verletzen den Primärschlüssel (AK 9); eine
-- Gruppe aus einem anderen Training bzw. eine Fassung ausserhalb des
-- Hauptteils fängt `teg_guard` ab.
create function setze_gruppenfolge(p_te uuid, p_gruppen uuid[]) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_erlaubt boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select exists (select 1 from training_exercises te
                   join trainings t on t.id = te.training_id
                  where te.id = p_te
                    and (t.owner_id = v_uid or ist_team_mitglied(t.team_id)))
    into v_erlaubt;
  if not v_erlaubt then
    raise exception 'training exercise not found or not editable by caller';
  end if;

  delete from training_exercise_gruppen where training_exercise_id = p_te;

  insert into training_exercise_gruppen (training_exercise_id, gruppe_id, position)
  select p_te, g, i - 1 from unnest(p_gruppen) with ordinality as u(g, i);
end;
$$;

revoke all on function setze_gruppenfolge(uuid, uuid[]) from public, anon;
grant execute on function setze_gruppenfolge(uuid, uuid[]) to authenticated;

-- ----------------------------------------------------------------------------
-- Selbstprüfung
-- ----------------------------------------------------------------------------
-- Geprüft wird, was die Anwendung nicht selbst sicherstellen kann: die vier
-- Policies (ohne sie liefe die Zugriffskontrolle ins Leere), die beiden
-- Eindeutigkeiten (zwei gleichzeitige Zuweisungen), die drei Trigger und die
-- Wertemenge der Einordnungs-Funktion — sie ist der Zwilling einer
-- TypeScript-Konstante und fiele sonst erst im Betrieb auseinander.
do $$
declare
  v_policies int;
  v_indizes int;
  v_trigger int;
begin
  select count(*) into v_policies
    from pg_policies
   where schemaname = 'public' and tablename = 'training_exercise_gruppen';
  if v_policies <> 4 then
    raise exception 'training_exercise_gruppen hat % Policies, erwartet 4', v_policies;
  end if;

  select count(*) into v_indizes
    from pg_index x
    join pg_class i on i.oid = x.indexrelid
   where x.indrelid = 'training_exercise_gruppen'::regclass
     and x.indisunique;
  if v_indizes <> 2 then
    raise exception 'training_exercise_gruppen hat % eindeutige Indizes, erwartet 2', v_indizes;
  end if;

  select count(*) into v_trigger
    from pg_trigger
   where not tgisinternal
     and tgname in ('teg_guard', 'teg_touch', 'te_gruppen_raeumen');
  if v_trigger <> 3 then
    raise exception 'Erwartet 3 Trigger (teg_guard, teg_touch, te_gruppen_raeumen), gefunden %', v_trigger;
  end if;

  if not (einordnung_traegt_gruppen('hauptteil')
          and einordnung_traegt_gruppen('jun-spielformen')
          and einordnung_traegt_gruppen('jun-spiel')) then
    raise exception 'einordnung_traegt_gruppen verneint eine Hauptteil-Einordnung';
  end if;
  if einordnung_traegt_gruppen('einleitung')
     or einordnung_traegt_gruppen('jun-aufwaermen')
     or einordnung_traegt_gruppen('ausklang')
     or einordnung_traegt_gruppen(null) then
    raise exception 'einordnung_traegt_gruppen bejaht eine Einordnung ausserhalb des Hauptteils';
  end if;
end;
$$;

reset lock_timeout;
