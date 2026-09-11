set lock_timeout = '5s';

-- ============================================================================
-- Story #209 (Epic #200): Gruppen ordnen, letzte Variante auflösen
-- ============================================================================
-- Die Story bringt Varianten und Gruppen an den Chip: Wer eine Gruppe an einer
-- Übung verwaltet, soll sie dort auch umsortieren können. Dafür fehlt den
-- Gruppen bisher das Entscheidende — eine vom Trainer gesetzte Reihenfolge.
-- `20260908090000_training_gruppen.sql` sagt dazu ausdrücklich: «Die
-- Anzeigereihenfolge ist die Anlegereihenfolge (`created_at, id`) — es gibt
-- keine vom Trainer gesetzte Ordnung der Gruppen.» Das gilt ab dieser
-- Migration nicht mehr; der Satz dort bleibt als historischer Stand stehen
-- (forward-only), berichtigt wird er hier und am Spaltenkommentar.
--
-- ABGRENZUNG, die sich leicht verwechseln lässt: `training_gruppen.position`
-- ist die ANZEIGEREIHENFOLGE der Gruppen eines Trainings.
-- `training_exercise_gruppen.position` ist etwas völlig anderes — der WECHSEL,
-- also das Zeitfenster, in dem eine Gruppe an einer Übung steht (Story #150).
-- Die beiden berühren sich nirgends: Die Gruppenordnung ändert nie einen
-- Wechsel, und ein Wechsel sagt nichts darüber, wie die Gruppen aufgelistet
-- werden.
--
-- Zweiter Teil: die AUFLÖSUNG der letzten Variante. Varianten ergeben erst ab
-- zwei einen Sinn — die Oberfläche zeigt eine einzelne nie (#201 PC 5, Epic
-- EK 7). Wer die vorletzte entfernt, soll darum nicht mit einem Hauptteil
-- zurückbleiben, der einen Namen trägt, den er nie wieder zu Gesicht bekommt.
-- `entferne_variante` gibt der verbleibenden Variante deshalb den Vorgabenamen
-- und die Position 0 zurück — atomar, unter demselben `for update`.
--
-- Reihenfolge in dieser Datei ist zwingend:
--   1) Spalte (nullable)   — noch ohne Invariante, damit der Backfill
--                            überhaupt Zeilen schreiben kann
--   2) Trigger             — VOR dem Backfill: Eine Gruppe, die während des
--                            Deploys entsteht, bekäme sonst keine Position,
--                            und das `set not null` unten fiele über sie
--   3) Backfill            — die bisherige Anzeigereihenfolge wird festgeschrieben
--   4) `set not null`      — inline, weil der Backfill in derselben Datei steht
--   5) Unique-Index        — die Ordnung ist ab jetzt eindeutig
--   6) `verschiebe_gruppe` — die RPC, die sie ändert
--   7) Vorgabename         — eine Quelle für «Variante 1» statt zweier Literale
--   8) `entferne_variante` — die Auflösung, die diesen Namen braucht

-- ----------------------------------------------------------------------------
-- 1) Die Spalte
-- ----------------------------------------------------------------------------
-- Nullbasiert wie `training_varianten.position` und `training_exercises.position`.
alter table training_gruppen add column position int;

comment on column training_gruppen.position is
  'Anzeigereihenfolge der Gruppen eines Trainings, vom Trainer gesetzt (#209). Zwilling: die Sortierung in mapTraining() in web/lib/queries/trainings.ts. NICHT zu verwechseln mit training_exercise_gruppen.position — das ist der Wechsel, also das Zeitfenster an einer Übung.';

-- ----------------------------------------------------------------------------
-- 2) Die Position vergibt die Datenbank
-- ----------------------------------------------------------------------------
-- Eine neue Gruppe stellt sich hinten an. Die Regel steht hier statt in der
-- Server Action, weil es mehrere Anlege-Pfade gibt (Editor, Kopie eines
-- Trainings, künftig der KI-Zugang) — je mehr Pfade, desto sicherer vergisst
-- einer die Position.
--
-- Eine MITGEGEBENE Position bleibt stehen: `kopiereTraining()`
-- (web/lib/training-kopie.ts) schreibt die Ordnung der Quelle mit, und sie ist
-- dort das Ergebnis und nicht der Zufall der Einfügereihenfolge.
--
-- `perform 1 from trainings … for update` serialisiert zwei gleichzeitige
-- Anlagen: Sie läsen sonst dasselbe `max(position) + 1` und eine von beiden
-- scheiterte am Unique-Index. Das Aggregat selbst verträgt kein `for update`
-- («FOR UPDATE is not allowed with aggregate functions»), darum hängt die
-- Sperre am Training — dasselbe Vorgehen wie in `lege_variante_an`.
--
-- `security definer`, damit die Vergabe nicht an einer Nutzer-Policy hängt:
-- Wer eine Gruppe anlegen darf, bekommt ihre Position, ohne dass `tg_select`
-- ein zweites Mal über die Sichtbarkeit der Nachbarzeilen entscheidet (Muster
-- `te_altersstufe_erben`).
create function tg_position_setzen() returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.position is not null then
    return new;
  end if;

  perform 1 from trainings where id = new.training_id for update;

  new.position := coalesce(
    (select max(position) from training_gruppen where training_id = new.training_id),
    -1) + 1;
  return new;
end;
$$;

create trigger tg_position_setzen
  before insert on training_gruppen
  for each row execute function tg_position_setzen();

-- ----------------------------------------------------------------------------
-- 3) Backfill: die bisherige Anzeigereihenfolge wird zur gesetzten
-- ----------------------------------------------------------------------------
-- Bis hierher war die Reihenfolge `created_at, id` — genau diese wird
-- festgeschrieben. Für den Trainer ändert sich damit im Moment des Deploys
-- nichts; erst sein nächster Klick auf «nach oben» tut es.
--
-- Nicht bloss `where position is null`, sondern alle Zeilen der betroffenen
-- TRAININGS: Der Trigger aus Abschnitt 2 steht bereits. Eine während des
-- Deploys angelegte Gruppe hat ihre Position also schon — und zwar die 0, weil
-- die Bestandszeilen ihres Trainings noch keine tragen. Nur die Null-Zeilen zu
-- nummerieren liefe damit in eine Kollision. Über das ganze Training gerechnet
-- bekommt die neue Gruppe stattdessen den letzten Platz, was ohnehin stimmt:
-- Sie ist die jüngste.
--
-- `tg_touch` ist währenddessen still: Er schriebe jedem betroffenen Training
-- das Deploy-Datum als «zuletzt geändert», und die Übersicht behauptete eine
-- Änderung, die niemand vorgenommen hat (Muster: `altersstufe_spalten`,
-- `hauptteil_varianten`).
alter table training_gruppen disable trigger tg_touch;

update training_gruppen g
   set position = n.pos
  from (
    select id,
           row_number() over (partition by training_id order by created_at, id) - 1 as pos
      from training_gruppen
     where training_id in (select training_id from training_gruppen where position is null)
  ) n
 where n.id = g.id
   and g.position is distinct from n.pos;

alter table training_gruppen enable trigger tg_touch;

-- ----------------------------------------------------------------------------
-- 4) Die Invariante
-- ----------------------------------------------------------------------------
-- Inline validiert und nicht `not valid`: Der Backfill steht in derselben Datei
-- davor, der Bestand ist damit vollständig gefüllt, und der Trigger deckt jede
-- neue Zeile ab. Ein späteres `validate` wäre eine zweite Migration ohne Nutzen.
alter table training_gruppen alter column position set not null;

-- ----------------------------------------------------------------------------
-- 5) Die Ordnung ist eindeutig
-- ----------------------------------------------------------------------------
-- Zwei Gruppen auf derselben Position wären keine Reihenfolge mehr.
--
-- BEWUSST OHNE `check (position >= 0)`: `verschiebe_gruppe` tauscht zwei
-- Positionen über den Zwischenwert -1, weil dieser Index eindeutig ist
-- (dasselbe Vorgehen wie `verschiebe_variante` und `move_training_exercise`).
-- Ein Wertebereichs-CHECK stünde diesem Zwischenschritt im Weg, und die
-- Position ist eine interne Ordnungszahl, die nie jemand liest.
create unique index tg_position_je_training on training_gruppen (training_id, position);

comment on index tg_position_je_training is
  'Spiegel der Gruppen-Sortierung in mapTraining() (web/lib/queries/trainings.ts) und der Vertauschung in verschiebe_gruppe().';

-- ----------------------------------------------------------------------------
-- 6) Eine Gruppe umsortieren
-- ----------------------------------------------------------------------------
-- Wortgleich zu `verschiebe_variante`: Tausch mit dem Nachbarn über den
-- Zwischenwert -1, am Rand kein Nachbar und also nichts zu tun.
--
-- `p_dir` kennt genau zwei Werte: -1 nach vorne, 1 nach hinten. Weder die Null
-- noch `null` ist eine Richtung — beide stillschweigend als «nach hinten» zu
-- lesen (die Abfrage unten täte genau das, denn `null < 0` ist nicht wahr),
-- machte aus einem Programmierfehler eine Umsortierung, die niemand verlangt
-- hat. Darum fahren beide hier heraus, bevor irgendetwas getauscht wird.
create function verschiebe_gruppe(p_gruppe uuid, p_dir int) returns void
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

  if p_dir is null or p_dir = 0 then
    return;
  end if;

  -- Berechtigung als erste Anweisung, dieselbe Bedingung wie in den
  -- `tg_*`-Policies. `for update of t` serialisiert zwei gleichzeitige
  -- Verschiebungen am selben Training: Sie läsen sonst denselben Nachbarn.
  select g.training_id, g.position into v_training, v_pos
    from training_gruppen g
    join trainings t on t.id = g.training_id
   where g.id = p_gruppe
     and (t.owner_id = v_uid or ist_team_mitglied(t.team_id))
     for update of t;
  if v_training is null then
    raise exception 'gruppe not found or not editable by caller';
  end if;

  if p_dir < 0 then
    select id, position into v_other, v_other_pos
      from training_gruppen
     where training_id = v_training and position < v_pos
     order by position desc limit 1;
  else
    select id, position into v_other, v_other_pos
      from training_gruppen
     where training_id = v_training and position > v_pos
     order by position asc limit 1;
  end if;

  if v_other is null then
    return;
  end if;

  update training_gruppen set position = -1 where id = p_gruppe;
  update training_gruppen set position = v_pos where id = v_other;
  update training_gruppen set position = v_other_pos where id = p_gruppe;
end;
$$;

comment on function verschiebe_gruppe(uuid, int) is
  'Spiegel von verschoben() in web/lib/ordnung.ts; aufgerufen von verschiebeGruppe() in web/lib/actions/gruppen.ts.';

revoke all on function verschiebe_gruppe(uuid, int) from public, anon;
grant execute on function verschiebe_gruppe(uuid, int) to authenticated;

-- ----------------------------------------------------------------------------
-- 7) Der Vorgabename der Variante — eine Quelle
-- ----------------------------------------------------------------------------
-- «Variante 1» stand bisher als Literal an zwei Orten in SQL
-- (`trainings_erste_variante` und der Backfill von `hauptteil_varianten`) und
-- ab jetzt an einem dritten: der Auflösung unten. Drei Literale, die
-- auseinanderlaufen können, sind zwei zu viel — und die Auflösung ist genau
-- der Fall, in dem der Name wieder sichtbar wird, sobald der Trainer eine
-- zweite Variante anlegt.
--
-- `immutable`, weil es eine Konstante ist; `language sql`, damit der Planer sie
-- einsetzen kann.
create function variante_vorgabename() returns text
language sql
immutable
parallel safe
as $$ select 'Variante 1'::text $$;

comment on function variante_vorgabename() is
  'Spiegel von VARIANTE_VORGABENAME in web/lib/varianten.ts (Assertion in web/scripts/pruefe-varianten.ts). Der Name, den ein Training fuer seinen einzigen Hauptteil traegt — sichtbar wird er erst, wenn eine zweite Variante dazukommt.';

revoke all on function variante_vorgabename() from public, anon;
grant execute on function variante_vorgabename() to authenticated;

-- Die erste Variante eines neuen Trainings: identisch zur bisherigen Fassung
-- (20260911100000), nur der Name kommt jetzt aus der einen Quelle.
create or replace function trainings_erste_variante() returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into training_varianten (training_id, name, position)
  values (new.id, variante_vorgabename(), 0);
  return null;
end;
$$;

-- ----------------------------------------------------------------------------
-- 8) Die letzte Variante wird aufgelöst
-- ----------------------------------------------------------------------------
-- Identisch zur bisherigen Fassung (20260911100000) bis nach dem `delete`.
-- Neu danach: Bleibt genau EINE Variante übrig, bekommt sie den Vorgabenamen
-- und die Position 0 zurück.
--
-- Warum: Varianten ergeben erst ab zwei einen Sinn. Ein Training mit einer
-- einzigen verhält sich überall wie vor dem Epic (Epic EK 7) — die Oberfläche
-- zeigt die Bezeichnung gar nicht. Bliebe der Name der überlebenden Variante
-- stehen, trüge das Training still «21 Kinder» mit sich herum und der Trainer
-- bekäme das erst Wochen später zu sehen, wenn er wieder eine zweite anlegt.
-- Und die Position: Wer die vordere entfernt, liesse die hintere auf 1 stehen
-- — eine Ordnung mit einem Loch am Anfang.
--
-- Atomar unter demselben `for update` am Training, das schon die Zählung
-- geschützt hat: Zwischen `delete` und `update` kann keine dritte Variante
-- dazukommen und keine zweite Entfernung dazwischenfahren.
--
-- Keine Unique-Kollision: Es ist genau EINE Zeile — weder
-- `tv_name_je_training` noch `tv_position_je_training` hat etwas, womit sie
-- kollidieren könnte.
--
-- Unberührt bleiben die Regel LETZTE_VARIANTE und der Constraint-Trigger
-- `tv_letzte_bleibt`: Ein Training verliert seine letzte Variante nicht, es
-- verliert nur ihren Namen.
create or replace function entferne_variante(p_variante uuid) returns uuid
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

  -- Die Auflösung (#209): Was übrig bleibt, ist wieder schlicht «der
  -- Hauptteil».
  if (select count(*) from training_varianten v where v.training_id = v_training) = 1 then
    update training_varianten
       set name = variante_vorgabename(), position = 0
     where training_id = v_training;
  end if;

  return v_training;
end;
$$;

comment on function entferne_variante(uuid) is
  'Entfernt eine Variante des Hauptteils. Bleibt danach genau eine, wird sie aufgeloest: Vorgabename und Position 0 (#209). Zwilling: aufloesungSatz() in web/lib/varianten.ts.';

-- ----------------------------------------------------------------------------
-- 9) Selbstprüfung
-- ----------------------------------------------------------------------------
-- Geprüft wird, was die Anwendung nicht selbst sicherstellen kann: die
-- Eindeutigkeit der Ordnung, ihre Lückenlosigkeit nach dem Backfill, die beiden
-- neuen Funktionen und der Trigger, der jede neue Gruppe einreiht. Läuft eine
-- davon ins Leere, merkt es sonst erst der Trainer.
do $$
declare
  v_index int;
  v_nullable boolean;
  v_kaputt int;
  v_funktionen int;
  v_trigger int;
  v_vorgabe text;
begin
  select count(*) into v_index
    from pg_class i
    join pg_index x on x.indexrelid = i.oid
   where i.relname = 'tg_position_je_training'
     and x.indrelid = 'training_gruppen'::regclass
     and x.indisunique;
  if v_index <> 1 then
    raise exception 'tg_position_je_training fehlt oder ist nicht eindeutig';
  end if;

  select not attnotnull into v_nullable
    from pg_attribute
   where attrelid = 'training_gruppen'::regclass and attname = 'position';
  if coalesce(v_nullable, true) then
    raise exception 'training_gruppen.position fehlt oder ist nullable';
  end if;

  -- Lückenlos 0..n-1 je Training: Der Unique-Index allein liesse 0, 1, 7 zu,
  -- und ein Loch in der Ordnung fiele erst auf, wenn eine Verschiebung nicht
  -- mehr das tut, was der Trainer erwartet.
  select count(*) into v_kaputt
    from (
      select training_id
        from training_gruppen
       group by training_id
      having min(position) <> 0
          or max(position) <> count(*) - 1
          or count(distinct position) <> count(*)
    ) x;
  if v_kaputt > 0 then
    raise exception '% Trainings mit lueckenhafter Gruppenordnung nach dem Backfill', v_kaputt;
  end if;

  select count(*) into v_funktionen
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('verschiebe_gruppe', 'variante_vorgabename');
  if v_funktionen <> 2 then
    raise exception 'erwartet verschiebe_gruppe und variante_vorgabename, gefunden %', v_funktionen;
  end if;

  -- Der Vorgabename muss durch denselben CHECK passen wie jeder vom Trainer
  -- vergebene (`tv_name_laenge`), sonst schlüge die Auflösung genau dann fehl,
  -- wenn sie gebraucht wird.
  v_vorgabe := variante_vorgabename();
  if char_length(btrim(v_vorgabe)) not between 1 and 40 then
    raise exception 'variante_vorgabename() ist als Variantenname unzulaessig: %', v_vorgabe;
  end if;

  select count(*) into v_trigger
    from pg_trigger
   where not tgisinternal
     and tgrelid = 'training_gruppen'::regclass
     and tgname = 'tg_position_setzen';
  if v_trigger <> 1 then
    raise exception 'tg_position_setzen fehlt';
  end if;

  -- Beide Funktionen müssen die eine Quelle wirklich benutzen. Schriebe eine
  -- spätere Migration das Literal zurück, bliebe das Schema vollständig und die
  -- Auflösung liefe trotzdem auf einen zweiten Namen zu (Muster:
  -- `varianten_veroeffentlichung`).
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'trainings_erste_variante'
       and p.prosrc like '%variante_vorgabename()%') then
    raise exception 'trainings_erste_variante nutzt den Vorgabenamen nicht';
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'entferne_variante'
       and p.prosrc like '%variante_vorgabename()%') then
    raise exception 'entferne_variante loest die letzte Variante nicht auf';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 10) Selbstprüfung am Wegwerf-Szenario: die Positionsvergabe
-- ----------------------------------------------------------------------------
-- Der Katalog sagt nichts darüber, ob der Trigger die richtige Zahl vergibt.
-- Darum baut dieser Block das Szenario wirklich auf und räumt es wieder ab:
-- drei Gruppen ohne Angabe werden zu 0, 1, 2; eine mitgegebene Position bleibt
-- stehen (der Weg, den `kopiereTraining()` nimmt); die nächste ohne Angabe
-- reiht sich dahinter ein.
--
-- Ohne Nutzerkontext möglich, weil `owner_id` nullable ist und der Trigger
-- `security definer` läuft; die Policies umgeht der Migrations-Superuser
-- ohnehin.
--
-- Weggeräumt wird per ROLLBACK und nicht per `delete` (Muster
-- `varianten_veroeffentlichung`, Abschnitt 4): Das Szenario läuft in einer
-- Subtransaktion, die am Ende ABSICHTLICH mit einer eigenen Ausnahme verlassen
-- wird. Ein `delete from trainings` wäre auf Produktion ein Schreibvorgang in
-- eine Geschäftstabelle — er träfe zwar nur die eben angelegte Wegwerf-Zeile,
-- aber eine Migration, die überhaupt aus `trainings` löscht, ist die falsche
-- Vorlage für die nächste. Nach dem Rollback bleibt von der Prüfung keine
-- Spur, auch nicht in den Sequenzen der Kaskade.
--
-- Ein echter Befund kommt als gewöhnliche Ausnahme aus demselben Block und
-- wird nach dem Rollback WEITERGEREICHT — er soll die Migration abbrechen.
--
-- Die AUFLÖSUNG in `entferne_variante` lässt sich hier NICHT nachstellen: Die
-- RPC verlangt `auth.uid()` und ein Training, dessen `owner_id` auf eine echte
-- Zeile in `auth.users` zeigt. Einen Nutzer für eine Prüfung anzulegen und
-- wieder zu entfernen, wäre ein Eingriff in fremdes Schema — auf Produktion
-- genau das, was eine Migration nicht tun soll. Geprüft wird sie stattdessen
-- oben am Funktionsrumpf und in der Anwendung.
do $$
declare
  v_ausgang text;
  v_training uuid;
  v_positionen int[];
  v_fest int;
  v_danach int;
begin
  begin
    insert into trainings (name, altersstufe, stufen, visibility)
    values ('__pruefung_209__', 'kinderfussball', array['G'], 'private')
    returning id into v_training;

    insert into training_gruppen (training_id, name)
    values (v_training, 'A'), (v_training, 'B'), (v_training, 'C');

    select array_agg(position order by position) into v_positionen
      from training_gruppen where training_id = v_training;
    if v_positionen is distinct from array[0, 1, 2] then
      raise exception 'tg_position_setzen vergibt % statt 0,1,2', v_positionen;
    end if;

    insert into training_gruppen (training_id, name, position)
    values (v_training, 'D', 7);
    select position into v_fest
      from training_gruppen where training_id = v_training and name = 'D';
    if v_fest <> 7 then
      raise exception 'eine mitgegebene Position wurde ueberschrieben: %', v_fest;
    end if;

    insert into training_gruppen (training_id, name) values (v_training, 'E');
    select position into v_danach
      from training_gruppen where training_id = v_training and name = 'E';
    if v_danach <> 8 then
      raise exception 'die naechste Gruppe bekam % statt 8', v_danach;
    end if;

    -- Alles geprüft. Dieser Ausstieg rollt die Subtransaktion zurück und nimmt
    -- Training, Gruppen und die vom Trigger angelegte Variante mit.
    raise exception 'PRUEFUNG_209_BESTANDEN';
  exception when others then
    v_ausgang := sqlerrm;
  end;

  if v_ausgang <> 'PRUEFUNG_209_BESTANDEN' then
    raise exception '%', v_ausgang;
  end if;
end;
$$;

reset lock_timeout;
