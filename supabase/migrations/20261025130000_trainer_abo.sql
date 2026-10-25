-- Das Kalender-Abo der Trainer:innen (#522).
--
-- Das Abo eines Mitglieds liefert nur noch die Termine, zu denen es
-- eingeladen ist (AK 1, PC 1, 3), mit seinem Stand (dabei, abgesagt,
-- verantwortlich), den Namen der Eingeladenen und der Mindestbesetzung
-- (AK 2–5). Abgesagte bleiben im Abo.
--
-- LAST-MODIFIED (PC 2): Einladen, Ausladen, Absagen und Verantwortung ändern
-- den Termin selbst nicht. Statt seine Zeile anzufassen — das liefe durch
-- dessen Trigger (Spielerzahl-Regel, Zeitstempel) —, hält eine eigene
-- Tabelle fest, wann sich an seinen Trainer:innen zuletzt etwas geändert hat.
-- Die Mindestbesetzung steht am Termin und bewegt dessen updated_at.

set lock_timeout = '5s';

create table termin_trainer_stand (
  termin_id uuid primary key references training_termine(id) on delete cascade,
  geaendert_am timestamptz not null default now()
);
-- Nur die DEFINER-Funktionen lesen und schreiben sie.
alter table termin_trainer_stand enable row level security;
revoke all on termin_trainer_stand from anon, authenticated;

create function termin_trainer_stand_beruehren() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_termin uuid := coalesce(new.termin_id, old.termin_id);
begin
  -- Wird der Termin selbst gelöscht, gibt es nichts mehr zu melden.
  if exists (select 1 from training_termine where id = v_termin) then
    insert into termin_trainer_stand (termin_id, geaendert_am) values (v_termin, now())
    on conflict (termin_id) do update set geaendert_am = now();
  end if;
  return null;
end;
$$;
revoke all on function termin_trainer_stand_beruehren() from public, anon, authenticated;

create trigger termin_trainer_stand after insert or update or delete on termin_trainer
  for each row execute function termin_trainer_stand_beruehren();

-- Rumpf wie in spiele_art; neu: nur eigene Einladungen, Stand, Namen und
-- Mindestbesetzung. Die Namen nennt erst die Anwendung im Eintrag (AK 4).
create or replace function kalender_abo_termine(p_token text) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  a kalender_abos;
  v_team teams;
begin
  select * into a from kalender_abos k
   where k.token = p_token;
  if not found then return jsonb_build_object('gueltig', false); end if;
  select * into v_team from teams where id = a.team_id;
  return jsonb_build_object(
    'gueltig', true,
    'team', jsonb_build_object('id', v_team.id, 'name', v_team.name),
    'termine', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'datum', t.datum,
               'beginn', to_char(t.beginn, 'HH24:MI'), 'ende', to_char(t.ende, 'HH24:MI'),
               'ort', t.ort,
               'geaendert', greatest(t.updated_at, s.geaendert_am),
               'art', t.art, 'bezeichnung', t.bezeichnung,
               'stand', case when ich.verantwortlich then 'verantwortlich'
                             when ich.abgesagt_am is not null then 'abgesagt' else 'dabei' end,
               'trainer', (select coalesce(jsonb_agg(jsonb_build_object(
                                     'name', trainer_name(x), 'ich', x.user_id = a.user_id,
                                     'verantwortlich', x.verantwortlich, 'abgesagt', x.abgesagt_am is not null)
                                   order by trainer_name(x) nulls last), '[]'::jsonb)
                             from termin_trainer x where x.termin_id = t.id),
               'besetzung_art', t.besetzung_art, 'besetzung_zahl', t.besetzung_zahl,
               'erwartete_spielerzahl', t.erwartete_spielerzahl, 'spielstand', spielstand(t))
             order by t.datum, t.beginn nulls last)
        from training_termine t
        join termin_trainer ich on ich.termin_id = t.id and ich.user_id = a.user_id
        left join termin_trainer_stand s on s.termin_id = t.id
       where t.team_id = a.team_id and not t.ausgefallen
         and t.datum >= heute_am_trainingsort() - 28), '[]'::jsonb));
end;
$$;
revoke all on function kalender_abo_termine(text) from public;
grant execute on function kalender_abo_termine(text) to anon, authenticated;

reset lock_timeout;
