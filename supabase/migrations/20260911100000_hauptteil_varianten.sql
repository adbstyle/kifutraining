set lock_timeout = '5s';

-- ============================================================================
-- Story #201 (Epic #200 Hauptteil-Varianten): der Hauptteil wird mehrfach
-- ============================================================================
-- Wer erst am Trainingstag weiss, wie viele Kinder kommen, bereitet zwei
-- Hauptteile vor und spielt den passenden. Bisher hiess das zwei Trainings.
-- Diese Migration macht den Hauptteil zum mehrfach besetzbaren Abschnitt: eine
-- VARIANTE ist eine benannte Zusammenstellung des ganzen Hauptteils — im
-- Kinderfussball über alle drei Unterkategorien, im Juniorenfussball über die
-- Blöcke «Spielformen» und «Spiel» (#201 AK/PC 4).
--
-- Alles andere bleibt am Training: Name, Ziel, Altersstufe, Alterskategorien,
-- die GRUPPEN-DEFINITIONEN, Sichtbarkeit, Eigentum, Termin und die
-- Trainingsteile ausserhalb des Hauptteils (#201 PC 3). Eine Variante hat
-- weder eigene Sichtbarkeit noch eigenen Eigentümer (Epic Out of Scope 5) —
-- darum trägt sie nur Bezeichnung und Reihenfolge.
--
-- Die Einordnungen, die eine Variante umfasst, sind GENAU die, die auch
-- Gruppen tragen: `einordnung_traegt_gruppen()` ist die eine Quelle dafür.
--
-- Reihenfolge in dieser Datei ist zwingend (Architektur-Gegenprüfung):
--   1) Tabelle + Spalte          — noch ohne Invariante, damit der Backfill
--                                  überhaupt Zeilen schreiben kann
--   2) Backfill                  — jedes Training bekommt «Variante 1», jede
--                                  Hauptteil-Fassung zeigt darauf
--   3) CHECK (inline validiert)  — der Bestand ist jetzt sauber; ein NOT VALID
--                                  brächte nichts, weil der Backfill in
--                                  derselben Datei davorsteht
--   4) Indizes                   — Positionen sind ab jetzt je Variante
--   5) Trigger + RPCs            — ERST hier, sonst schriebe der Touch-Trigger
--                                  jedem Training das Deploy-Datum als
--                                  «zuletzt geändert»

-- ----------------------------------------------------------------------------
-- 1) Die Variante
-- ----------------------------------------------------------------------------
-- `on delete cascade` zieht sie mit dem Training ab — eine Variante ohne
-- Training hätte keinen Bezugspunkt (dasselbe Muster wie `training_gruppen`).
create table training_varianten (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references trainings(id) on delete cascade,
  name text not null,
  -- Die vom Trainer gesetzte Reihenfolge (#202). Nullbasiert wie
  -- `training_exercises.position`.
  --
  -- BEWUSST OHNE `check (position >= 0)`: `verschiebe_variante` tauscht zwei
  -- Positionen über den Zwischenwert -1, weil `tv_position_je_training`
  -- eindeutig ist (dasselbe Vorgehen wie `move_training_exercise`). Ein
  -- Wertebereichs-CHECK stünde diesem Zwischenschritt im Weg, und die Position
  -- ist eine interne Ordnungszahl, die nie jemand liest.
  position int not null,
  created_at timestamptz not null default now(),
  -- 1 bis 40 Zeichen auf dem GETRIMMTEN Namen, wortgleich zu den Gruppen
  -- (#201 AK 4): ein Name aus lauter Leerzeichen ist keiner, und 40 Zeichen
  -- sind das Mass, das ein Chip in der Variantenwahl noch lesbar trägt.
  constraint tv_name_laenge check (char_length(btrim(name)) between 1 and 40)
);

comment on table training_varianten is
  'Benannte Zusammenstellung des Hauptteils eines Trainings (Epic #200). Jedes Training führt jederzeit mindestens eine (Trigger trainings_erste_variante, tv_letzte_bleibt).';

comment on constraint tv_name_laenge on training_varianten is
  'Spiegel von VARIANTE_NAME_MAX/varianteNameProblem() in web/lib/varianten.ts.';

-- Eindeutigkeit je Training ohne Rücksicht auf Gross-/Kleinschreibung und
-- umschliessende Leerzeichen (#201 AK 4/5) — dieselbe Regel wie bei den
-- Gruppen. Der Index ist zugleich der Zugriffspfad auf die Varianten eines
-- Trainings (führende Spalte `training_id`).
create unique index tv_name_je_training
  on training_varianten (training_id, lower(btrim(name)));

comment on index tv_name_je_training is
  'Spiegel von bezeichnungSchluessel()/varianteNameProblem() in web/lib/bezeichnung.ts bzw. web/lib/varianten.ts.';

-- Zwei Varianten auf derselben Position wären keine Reihenfolge mehr. Der
-- Index hält «die erste Variante» eindeutig beantwortbar (#201 AK 7).
create unique index tv_position_je_training
  on training_varianten (training_id, position);

-- Die Fassung zeigt auf ihre Variante. `on delete cascade`: fällt eine
-- Variante, fallen ihre Übungen mit — sie gehören zu dieser Zusammenstellung
-- und zu keiner anderen (#202).
alter table training_exercises
  add column variante_id uuid references training_varianten(id) on delete cascade;

comment on column training_exercises.variante_id is
  'Die Variante des Hauptteils, zu der diese Fassung gehört; null ausserhalb des Hauptteils (CHECK te_variante_genau_bei_hauptteil, Trigger te_variante_ausrichten).';

-- Der Gegenweg: welche Fassungen trägt diese Variante? Ihn braucht die
-- Anzeige, das Kopieren und das Kaskaden-Löschen.
create index training_exercises_variante_idx on training_exercises (variante_id);

-- ----------------------------------------------------------------------------
-- 2) Backfill: jedes bestehende Training bekommt seine erste Variante
-- ----------------------------------------------------------------------------
-- Der Bestand kennt genau einen Hauptteil je Training. Er wird zur ersten
-- Variante «Variante 1» — dieselbe Vorbelegung, die der Editor beim Anlegen
-- der zweiten Variante als bisherigen Namen anbietet (#201 AK 2).
--
-- Zwei Trigger stehen dem zweiten Schritt im Weg (Muster:
-- `altersstufe_spalten`):
--
-- `training_exercises_touch` schriebe jedem Training das Deploy-Datum als
-- «Geändert»; die Übersicht behauptete eine Änderung, die niemand vorgenommen
-- hat.
--
-- `training_exercises_oeffentlich_gate` feuert bei JEDEM Update auf dieser
-- Tabelle und prüft dann das ganze Training. Ein bestehendes öffentliches
-- Training, dem heute eine Bedingung fehlt, liesse den Deploy an einer
-- Altzeile scheitern, die niemand angerührt hat. Der Backfill setzt ohnehin
-- nur die Variante, die keine Bedingung berührt.
insert into training_varianten (training_id, name, position)
select t.id, 'Variante 1', 0
  from trainings t
 where not exists (select 1 from training_varianten v where v.training_id = t.id);

alter table training_exercises disable trigger training_exercises_touch;
alter table training_exercises disable trigger training_exercises_oeffentlich_gate;

update training_exercises te
   set variante_id = v.id
  from training_varianten v
 where v.training_id = te.training_id
   and v.position = 0
   and einordnung_traegt_gruppen(te.trainingsteil)
   and te.variante_id is null;

alter table training_exercises enable trigger training_exercises_oeffentlich_gate;
alter table training_exercises enable trigger training_exercises_touch;

-- ----------------------------------------------------------------------------
-- 3) Die Invariante: Variante genau im Hauptteil
-- ----------------------------------------------------------------------------
-- Eine Hauptteil-Fassung OHNE Variante wäre in keiner Zusammenstellung
-- sichtbar, eine Fassung ausserhalb des Hauptteils MIT Variante behauptete
-- eine Zugehörigkeit, die es nicht gibt (Varianten umfassen nur den Hauptteil,
-- Epic Out of Scope 2). Der Biconditional sagt beides in einer Zeile.
--
-- Inline validiert und nicht `not valid`: Der Backfill steht in derselben
-- Datei davor, der Bestand ist damit vollständig gefüllt. Ein späteres
-- `validate` wäre eine zweite Migration ohne Nutzen.
alter table training_exercises
  add constraint te_variante_genau_bei_hauptteil
  check ((variante_id is not null) = einordnung_traegt_gruppen(trainingsteil));

comment on constraint te_variante_genau_bei_hauptteil on training_exercises is
  'Spiegel von istHauptteil() in web/lib/gruppen.ts: genau die Hauptteil-Einordnungen tragen eine Variante.';

-- ----------------------------------------------------------------------------
-- 4) Positionen gelten je Variante
-- ----------------------------------------------------------------------------
-- Bisher war die Reihenfolge im Hauptteil je (Training, Unterkategorie)
-- eindeutig. Mit Varianten stehen dieselben Positionen mehrfach — je Variante
-- einmal. Die alten Indizes müssen darum fallen, nicht bloss ergänzt werden.
--
-- Der Junioren-Hauptteil bekommt einen EIGENEN Index: seine beiden Blöcke
-- tragen keine Unterkategorie, ihre Reihenfolge zählt je Block. Bisher lief er
-- im «nonhauptteil»-Index mit, dessen Prädikat nur `hauptteil` ausnahm.
drop index training_ex_pos_hauptteil;
drop index training_ex_pos_nonhauptteil;

create unique index training_ex_pos_hauptteil
  on training_exercises (training_id, variante_id, hauptteilkategorie, position)
  where trainingsteil = 'hauptteil';

create unique index training_ex_pos_jun_hauptteil
  on training_exercises (training_id, variante_id, trainingsteil, position)
  where trainingsteil in ('jun-spielformen', 'jun-spiel');

-- Ausserhalb des Hauptteils gibt es keine Varianten — dort bleibt die
-- Reihenfolge je (Training, Teil) eindeutig. `einordnung_traegt_gruppen` ist
-- `immutable` und darf darum im Index-Prädikat stehen; so hängen Prädikat und
-- CHECK an derselben Quelle.
create unique index training_ex_pos_nonhauptteil
  on training_exercises (training_id, trainingsteil, position)
  where not einordnung_traegt_gruppen(trainingsteil);

-- Die Funktion trägt jetzt drei Abhängigkeiten, von denen zwei nicht mehr
-- durch blosses Neuanlegen der Funktion mitwandern.
comment on function einordnung_traegt_gruppen(text) is
  'Spiegel von istHauptteil() in web/lib/gruppen.ts. ACHTUNG: Wer die Wertemenge ändert, muss den Index training_ex_pos_nonhauptteil neu bauen und den CHECK te_variante_genau_bei_hauptteil neu validieren — beide hängen an dieser Funktion.';

-- ----------------------------------------------------------------------------
-- 5a) RLS: die Variante folgt dem Training, dem sie gehört
-- ----------------------------------------------------------------------------
-- Exakt die Kette der `tg_*`-Policies an den Gruppen: lesen darf, wer das
-- Training lesen darf (öffentlich, eigen, Team) — auch Betrachtende ohne
-- Bearbeitungsrecht wechseln die Variante (Epic EK 8); schreiben darf, wer das
-- Training bearbeiten darf.
alter table training_varianten enable row level security;

create policy tv_select on training_varianten for select
  using (exists (select 1 from trainings p
                 where p.id = training_id
                   and (p.visibility = 'public' or p.owner_id = auth.uid()
                        or ist_team_mitglied(p.team_id))));
create policy tv_insert on training_varianten for insert
  with check (exists (select 1 from trainings p
                      where p.id = training_id
                        and (p.owner_id = auth.uid()
                             or ist_team_mitglied(p.team_id))));
create policy tv_update on training_varianten for update
  using (exists (select 1 from trainings p
                 where p.id = training_id
                   and (p.owner_id = auth.uid()
                        or ist_team_mitglied(p.team_id))));
create policy tv_delete on training_varianten for delete
  using (exists (select 1 from trainings p
                 where p.id = training_id
                   and (p.owner_id = auth.uid()
                        or ist_team_mitglied(p.team_id))));

-- Rollen-Grants explizit, wie bei `training_gruppen`: die Default-Privilegie
-- aus `api_role_grants` greift nur für Tabellen, die derselbe Rollen-Kontext
-- anlegt. Ein 42501 fiele sonst erst zur Laufzeit auf.
grant select, insert, update, delete on training_varianten to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5b) Jedes Training führt ab dem ersten Moment eine Variante
-- ----------------------------------------------------------------------------
-- «Ein Training führt jederzeit mindestens einen Hauptteil» (Epic EK 6). Die
-- Invariante hier statt in jedem Anlege-Pfad: `createTraining` und
-- `kopiereTraining` legen Trainings an, der KI-Zugang (#190) wird folgen — je
-- mehr Pfade, desto sicherer vergisst einer die Variante.
--
-- `security definer`, damit die Invariante nicht an einer Nutzer-Policy hängt:
-- wer ein Training anlegen darf, bekommt seine Variante, ohne dass `tv_insert`
-- ein zweites Mal dasselbe entscheidet (Muster `te_altersstufe_erben`).
--
-- Die Vorbelegung «Variante 1» ist dieselbe wie im Backfill und in
-- `VARIANTE_DEFAULT_NAME` (web/lib/varianten.ts): Solange ein Training nur
-- einen Hauptteil führt, zeigt die Oberfläche den Namen gar nicht (#201 PC 5) —
-- er wird erst sichtbar, wenn die zweite Variante dazukommt.
create function trainings_erste_variante() returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into training_varianten (training_id, name, position)
  values (new.id, 'Variante 1', 0);
  return null;
end;
$$;

create trigger trainings_erste_variante
  after insert on trainings
  for each row execute function trainings_erste_variante();

-- Und sie verliert die letzte nicht wieder (#202). Als CONSTRAINT-Trigger
-- `deferrable initially deferred` wie die Veröffentlichungs-Gates: Beim
-- Löschen eines ganzen Trainings ist die Kaskade erst beim Commit
-- abgeschlossen — die Zwischenstände (Training weg, Varianten fallen nacheinander)
-- dürfen nicht anschlagen.
--
-- `exists (select 1 from trainings …)` ist genau diese Unterscheidung: Ist das
-- Training beim Commit noch da, war es eine gezielte Entfernung und die letzte
-- Variante fehlt wirklich; ist es weg, wurde das Training gelöscht und es gibt
-- nichts mehr zu schützen.
create function tv_letzte_bleibt() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from trainings t where t.id = old.training_id)
     and not exists (select 1 from training_varianten v where v.training_id = old.training_id) then
    raise exception 'LETZTE_VARIANTE: Training % haette keinen Hauptteil mehr', old.training_id;
  end if;
  return null;
end;
$$;

create constraint trigger tv_letzte_bleibt
  after delete on training_varianten
  deferrable initially deferred
  for each row execute function tv_letzte_bleibt();

-- Touch: eine Varianten-Änderung ist eine Änderung am Training. Sonst zeigte
-- die Übersicht «zuletzt geändert» einen Stand, der die Varianten nicht kennt.
-- Die Funktion der Fassungen passt unverändert — sie liest
-- `coalesce(new.training_id, old.training_id)` und deckt damit auch das
-- Löschen ab.
create trigger tv_touch
  after insert or update or delete on training_varianten
  for each row execute function training_exercises_touch_training();

-- ----------------------------------------------------------------------------
-- 5c) Die Fassung findet ihre Variante — oder wird abgewiesen
-- ----------------------------------------------------------------------------
-- Drei Regeln, die sich nicht als CHECK schreiben lassen, weil sie an einer
-- zweiten Tabelle hängen:
--
-- - Verlässt eine Fassung den Hauptteil, verliert sie ihre Variante. Das
--   Gegenstück zu `te_gruppen_raeumen`, und ohne es liefe das UPDATE in den
--   CHECK statt in eine Meldung.
-- - Kommt sie ohne ausdrückliche Variante in den Hauptteil, gilt die erste.
--   Eine definierte Regel statt eines Fehlers: Der Editor setzt die Variante
--   immer ausdrücklich, aber ein Weg an ihm vorbei (Import, KI-Zugang, ein
--   Bestandsdatensatz) soll nicht in einer unsichtbaren Fassung enden.
-- - Zeigt sie auf eine fremde Variante, wird sie abgewiesen. Der Marker ist
--   der vereinbarte Weg in den Klartext (`fehlerMeldung()` in
--   web/lib/training-bedingungen.ts) — Muster `teg_guard`.
--
-- `security definer`: Die Zuordnung ist eine Invariante der Datenebene und
-- darf nicht daran scheitern, dass `tv_select` dem Schreibenden die Variante
-- nicht zeigt.
create function te_variante_ausrichten() returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_training uuid;
begin
  if not einordnung_traegt_gruppen(new.trainingsteil) then
    new.variante_id := null;
    return new;
  end if;

  if new.variante_id is null then
    select v.id into new.variante_id
      from training_varianten v
     where v.training_id = new.training_id
     order by v.position, v.id
     limit 1;
    -- Kein Rückfall: Ein Training ohne Variante kann es nicht geben
    -- (`trainings_erste_variante`). Bliebe die Spalte leer, fängt der CHECK.
    return new;
  end if;

  select v.training_id into v_training
    from training_varianten v where v.id = new.variante_id;
  if v_training is distinct from new.training_id then
    raise exception 'VARIANTE_FREMDES_TRAINING: Variante % gehoert nicht zu Training %',
      new.variante_id, new.training_id;
  end if;

  return new;
end;
$$;

create trigger te_variante_ausrichten
  before insert or update on training_exercises
  for each row execute function te_variante_ausrichten();

-- ----------------------------------------------------------------------------
-- 6a) Eine Variante anlegen — als Kopie der angezeigten
-- ----------------------------------------------------------------------------
-- «Eine neue Variante entsteht als Kopie der gerade angezeigten» (Epic EK 4).
-- Variante, Fassungskopien und Gruppen-Zuweisungen entstehen in EINER
-- Transaktion, aus zwei Gründen: Eine halb gefüllte Variante wäre für den
-- Trainer eine Zumutung, und am öffentlichen Training würde der (ab #204 je
-- Variante prüfende) Gate eine leere Variante zu Recht abweisen.
--
-- Die QUELLMENGE kommt aus SQL, nie aus dem Aufrufer: `p_fassungen` ist allein
-- das Mapping alt->neu. Was kopiert wird, entscheidet
-- `where te.variante_id = p_quelle`. Ein Aufrufer, der Zeilen weglässt oder
-- fremde hinzufügt, bekommt `VARIANTE_KOPIE_UNVOLLSTAENDIG` statt einer
-- lückenhaften Variante.
--
-- Warum überhaupt ein Mapping? Bildkopie und Diagramm-Kopie sind Sache der
-- Anwendung: Storage erreicht SQL nicht, und frische Element-IDs im Diagramm
-- sind TypeScript-Logik (`kopiereDiagrammVon`). Die App erzeugt darum die IDs
-- vorab, kopiert Bild und Diagramm und reicht beides hier herein.
--
-- KEINE Feldliste: `to_jsonb(te)` nimmt jede Spalte mit, die
-- `training_exercises` hat — auch eine künftige. Nur die vier Felder, die sich
-- unterscheiden müssen, werden überschrieben. Die Tabelle trägt keine
-- generierten Spalten und kein `created_at`/`updated_at`, darum ist der
-- Rundweg über jsonb verlustfrei.
create function lege_variante_an(
  p_training uuid,
  p_quelle uuid,
  p_name text,
  p_name_quelle text,
  p_fassungen jsonb
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_erlaubt boolean;
  v_neu uuid;
  v_quellzahl int;
  v_mapping jsonb := coalesce(p_fassungen, '[]'::jsonb);
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Berechtigung als erste Anweisung, dieselbe Bedingung wie in den Policies.
  -- `for update` serialisiert zwei gleichzeitige Anlagen: sie würden sonst
  -- dieselbe `max(position) + 1` lesen und eine von beiden am Index
  -- `tv_position_je_training` scheitern.
  select true into v_erlaubt
    from trainings t
   where t.id = p_training
     and (t.owner_id = v_uid or ist_team_mitglied(t.team_id))
     for update;
  if not coalesce(v_erlaubt, false) then
    raise exception 'training not found or not editable by caller';
  end if;

  if not exists (select 1 from training_varianten v
                  where v.id = p_quelle and v.training_id = p_training) then
    raise exception 'VARIANTE_FREMDES_TRAINING: Variante % gehoert nicht zu Training %',
      p_quelle, p_training;
  end if;

  -- Zuerst umbenennen, dann anlegen: Beim Anlegen der ZWEITEN Variante
  -- benennt der Trainer den bisherigen Hauptteil mit (#201 AK 2), und die neue
  -- Bezeichnung darf die bisherige der Quelle sein, ohne am Unique-Index
  -- anzustossen.
  if p_name_quelle is not null then
    update training_varianten set name = btrim(p_name_quelle) where id = p_quelle;
  end if;

  insert into training_varianten (training_id, name, position)
  select p_training, btrim(p_name),
         coalesce(max(v.position), -1) + 1
    from training_varianten v
   where v.training_id = p_training
  returning id into v_neu;

  -- Die Quellmenge und das Mapping müssen sich exakt decken. Sonst entstünde
  -- eine Variante, der Übungen fehlen — und sie sähe vollständig aus.
  select count(*) into v_quellzahl
    from training_exercises te where te.variante_id = p_quelle;
  if v_quellzahl <> jsonb_array_length(v_mapping) then
    raise exception 'VARIANTE_KOPIE_UNVOLLSTAENDIG: % Fassungen in der Quelle, % im Mapping',
      v_quellzahl, jsonb_array_length(v_mapping);
  end if;
  if exists (
    select 1 from training_exercises te
     where te.variante_id = p_quelle
       and not exists (select 1
                         from jsonb_to_recordset(v_mapping) as m(quelle_id uuid)
                        where m.quelle_id = te.id)
  ) then
    raise exception 'VARIANTE_KOPIE_UNVOLLSTAENDIG: eine Quellfassung hat kein Mapping';
  end if;

  with m as (
    select * from jsonb_to_recordset(v_mapping)
      as x(quelle_id uuid, neue_id uuid, bild_url text, diagramm jsonb)
  )
  insert into training_exercises
  select (jsonb_populate_record(
            null::training_exercises,
            to_jsonb(te) || jsonb_build_object(
              'id', m.neue_id,
              'variante_id', v_neu,
              'bild_url', m.bild_url,
              'diagramm', m.diagramm))).*
    from training_exercises te
    join m on m.quelle_id = te.id
   where te.variante_id = p_quelle;

  -- Die Gruppenverteilung reist mit, samt Wechselposition (#201 PC 1): Die
  -- Gruppen selbst stehen am Training und gelten für alle Varianten.
  with m as (
    select * from jsonb_to_recordset(v_mapping) as x(quelle_id uuid, neue_id uuid)
  )
  insert into training_exercise_gruppen (training_exercise_id, gruppe_id, position)
  select m.neue_id, z.gruppe_id, z.position
    from training_exercise_gruppen z
    join m on m.quelle_id = z.training_exercise_id;

  return v_neu;
end;
$$;

revoke all on function lege_variante_an(uuid, uuid, text, text, jsonb) from public, anon;
grant execute on function lege_variante_an(uuid, uuid, text, text, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- 6b) Eine Variante entfernen
-- ----------------------------------------------------------------------------
-- Der Constraint-Trigger `tv_letzte_bleibt` fängt den Fall ohnehin — aber erst
-- beim Commit, und dann hat die Anwendung ihre Bilddateien womöglich schon
-- entfernt. Diese RPC weist ihn VOR dem Löschen ab und serialisiert dabei zwei
-- gleichzeitige Entfernungen über `for update` am Training: ohne sie sähen
-- beide noch zwei Varianten und beide löschten.
--
-- Liefert die `training_id` zurück — die Anwendung braucht sie fürs
-- Revalidieren und hat sie sonst nicht.
create function entferne_variante(p_variante uuid) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_training uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select t.id into v_training
    from training_varianten v
    join trainings t on t.id = v.training_id
   where v.id = p_variante
     and (t.owner_id = v_uid or ist_team_mitglied(t.team_id))
     for update of t;
  if v_training is null then
    raise exception 'variante not found or not editable by caller';
  end if;

  if (select count(*) from training_varianten v where v.training_id = v_training) <= 1 then
    raise exception 'LETZTE_VARIANTE: Training % haette keinen Hauptteil mehr', v_training;
  end if;

  delete from training_varianten where id = p_variante;
  return v_training;
end;
$$;

revoke all on function entferne_variante(uuid) from public, anon;
grant execute on function entferne_variante(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 6c) Eine Variante umsortieren
-- ----------------------------------------------------------------------------
-- Tausch mit dem Nachbarn über den Zwischenwert -1, weil
-- `tv_position_je_training` eindeutig ist — dasselbe Vorgehen wie
-- `move_training_exercise`. Am Rand kein Nachbar, also nichts zu tun.
create function verschiebe_variante(p_variante uuid, p_dir int) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_training uuid;
  v_pos int;
  v_other uuid;
  v_other_pos int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select v.training_id, v.position into v_training, v_pos
    from training_varianten v
    join trainings t on t.id = v.training_id
   where v.id = p_variante
     and (t.owner_id = v_uid or ist_team_mitglied(t.team_id))
     for update of t;
  if v_training is null then
    raise exception 'variante not found or not editable by caller';
  end if;

  if p_dir < 0 then
    select id, position into v_other, v_other_pos
      from training_varianten
     where training_id = v_training and position < v_pos
     order by position desc limit 1;
  else
    select id, position into v_other, v_other_pos
      from training_varianten
     where training_id = v_training and position > v_pos
     order by position asc limit 1;
  end if;

  if v_other is null then
    return;
  end if;

  update training_varianten set position = -1 where id = p_variante;
  update training_varianten set position = v_pos where id = v_other;
  update training_varianten set position = v_other_pos where id = p_variante;
end;
$$;

revoke all on function verschiebe_variante(uuid, int) from public, anon;
grant execute on function verschiebe_variante(uuid, int) to authenticated;

-- ----------------------------------------------------------------------------
-- 6d) Umsortieren einer Fassung bleibt in ihrer Variante
-- ----------------------------------------------------------------------------
-- Der Nachbar muss zusätzlich zur selben Variante gehören, sonst tauschte eine
-- Übung ihre Position mit einer, die gar nicht angezeigt wird (#201 AK 8).
-- `is not distinct from`, weil ausserhalb des Hauptteils beide Seiten null
-- sind.
--
-- BUGFIX bei der Gelegenheit: Die Berechtigung verlangte
-- `t.visibility = 'private'`. Diese Bedingung stammt aus der Zeit, als eine
-- veröffentlichte Vorlage eine eingefrorene Kopie war; seit «Veröffentlichen
-- ist ein Zustand» (Story A) sperrt sie den Eigentümer aus seinem eigenen
-- öffentlichen Training aus — umsortieren ging dort nicht mehr. Die Bedingung
-- lautet jetzt wie überall sonst: eigenes Training oder eines des eigenen
-- Teams.
create or replace function move_training_exercise(p_training_exercise_id uuid, p_dir int)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_training uuid;
  v_teil text;
  v_hkat text;
  v_variante uuid;
  v_pos int;
  v_other uuid;
  v_other_pos int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select te.training_id, te.trainingsteil, te.hauptteilkategorie, te.variante_id, te.position
    into v_training, v_teil, v_hkat, v_variante, v_pos
  from training_exercises te
  join trainings t on t.id = te.training_id
  where te.id = p_training_exercise_id
    and (t.owner_id = v_uid or ist_team_mitglied(t.team_id));
  if v_training is null then
    raise exception 'training exercise not found or not editable by caller';
  end if;

  if p_dir < 0 then
    select id, position into v_other, v_other_pos
    from training_exercises
    where training_id = v_training and trainingsteil = v_teil
      and hauptteilkategorie is not distinct from v_hkat
      and variante_id is not distinct from v_variante
      and position < v_pos
    order by position desc limit 1;
  else
    select id, position into v_other, v_other_pos
    from training_exercises
    where training_id = v_training and trainingsteil = v_teil
      and hauptteilkategorie is not distinct from v_hkat
      and variante_id is not distinct from v_variante
      and position > v_pos
    order by position asc limit 1;
  end if;

  -- Am Rand: kein Nachbar -> nichts zu tun.
  if v_other is null then
    return;
  end if;

  update training_exercises set position = -1 where id = p_training_exercise_id;
  update training_exercises set position = v_pos where id = v_other;
  update training_exercises set position = v_other_pos where id = p_training_exercise_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7) Selbstprüfung
-- ----------------------------------------------------------------------------
-- Geprüft wird, was die Anwendung nicht selbst sicherstellen kann: die vier
-- Policies, die beiden Eindeutigkeiten, die drei neuen Positions-Indizes, der
-- validierte CHECK und die beiden Invarianten, die der Backfill hergestellt
-- hat. Läuft eine davon ins Leere, merkt es sonst erst der Trainer.
do $$
declare
  v_policies int;
  v_indizes int;
  v_ohne_variante int;
  v_ohne_hauptteil int;
  v_validiert boolean;
begin
  select count(*) into v_policies
    from pg_policies
   where schemaname = 'public' and tablename = 'training_varianten';
  if v_policies <> 4 then
    raise exception 'training_varianten hat % Policies, erwartet 4', v_policies;
  end if;

  select count(*) into v_indizes
    from pg_class i
    join pg_index x on x.indexrelid = i.oid
   where i.relname in ('tv_name_je_training', 'tv_position_je_training')
     and x.indrelid = 'training_varianten'::regclass
     and x.indisunique;
  if v_indizes <> 2 then
    raise exception 'training_varianten: erwartet 2 eindeutige Indizes, gefunden %', v_indizes;
  end if;

  select count(*) into v_indizes
    from pg_class i
    join pg_index x on x.indexrelid = i.oid
   where i.relname in ('training_ex_pos_hauptteil', 'training_ex_pos_jun_hauptteil',
                       'training_ex_pos_nonhauptteil')
     and x.indrelid = 'training_exercises'::regclass
     and x.indisunique;
  if v_indizes <> 3 then
    raise exception 'training_exercises: erwartet 3 Positions-Indizes, gefunden %', v_indizes;
  end if;

  select convalidated into v_validiert
    from pg_constraint where conname = 'te_variante_genau_bei_hauptteil';
  if not coalesce(v_validiert, false) then
    raise exception 'te_variante_genau_bei_hauptteil fehlt oder ist nicht validiert';
  end if;

  select count(*) into v_ohne_variante
    from trainings t
   where not exists (select 1 from training_varianten v where v.training_id = t.id);
  if v_ohne_variante > 0 then
    raise exception '% Trainings ohne Variante nach dem Backfill', v_ohne_variante;
  end if;

  select count(*) into v_ohne_hauptteil
    from training_exercises
   where einordnung_traegt_gruppen(trainingsteil) and variante_id is null;
  if v_ohne_hauptteil > 0 then
    raise exception '% Hauptteil-Fassungen ohne Variante nach dem Backfill', v_ohne_hauptteil;
  end if;
end;
$$;

reset lock_timeout;
