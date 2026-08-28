-- ============================================================================
-- Training veröffentlichen: Umschalten statt Einfrieren
-- (Stories A/B, Spec 2026-08-26)
--
-- Veröffentlichen war eine eingefrorene Kopie: ein privates Original plus eine
-- öffentliche, unveränderliche Vorlage, verbunden über `vorlage_id`. Künftig
-- ist Veröffentlichen ein Zustand am Training selbst — wie bei den Übungen.
--
-- Die Reihenfolge in dieser Datei ist zwingend: erst das alte Tor entfernen,
-- dann die Daten in den neuen Zustand bringen, dann die neue Invariante scharf
-- schalten. Jede andere Reihenfolge lässt die Migration an Bestandsdaten
-- scheitern — das alte Tor an Originalen unter seiner Schwelle, die neue
-- Invariante am noch nicht nachgezogenen freien Spiel.
-- ============================================================================

-- Lock-Schranke an den Dateianfang, nicht vor die DDL: sonst warten auch die
-- Leseabfragen davor unbegrenzt (gemessen 2026-08-26: ohne Schranke 21 s).
-- `set` statt `set local`, weil die Datei atomar, aber nicht in einem
-- Transaktionsblock im Postgres-Sinn läuft.
set lock_timeout = '3s';

-- ----------------------------------------------------------------------------
-- 0) Das alte Tor fällt zuerst
-- ----------------------------------------------------------------------------
-- `training_publish_gate` weist jedes Öffentlich-Schalten ab, dem Alterskategorie,
-- Einleitung oder Hauptteil fehlt. Es MUSS vor Abschnitt 1 fallen: dort werden
-- die privaten Originale öffentlich geschaltet, und ein Original darf seit dem
-- Veröffentlichen frei bearbeitet worden sein — auch bis unter diese Schwelle.
-- Ein einziges solches Training in Produktion liesse die Migration und damit den
-- Deploy scheitern (nachgestellt und gemessen: «TRAINING_UNVOLLSTAENDIG:
-- einleitung»). Was künftig gilt, setzt der Trigger aus Abschnitt 3 durch — und
-- zwar erst, nachdem Abschnitt 2 den Bestand in Ordnung gebracht hat.
--
-- Trigger und Funktion explizit, in dieser Reihenfolge: Postgres trackt die
-- Abhängigkeit eines plpgsql-Rumpfs auf Spalten nicht.
drop trigger training_publish_gate on trainings;
drop function training_publish_gate();

-- ----------------------------------------------------------------------------
-- 1) Altbestand: die Vorlagen-Paare auflösen
-- ----------------------------------------------------------------------------
-- Je aktiver Vorlage existieren zwei Zeilen: das private, weitergepflegte
-- Original und die eingefrorene Kopie vom Veröffentlichungszeitpunkt. Das
-- Original übernimmt die Sichtbarkeit, die Kopie fällt (PO-Entscheid
-- 2026-08-26). Was die Community sieht, springt damit auf den aktuellen
-- Bearbeitungsstand des Urhebers — bewusst in Kauf genommen, weil danach je
-- Training genau ein Objekt existiert.
--
-- Die Bilddateien der gelöschten Kopien bleiben im Storage liegen: SQL
-- erreicht ihn nicht. Verwaiste Storage-Dateien sind im Projekt bereits
-- toleriert (`sync-staging` benennt es ausdrücklich).

-- `updated_at` bewusst erhalten, für Abschnitt 1 UND 2. Die Kachel zeigt es als
-- «Geändert» an und die Übersicht sortiert danach: würde der Deploy jedes
-- betroffene Training auf heute stellen, behauptete die Anwendung eine Änderung,
-- die der Trainer nie vorgenommen hat.
--
-- Zwei Trigger, nicht einer: `trainings_set_updated_at` greift beim Umschalten
-- der Sichtbarkeit, `training_exercises_touch` beim Einfügen der Fassung fürs
-- freie Spiel. Nur den ersten abzuschalten liesse genau die Trainings auf das
-- Deploy-Datum springen, die eine Fassung nachgezogen bekommen.
alter table trainings disable trigger trainings_set_updated_at;
alter table training_exercises disable trigger training_exercises_touch;

update trainings o
  set visibility = 'public'
  where o.vorlage_id is not null
    and o.visibility = 'private';

-- Nach dem Update, nicht davor: `on delete set null` räumt `vorlage_id` mit
-- der Löschung ab, danach fände das `exists` die Paare nicht mehr.
delete from trainings v
  where v.visibility = 'public'
    and exists (select 1 from trainings o where o.vorlage_id = v.id);

-- ----------------------------------------------------------------------------
-- 2) Freies Spiel nachziehen
-- ----------------------------------------------------------------------------
-- Das freie Spiel wird Veröffentlichungsbedingung (Story A AK 5). Öffentliche
-- Trainings ohne eine Fassung in der Hauptteilkategorie `fussball-spielen`
-- würden sie ab Abschnitt 3 dauerhaft verletzen und wären für jede weitere
-- Änderung gesperrt. Statt sie stillschweigend auf Entwurf zurückzunehmen,
-- bekommen sie die Manual-Übung des freien Spiels (PO-Entscheid 2026-08-26).
-- Sie ist im Kinderfussball-Bestand die einzige ihrer Kategorie und deckt G, F
-- und E ab, taugt also für jedes Training.
--
-- Abweichung mit Absicht: `bild_url` zeigt auf die Bilddatei der Manual-Übung
-- statt auf eine eigene Kopie — den Storage kann diese Migration nicht
-- befüllen. Unschädlich, weil Manual-Übungen und ihre Bilder unveränderlich
-- und öffentlich sind.
--
-- Findet sich keine Manual-Übung (frische Wegwerf-DB im PR-Check, in der der
-- Seed erst nach den Migrationen läuft), fügt das Statement nichts ein. Das
-- ist unkritisch: die Invariante unten ist ein Constraint-Trigger und wird
-- nicht gegen Bestandszeilen geprüft.
insert into training_exercises (
  training_id, trainingsteil, hauptteilkategorie, position, duration_min,
  name, kategorien, erscheinungsform, feldtyp, anzahl_kinder, material,
  methodischer_fahrplan, aufbau, varianten, bild_url, bild_quelle, diagramm)
select
  t.id, 'hauptteil', 'fussball-spielen',
  -- Ans Ende des Hauptteils. Die Positionen sind je (Training, Teil)
  -- eindeutig; ein leerer Hauptteil beginnt bei 0.
  coalesce((select max(te.position) + 1 from training_exercises te
            where te.training_id = t.id and te.trainingsteil = 'hauptteil'), 0),
  null,
  q.name, q.kategorien, q.erscheinungsform, q.feldtyp, q.anzahl_kinder,
  q.material, q.methodischer_fahrplan, q.aufbau, q.varianten,
  q.bild_url, q.bild_quelle, q.diagramm
from trainings t
cross join (
  select * from exercises
    where source = 'manual' and hauptteilkategorie = 'fussball-spielen'
    order by slug
    limit 1
) q
where t.visibility = 'public'
  and not exists (select 1 from training_exercises te
                  where te.training_id = t.id
                    and te.hauptteilkategorie = 'fussball-spielen');

alter table training_exercises enable trigger training_exercises_touch;
alter table trainings enable trigger trainings_set_updated_at;

-- ----------------------------------------------------------------------------
-- 3) Die Bedingungen gelten dauerhaft, nicht nur beim Übergang
-- ----------------------------------------------------------------------------
-- Das alte `training_publish_gate` (in Abschnitt 0 gefallen) prüfte
-- ausschliesslich den Übergang nach öffentlich. Ein öffentliches Training liess
-- sich danach unter die Schwelle bringen — unter dem Kopie-Modell unschädlich,
-- weil die Vorlage eingefroren war. Ohne Einfrieren wäre es der Weg, halbfertige
-- Trainings öffentlich stehen zu lassen. Neu: die Bedingungen gelten, solange
-- ein Training öffentlich ist.

-- Die Prüfung als eigene Funktion: zwei Tabellen lösen sie aus, die Regel darf
-- aber nur an einer Stelle stehen.
create function training_pruefe_oeffentlich(p_id uuid) returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_public boolean;
  v_stufen int;
begin
  select visibility = 'public', coalesce(array_length(stufen, 1), 0)
    into v_public, v_stufen
    from trainings where id = p_id;

  -- Zeile weg: das ganze Training wurde gelöscht und hat seine Fassungen
  -- mitgenommen. Nichts zu prüfen — sonst schlüge jeder Kaskaden-Delete an.
  if v_public is null then return; end if;
  if not v_public then return; end if;

  if v_stufen = 0 then
    raise exception 'TRAINING_UNVOLLSTAENDIG: stufe';
  end if;
  if not exists (select 1 from training_exercises
                 where training_id = p_id and trainingsteil = 'einleitung') then
    raise exception 'TRAINING_UNVOLLSTAENDIG: einleitung';
  end if;
  -- Das freie Spiel liegt im Hauptteil: diese Bedingung deckt «mindestens eine
  -- Übung im Hauptteil» zwingend mit ab, eine eigene Prüfung dafür entfällt.
  if not exists (select 1 from training_exercises
                 where training_id = p_id
                   and hauptteilkategorie = 'fussball-spielen') then
    raise exception 'TRAINING_UNVOLLSTAENDIG: freies_spiel';
  end if;
end;
$$;

create function trainings_oeffentlich_gate() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  perform training_pruefe_oeffentlich(new.id);
  return null;
end;
$$;

create function training_exercises_oeffentlich_gate() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- Getrennt nach Operation: in einem DELETE-Trigger ist `new` nicht belegt,
  -- ein Zugriff darauf scheitert zur Laufzeit. Beim Verschieben zwischen zwei
  -- Trainings sind beide Seiten zu prüfen.
  if tg_op <> 'DELETE' then
    perform training_pruefe_oeffentlich(new.training_id);
  end if;
  if tg_op <> 'INSERT' then
    perform training_pruefe_oeffentlich(old.training_id);
  end if;
  return null;
end;
$$;

-- `deferrable initially deferred` aus zwei Gründen: ein Umsortieren oder ein
-- Austauschen von Fassungen darf nicht am Zwischenstand scheitern, und beim
-- Löschen eines ganzen Trainings ist die Kaskade beim Commit abgeschlossen.
create constraint trigger trainings_oeffentlich_gate
  after insert or update of visibility, stufen on trainings
  deferrable initially deferred
  for each row execute function trainings_oeffentlich_gate();

create constraint trigger training_exercises_oeffentlich_gate
  after insert or update or delete on training_exercises
  deferrable initially deferred
  for each row execute function training_exercises_oeffentlich_gate();

-- ----------------------------------------------------------------------------
-- 4) Das Einfrieren aus den Policies nehmen
-- ----------------------------------------------------------------------------
-- Bisher traf `USING` nur private eigene Zeilen — eine öffentliche war für
-- jedes UPDATE unerreichbar, das war das Einfrieren. Der Eigentümer darf sein
-- Training künftig auch im öffentlichen Zustand bearbeiten; was dabei nicht
-- unter die Schwelle fallen darf, regelt Abschnitt 3.
--
-- `WITH CHECK` bleibt unverändert: es hält Person und Team getrennt.
drop policy tr_update on trainings;
create policy tr_update on trainings for update
  using (owner_id = auth.uid() or ist_team_mitglied(team_id))
  with check ((owner_id = auth.uid() and team_id is null)
              or ist_team_mitglied(team_id));

-- Dieselbe Lockerung für die Fassungen: sie folgen dem Training, dem sie
-- gehören. Der SELECT-Fall war nie eingeschränkt und bleibt, wie er ist.
drop policy te_insert on training_exercises;
create policy te_insert on training_exercises for insert
  with check (exists (select 1 from trainings p
                      where p.id = training_id
                        and (p.owner_id = auth.uid()
                             or ist_team_mitglied(p.team_id))));
drop policy te_update on training_exercises;
create policy te_update on training_exercises for update
  using (exists (select 1 from trainings p
                 where p.id = training_id
                   and (p.owner_id = auth.uid()
                        or ist_team_mitglied(p.team_id))));
drop policy te_delete on training_exercises;
create policy te_delete on training_exercises for delete
  using (exists (select 1 from trainings p
                 where p.id = training_id
                   and (p.owner_id = auth.uid()
                        or ist_team_mitglied(p.team_id))));

-- ----------------------------------------------------------------------------
-- 5) Der Vorlagen-Verweis entfällt
-- ----------------------------------------------------------------------------
-- Er verband Original und eingefrorene Kopie. Ohne Kopie gibt es nichts zu
-- verbinden. Der Teil-Index auf der Spalte fällt mit ihr.
--
-- Kein plpgsql-Rumpf liest `vorlage_id`: die Trigger auf `trainings` sind
-- `set_updated_at` (nur updated_at), der Suchtext-Trigger (nur name) und der
-- Gate aus Abschnitt 3 (visibility, stufen).
alter table trainings drop column vorlage_id;

-- `tr_team_nie_public` bleibt: Team-Trainings sind nie öffentlich (Story A
-- AK 9). Ein Team-Training wird dafür zuerst persönlich übernommen.

reset lock_timeout;
