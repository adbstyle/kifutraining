-- Zuordnungs-Invarianten (Story 3 #579, Epic #575; Architekturplan Vereine
-- §3.3 b–d, §3.7, §5.4).
--
-- Kader, Abmeldungen und Spiel-Meldungen gibt es nur für Spieler:innen, die
-- dem Team zugeordnet sind (FK auf `team_spieler`, kaskadierend): Nimmt man
-- eine Spieler:in aus einem Team, verfallen ihre Meldungen und Kader dort von
-- selbst. Das denormalisierte `team_id` der Termin-Tabellen sichern FKs auf
-- `training_termine (id, team_id)`, das der Historie FKs auf
-- `termin_eingefroren (termin_id, team_id)`. Alle neuen FKs kommen `not valid`
-- (Prod hat Daten, AP §3.10); die Validierung folgt erst im letzten PR vor dem
-- Release (`_validieren`, Plan Phase A). Neue Zeilen prüfen sie trotzdem.
--
-- Die Trigger auf `team_spieler` sind ab hier vollständig: vor dem Zuordnen
-- die Prüfungen in der Reihenfolge SCHON_ZUGEORDNET → SPIELER_DOPPELT →
-- SPIELERLISTE_VOLL (AK 4–7), vor dem Herausnehmen das Festhalten
-- begonnener Termine, danach das Aufräumen künftiger Statuswechsel. Die RPCs
-- prüfen vorher selbst und antworten mit einem Status; die Trigger sind das
-- Netz.
--
-- `spieler.team_id` (Entscheid Story 3, A.1): Die Spalte bleibt bis Phase 7/8
-- als «erstes Team» gepflegt, weil Link, Abo, Schnuppern und Feedback sie bis
-- dahin lesen. Sie wird nullable, ihr FK `on delete set null` (sonst löschte
-- das Auflösen eines Teams seine Spieler:innen), `spieler_team_fest` fällt.
-- Gepflegt wird sie an genau einer Stelle, in `team_spieler_nachher`.
--
-- Sperrordnung (AP §4.1): Teams → `spieler`-Zeile → Termin-Zeile.

set lock_timeout = '5s';

-- ── Spalten und Constraints ─────────────────────────────────────────────────

-- spieler.team_id: «erstes Team» bis Phase 7/8 (A.1), fällt mit N1 (AP §3.8).
drop trigger spieler_team_fest on spieler;
drop function spieler_team_fest();
alter table spieler alter column team_id drop not null;
alter table spieler drop constraint spieler_team_id_fkey,
  add constraint spieler_team_id_fkey foreign key (team_id) references teams(id) on delete set null;

-- Zuordnungs-FKs: Kader und Meldungen nur für Zugeordnete.
alter table kader_spieler      add constraint ks_zuordnung foreign key (team_id, spieler_id)
  references team_spieler (team_id, spieler_id) on delete cascade not valid;
alter table termin_abmeldungen add constraint ta_zuordnung foreign key (team_id, spieler_id)
  references team_spieler (team_id, spieler_id) on delete cascade not valid;
alter table spiel_meldungen    add constraint sm_zuordnung foreign key (team_id, spieler_id)
  references team_spieler (team_id, spieler_id) on delete cascade not valid;

-- Termin-FKs: das denormalisierte team_id per Constraint gesichert.
alter table training_termine   add constraint tt_id_team_uk unique (id, team_id);
alter table termin_eingefroren add constraint te_termin_team_uk unique (termin_id, team_id);
alter table termin_abmeldungen   add constraint ta_termin_team  foreign key (termin_id, team_id)
  references training_termine (id, team_id) on delete cascade not valid;
alter table termin_statuswechsel add constraint tsw_termin_team foreign key (termin_id, team_id)
  references training_termine (id, team_id) on delete cascade not valid;
alter table spiel_meldungen      add constraint sm_termin_team  foreign key (termin_id, team_id)
  references training_termine (id, team_id) on delete cascade not valid;
alter table termin_eingefroren   add constraint te_termin_team  foreign key (termin_id, team_id)
  references training_termine (id, team_id) on delete cascade not valid;
alter table termin_kader         add constraint tk_termin_team  foreign key (termin_id, team_id)
  references training_termine (id, team_id) on delete cascade not valid;
alter table spiel_treffpunkte    add constraint stp_termin_team foreign key (termin_id, team_id)
  references training_termine (id, team_id) on delete cascade not valid;
-- Historie: team_id an den festgehaltenen Termin gebunden (bisher ohne FK).
-- Kein Zuordnungs-FK: Die Zeilen überleben das Herausnehmen mit Namen.
alter table termin_teilnahmen    add constraint tn_eingefroren_team foreign key (termin_id, team_id)
  references termin_eingefroren (termin_id, team_id) on delete cascade not valid;
alter table spiel_teilnahmen     add constraint st_eingefroren_team foreign key (termin_id, team_id)
  references termin_eingefroren (termin_id, team_id) on delete cascade not valid;

-- ── Funktionen ──────────────────────────────────────────────────────────────

-- Rumpf wie in 20261113110000_spieler_ueber_zuordnung.sql, vollständig
-- (AP §3.3 c). Kaskaden steigen aus: Ist das Team weg (Auflösen), geht alles
-- mit; ist die Spieler:in weg, hat spieler_vorher schon festgehalten.
-- Sonst Teamsperre, dann die `spieler`-Zeile, bei INSERT wie bei DELETE.
-- INSERT prüft in dieser Reihenfolge (AK 4–7): schon zugeordnet, gleicher
-- Schlüssel im Zielteam (nur noch bei Altdubletten möglich), Grenze 100 je
-- Team (jede Zuordnung zählt; Zwilling SPIELER_MAX in web/lib/spieler.ts).
-- Danach den Stand begonnener Termine festhalten: Wer neu dazukommt oder
-- geht, ändert ihn nicht (PC 5, PC 8).
create or replace function team_spieler_vorher() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  r team_spieler := case when tg_op = 'DELETE' then old else new end;
begin
  if not exists (select 1 from teams where id = r.team_id) then return r; end if;
  if tg_op = 'DELETE' and not exists (select 1 from spieler where id = r.spieler_id) then return r; end if;
  perform sperre_teams(array[r.team_id]);
  perform 1 from spieler where id = r.spieler_id for update;
  if tg_op = 'INSERT' then
    if exists (select 1 from team_spieler where team_id = new.team_id and spieler_id = new.spieler_id) then
      raise exception 'SCHON_ZUGEORDNET';
    end if;
    if exists (select 1 from team_spieler ts
                 join spieler a on a.id = ts.spieler_id
                 join spieler n on n.id = new.spieler_id
                where ts.team_id = new.team_id and a.id <> n.id
                  and spieler_text_schluessel(a.vorname) = spieler_text_schluessel(n.vorname)
                  and spieler_text_schluessel(a.nachname) = spieler_text_schluessel(n.nachname)
                  and a.jahrgang = n.jahrgang) then
      raise exception 'SPIELER_DOPPELT';
    end if;
    if (select count(*) from team_spieler where team_id = new.team_id) >= 100 then
      raise exception 'SPIELERLISTE_VOLL';
    end if;
  end if;
  perform termine_einfrieren(r.team_id);
  return r;
end;
$$;

-- Nach dem Zuordnen und Herausnehmen (AP §3.3 c). Herausnehmen (Team und
-- Spieler:in noch da): Statuswechsel künftiger Termine dieses Teams fallen,
-- an begonnenen bleiben sie. Kader, Abmeldungen und Spiel-Meldungen nimmt die
-- FK-Kaskade; der Kader-Verfall anderer Spieler:innen ändert sich nicht, weil
-- nur diese Spieler:in aus den Kadern fällt. Löscht nie die Spieler:in (PC 4).
-- Den Schnupper-Status nimmt die Zeile mit (AP §3.3 f).
--
-- spieler.team_id = älteste bestehende Zuordnung (created_at, team_id), sonst
-- null. Übergang bis Phase 7/8, fällt mit dem Contract N1 (Entscheid A.1):
-- Link, Abo, Schnuppern und Feedback lesen die Spalte bis dahin. Einzige
-- Stelle, die sie schreibt; auch beim Auflösen eines Teams (die Zuordnungen
-- dorthin sind dann schon weg).
create function team_spieler_nachher() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  r team_spieler := case when tg_op = 'DELETE' then old else new end;
  v_erstes uuid;
begin
  if not exists (select 1 from spieler where id = r.spieler_id) then return null; end if;
  if tg_op = 'DELETE' and exists (select 1 from teams where id = r.team_id) then
    delete from termin_statuswechsel w using training_termine t
     where w.termin_id = t.id and t.team_id = r.team_id and w.spieler_id = r.spieler_id
       and not termin_begonnen(t.datum, t.beginn);
  end if;
  select ts.team_id into v_erstes from team_spieler ts
   where ts.spieler_id = r.spieler_id order by ts.created_at, ts.team_id limit 1;
  update spieler set team_id = v_erstes where id = r.spieler_id and team_id is distinct from v_erstes;
  return null;
end;
$$;

-- ── Trigger ─────────────────────────────────────────────────────────────────

-- Neu auch bei DELETE (Herausnehmen, AP §3.3 c, §5.4).
drop trigger team_spieler_vorher on team_spieler;
create trigger team_spieler_vorher before insert or delete on team_spieler
  for each row execute function team_spieler_vorher();
create trigger team_spieler_nachher after insert or delete on team_spieler
  for each row execute function team_spieler_nachher();

-- ── Grants ──────────────────────────────────────────────────────────────────

revoke all on function team_spieler_vorher() from public, anon, authenticated;
revoke all on function team_spieler_nachher() from public, anon, authenticated;

reset lock_timeout;
