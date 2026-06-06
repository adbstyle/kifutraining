-- Storage: Bucket für Feld-Diagramme + RLS für Nutzer-Uploads.
-- Manual-Bilder lädt der Seed via service_role (RLS-umgehend) nach manual/.
-- Nutzer dürfen ausschliesslich unter user/<eigene-uid>/ schreiben.

insert into storage.buckets (id, name, public)
values ('exercise-images', 'exercise-images', true)
on conflict (id) do nothing;

-- Öffentliches Lesen (Bucket ist public; Policy macht es explizit).
create policy "exercise_images_public_read" on storage.objects
  for select using (bucket_id = 'exercise-images');

-- Authentifizierte schreiben/ändern/löschen nur im eigenen user/<uid>/-Ordner.
create policy "exercise_images_user_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'exercise-images'
    and (storage.foldername(name))[1] = 'user'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "exercise_images_user_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'exercise-images'
    and (storage.foldername(name))[1] = 'user'
    and (storage.foldername(name))[2] = auth.uid()::text
  ) with check (
    bucket_id = 'exercise-images'
    and (storage.foldername(name))[1] = 'user'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "exercise_images_user_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'exercise-images'
    and (storage.foldername(name))[1] = 'user'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
