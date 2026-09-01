set lock_timeout = '5s';

-- ============================================================================
-- Story #134: Index auf der Erscheinungsform der Bibliotheks-Übung
-- ============================================================================
-- Der Übungs-Picker eines Trainingsblocks zeigt seit dieser Story nicht mehr
-- nur die dort eingeordneten Übungen, sondern zusätzlich alle, die eine
-- Erscheinungsform tragen, die dieser Block anzieht: «Explosiv und dynamisch
-- agieren» füllt die Explosivität, «Den Körper stabil halten» das Aufwärmen
-- (`BLOCK_ERSCHEINUNGSFORM` in web/lib/junioren.ts).
--
-- Technisch wird daraus EINE Abfrage mit einer ODER-Klausel über
-- `trainingsteil` und `erscheinungsform` — eine Abfrage, damit die Sortierung
-- in der DB-Collation und die Eindeutigkeit jedes Treffers ohne Zutun der
-- Applikation gelten. `trainingsteil` deckt `exercises_filter_idx`
-- (trainingsteil, visibility) ab; für `erscheinungsform` gab es bisher gar
-- keinen Index, und die Spalte ist ein `text[]`, auf das mit dem
-- Überlappungs-Operator `&&` gesucht wird. Genau dafür ist GIN da: B-Tree
-- kennt `&&` nicht und der Planer fiele auf einen Seq Scan zurück. Die
-- Vorschlagsliste muss unter einer Sekunde antworten, auch während laufender
-- Sucheingabe (NFR 2) — mit Debounce feuert eine Eingabe mehrere solcher
-- Abfragen kurz hintereinander.
--
-- Bewusst OHNE `concurrently`: Die Supabase-CLI fährt jede Migration in einer
-- Transaktion, und `create index concurrently` ist darin nicht erlaubt. Die
-- Tabelle ist klein (Manual-Bestand plus Trainer-Übungen, Grössenordnung
-- Hunderte), der Index-Build damit im Millisekundenbereich und die
-- Schreibsperre entsprechend kurz. `lock_timeout` oben bricht lieber ab, als
-- hinter einer langen Transaktion zu warten.
--
-- `if not exists`, damit ein erneuter Lauf gegen eine Datenbank, die den Index
-- schon trägt, nicht scheitert.
--
-- KEIN Gegenstück an `training_exercises`: Die Fassungen eines Trainings
-- tragen die Erscheinungsform zwar auch, aber es wird nie über sie gesucht —
-- Fassungen werden ausschliesslich über `training_id` gelesen. Ein Index dort
-- kostete Schreiblast ohne einen einzigen Leser.

create index if not exists exercises_erscheinungsform_idx
  on exercises using gin (erscheinungsform);

comment on index exercises_erscheinungsform_idx is
  'Vorschlagsquelle des Übungs-Pickers (Story #134): Überlappungssuche auf der Erscheinungsform.';

-- ----------------------------------------------------------------------------
-- Selbstprüfung
-- ----------------------------------------------------------------------------
-- Der Index muss existieren UND ein GIN-Index sein: Ein versehentlich als
-- B-Tree angelegter Index trüge denselben Namen, würde von `if not exists`
-- stehengelassen und beantwortete `&&` nie.
do $$
declare
  v_methode text;
begin
  select am.amname into v_methode
    from pg_class i
    join pg_index x on x.indexrelid = i.oid
    join pg_am am on am.oid = i.relam
   where i.relname = 'exercises_erscheinungsform_idx'
     and x.indrelid = 'exercises'::regclass;
  if v_methode is null then
    raise exception 'exercises_erscheinungsform_idx fehlt';
  end if;
  if v_methode <> 'gin' then
    raise exception 'exercises_erscheinungsform_idx ist ein %-Index, erwartet gin', v_methode;
  end if;
end;
$$;

reset lock_timeout;
