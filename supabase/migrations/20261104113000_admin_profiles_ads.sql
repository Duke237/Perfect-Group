alter table public.user_profiles
  add column if not exists phone text not null default '',
  add column if not exists avatar_url text not null default '',
  add column if not exists notification_preferences jsonb not null default '{"contact_inquiry":true,"chat_message":true,"system":true}'::jsonb,
  add column if not exists preferences jsonb not null default '{"compact_mode":false}'::jsonb;

drop policy if exists "Users can update their own profile" on public.user_profiles;
create policy "Users can update their own profile"
on public.user_profiles for update to authenticated
using (user_id = (select auth.uid()) and public.is_site_editor())
with check (user_id = (select auth.uid()) and public.is_site_editor());

grant update (full_name, phone, avatar_url, notification_preferences, preferences)
on public.user_profiles to authenticated;

create table if not exists public.advertisements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 180),
  description text not null default '' check (char_length(description) <= 2000),
  image_url text not null default '',
  destination_url text not null check (destination_url ~ '^https?://'),
  placement text not null check (placement in ('site_top', 'homepage_banner', 'homepage_featured', 'site_footer')),
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'published', 'scheduled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at is null or ends_at is null or ends_at > starts_at),
  check (status <> 'scheduled' or starts_at is not null)
);

create index if not exists advertisements_placement_status_idx
on public.advertisements (placement, status, starts_at, ends_at);

drop trigger if exists advertisements_set_updated_at on public.advertisements;
create trigger advertisements_set_updated_at
before update on public.advertisements
for each row execute function public.set_updated_at();

alter table public.advertisements enable row level security;

drop policy if exists "Published advertisements are public" on public.advertisements;
create policy "Published advertisements are public"
on public.advertisements for select to anon, authenticated
using (
  status in ('published', 'scheduled')
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at > now())
);

drop policy if exists "Admins manage advertisements" on public.advertisements;
create policy "Admins manage advertisements"
on public.advertisements for all to authenticated
using (public.is_site_admin())
with check (public.is_site_admin());

grant select on public.advertisements to anon, authenticated;
grant insert, update, delete on public.advertisements to authenticated;

drop function if exists public.get_admin_chat_overview(text);
create function public.get_admin_chat_overview(search_text text default '')
returns table (
  user_id uuid,
  full_name text,
  role text,
  email text,
  thread_id uuid,
  last_message text,
  last_message_at timestamptz,
  unread_count bigint,
  avatar_url text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null or not public.is_site_editor() then
    raise exception 'Active CMS access is required.';
  end if;
  return query
    select
      profiles.user_id,
      profiles.full_name,
      profiles.role,
      users.email::text,
      threads.id,
      latest.body,
      latest.created_at,
      coalesce(unread.count, 0),
      profiles.avatar_url
    from public.user_profiles as profiles
    join auth.users as users on users.id = profiles.user_id
    left join public.admin_chat_threads as threads
      on (threads.user_one = current_user_id and threads.user_two = profiles.user_id)
      or (threads.user_two = current_user_id and threads.user_one = profiles.user_id)
    left join public.admin_chat_thread_reads as reads
      on reads.thread_id = threads.id and reads.user_id = current_user_id
    left join lateral (
      select messages.body, messages.created_at
      from public.admin_chat_messages as messages
      where messages.thread_id = threads.id
      order by messages.created_at desc
      limit 1
    ) as latest on true
    left join lateral (
      select count(*) as count
      from public.admin_chat_messages as messages
      where messages.thread_id = threads.id
        and messages.sender_id <> current_user_id
        and messages.created_at > coalesce(reads.last_read_at, '-infinity'::timestamptz)
    ) as unread on true
    where profiles.is_active
      and profiles.role in ('admin', 'editor')
      and profiles.user_id <> current_user_id
      and (coalesce(search_text, '') = ''
        or profiles.full_name ilike '%' || search_text || '%'
        or users.email ilike '%' || search_text || '%')
    order by (threads.id is not null) desc, latest.created_at desc nulls last, profiles.full_name, users.email;
end;
$$;

revoke all on function public.get_admin_chat_overview(text) from public, anon;
grant execute on function public.get_admin_chat_overview(text) to authenticated;

create or replace function public.notify_admins_of_inquiry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.admin_notifications (user_id, kind, title, body, href)
  select profiles.user_id, 'contact_inquiry', 'New website enquiry',
         'A new enquiry is waiting for review.', '/admin'
  from public.user_profiles as profiles
  where profiles.is_active and profiles.role in ('admin', 'editor')
    and coalesce(profiles.notification_preferences ->> 'contact_inquiry', 'true') <> 'false';
  return new;
end;
$$;

create or replace function public.notify_admin_chat_recipient()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.admin_notifications (user_id, kind, title, body, href)
  select profiles.user_id, 'chat_message', 'New admin chat message', 'You have a new message.', '/admin'
  from public.user_profiles as profiles
  join public.admin_chat_threads as threads
    on profiles.user_id = case when threads.user_one = new.sender_id then threads.user_two else threads.user_one end
  where threads.id = new.thread_id and profiles.is_active
    and coalesce(profiles.notification_preferences ->> 'chat_message', 'true') <> 'false';
  return new;
end;
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'advertisements'
    ) then
    alter publication supabase_realtime add table public.advertisements;
  end if;
end;
$$;
