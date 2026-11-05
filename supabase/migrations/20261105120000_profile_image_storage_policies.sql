drop policy if exists "CMS users can upload website images" on storage.objects;
create policy "CMS users can upload website images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'site-images'
  and public.is_site_editor()
  and (
    (storage.foldername(name))[1] <> 'profiles'
    or (storage.foldername(name))[2] = (select auth.uid())::text
  )
);

drop policy if exists "CMS users can update website images" on storage.objects;
create policy "CMS users can update website images"
on storage.objects for update to authenticated
using (
  bucket_id = 'site-images'
  and public.is_site_editor()
  and (
    (storage.foldername(name))[1] <> 'profiles'
    or public.is_site_admin()
    or (storage.foldername(name))[2] = (select auth.uid())::text
  )
)
with check (
  bucket_id = 'site-images'
  and public.is_site_editor()
  and (
    (storage.foldername(name))[1] <> 'profiles'
    or public.is_site_admin()
    or (storage.foldername(name))[2] = (select auth.uid())::text
  )
);

drop policy if exists "CMS users can delete website images" on storage.objects;
create policy "CMS users can delete website images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'site-images'
  and public.is_site_editor()
  and (
    (storage.foldername(name))[1] <> 'profiles'
    or public.is_site_admin()
    or (storage.foldername(name))[2] = (select auth.uid())::text
  )
);
