-- Nur mit Konto: Nachzug (Story #669, Epic #668; Review-Befunde).
--
-- 20261123100000_nur_mit_konto.sql schliesst die Tabellen für Besucher:innen
-- ohne Konto. Zwei Lesewege blieben offen:
--
-- 1. Bilder: Die Lese-Policy des Buckets `exercise-images` galt `to public`.
--    Damit konnte anon alle Objektnamen samt Konto- und Team-Ordnern
--    auflisten. Jetzt nur noch mit Konto. Der Bucket bleibt öffentlich: Die
--    App zeigt Bilder über ihre öffentliche URL (auch am privaten Link und in
--    den Beispielen der Startseite); eine Datei ist darum bei bekanntem Pfad
--    weiter abrufbar, aufzählen lässt sie sich ohne Konto nicht mehr.
--
-- 2. Funktionen, die anon nur wegen des öffentlichen Lesens ausführen durfte:
--    `anzeige_name` (ausdrücklich an anon «wegen urheber»), `urheber` und die
--    beiden Bedingungsprüfungen von Trainings. Sie bleiben für `authenticated`
--    (und `service_role`). Wer sie in SECURITY-DEFINER-Funktionen für den
--    privaten Link braucht, ruft sie als Eigentümer und ist nicht betroffen.
--
-- Forward-only: keine Datenänderung.

set lock_timeout = '5s';

drop policy exercise_images_public_read on storage.objects;
create policy exercise_images_public_read on storage.objects
  for select to authenticated
  using (bucket_id = 'exercise-images');

revoke execute on function anzeige_name(uuid) from public, anon;
revoke execute on function urheber(trainings) from public, anon;
revoke execute on function training_fehlende_bedingungen(uuid) from public, anon;
revoke execute on function training_pruefe_oeffentlich(uuid) from public, anon;
grant execute on function anzeige_name(uuid) to authenticated;
grant execute on function urheber(trainings) to authenticated;
grant execute on function training_fehlende_bedingungen(uuid) to authenticated;
grant execute on function training_pruefe_oeffentlich(uuid) to authenticated;

reset lock_timeout;
