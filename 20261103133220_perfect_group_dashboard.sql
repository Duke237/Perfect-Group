create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('admin', 'editor')),
  full_name text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.user_profiles add column if not exists full_name text not null default '';
alter table public.user_profiles add column if not exists is_active boolean not null default true;

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('homepage', 'about', 'services', 'products', 'projects', 'testimonials', 'partners', 'news', 'legal', 'team')),
  title text not null check (char_length(title) between 1 and 180),
  slug text not null unique check (char_length(slug) between 1 and 180),
  summary text not null default '' check (char_length(summary) <= 800),
  body text not null default '' check (char_length(body) <= 5000),
  image_url text not null default '',
  seo_title text not null default '',
  seo_description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.content_items drop constraint if exists content_items_kind_check;
alter table public.content_items add constraint content_items_kind_check
check (kind in ('homepage', 'about', 'services', 'products', 'projects', 'testimonials', 'partners', 'news', 'legal', 'team'));
alter table public.content_items add column if not exists seo_title text not null default '';
alter table public.content_items add column if not exists seo_description text not null default '';

create unique index if not exists content_items_single_homepage
on public.content_items (kind)
where kind = 'homepage';

create table if not exists public.contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 254),
  phone text check (phone is null or char_length(phone) <= 40),
  subject text check (subject is null or char_length(subject) <= 180),
  service text check (service is null or char_length(service) <= 180),
  message text not null check (char_length(message) between 10 and 4000),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.contact_inquiries add column if not exists service text;

create table if not exists public.site_settings (
  id text primary key check (id = 'global'),
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('contact_inquiry', 'chat_message', 'system')),
  title text not null check (char_length(title) between 1 and 180),
  body text not null default '' check (char_length(body) <= 1000),
  href text not null default '/admin' check (left(href, 1) = '/'),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists admin_notifications_user_created_idx
on public.admin_notifications (user_id, created_at desc);
create index if not exists admin_notifications_user_unread_idx
on public.admin_notifications (user_id, created_at desc)
where not is_read;

create table if not exists public.admin_activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('insert', 'update', 'delete')),
  entity_type text not null,
  entity_id text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_activity_logs_created_idx
on public.admin_activity_logs (created_at desc);
create index if not exists admin_activity_logs_actor_created_idx
on public.admin_activity_logs (actor_user_id, created_at desc);

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
  where profiles.is_active and profiles.role in ('admin', 'editor');
  return new;
end;
$$;

drop trigger if exists contact_inquiries_notify_admins on public.contact_inquiries;
create trigger contact_inquiries_notify_admins
after insert on public.contact_inquiries
for each row execute function public.notify_admins_of_inquiry();

create or replace function public.log_content_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_row jsonb;
begin
  changed_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  insert into public.admin_activity_logs (actor_user_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    lower(tg_op),
    'content_items',
    changed_row ->> 'id',
    jsonb_strip_nulls(jsonb_build_object(
      'kind', changed_row ->> 'kind',
      'title', changed_row ->> 'title',
      'status', changed_row ->> 'status'
    ))
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists content_items_log_activity on public.content_items;
create trigger content_items_log_activity
after insert or update or delete on public.content_items
for each row execute function public.log_content_activity();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'content_items'
    ) then
      alter publication supabase_realtime add table public.content_items;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'site_settings'
    ) then
      alter publication supabase_realtime add table public.site_settings;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'admin_notifications'
    ) then
      alter publication supabase_realtime add table public.admin_notifications;
    end if;
  end if;
end;
$$;

create or replace function public.is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_profiles
    where user_id = (select auth.uid()) and role = 'admin' and is_active
  );
$$;

create or replace function public.is_site_editor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_profiles
    where user_id = (select auth.uid()) and role in ('admin', 'editor') and is_active
  );
$$;

create or replace function public.bootstrap_first_site_admin(target_user_id uuid, target_full_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_user_id is null or char_length(btrim(target_full_name)) not between 1 and 120 then
    raise exception 'A valid administrator name is required.';
  end if;
  perform pg_advisory_xact_lock(hashtext('bootstrap_first_site_admin'));
  if exists (select 1 from public.user_profiles where role = 'admin' and is_active) then
    raise exception 'An active administrator is already configured.';
  end if;
  insert into public.user_profiles (user_id, role, full_name, is_active)
  values (target_user_id, 'admin', btrim(target_full_name), true)
  on conflict (user_id) do update
    set role = 'admin', full_name = excluded.full_name, is_active = true;
end;
$$;

create table if not exists public.website_page_views (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null,
  path text not null check (char_length(path) between 1 and 500 and left(path, 1) = '/'),
  created_at timestamptz not null default now()
);

create index if not exists website_page_views_created_at_idx on public.website_page_views (created_at desc);
create index if not exists website_page_views_path_created_at_idx on public.website_page_views (path, created_at desc);

create or replace function public.get_website_analytics(from_date timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  report jsonb;
begin
  if not public.is_site_editor() then
    raise exception 'Active CMS access is required.';
  end if;
  if from_date is null then
    raise exception 'A reporting start date is required.';
  end if;
  select jsonb_build_object(
    'total_views', (select count(*)::integer from public.website_page_views where created_at >= from_date),
    'unique_visitors', (select count(distinct visitor_id)::integer from public.website_page_views where created_at >= from_date),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('date', visit_day, 'count', views) order by visit_day)
      from (
        select timezone('UTC', created_at)::date as visit_day, count(*)::integer as views
        from public.website_page_views
        where created_at >= from_date
        group by timezone('UTC', created_at)::date
      ) as daily_views
    ), '[]'::jsonb),
    'top_pages', coalesce((
      select jsonb_agg(jsonb_build_object('path', path, 'count', views) order by views desc, path)
      from (
        select path, count(*)::integer as views
        from public.website_page_views
        where created_at >= from_date
        group by path
        order by count(*) desc, path
        limit 8
      ) as page_views
    ), '[]'::jsonb)
  ) into report;
  return report;
end;
$$;

create table if not exists public.admin_chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_one uuid not null references auth.users(id) on delete cascade,
  user_two uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_one, user_two),
  check (user_one < user_two)
);

create table if not exists public.admin_chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.admin_chat_threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists admin_chat_messages_thread_created_idx on public.admin_chat_messages (thread_id, created_at);

create or replace function public.notify_admin_chat_recipient()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.admin_notifications (user_id, kind, title, body, href)
  select case when threads.user_one = new.sender_id then threads.user_two else threads.user_one end,
         'chat_message', 'New admin chat message', 'You have a new message.', '/admin'
  from public.admin_chat_threads as threads
  where threads.id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists admin_chat_messages_notify_recipient on public.admin_chat_messages;
create trigger admin_chat_messages_notify_recipient
after insert on public.admin_chat_messages
for each row execute function public.notify_admin_chat_recipient();

create table if not exists public.admin_chat_thread_reads (
  thread_id uuid not null references public.admin_chat_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create or replace function public.get_admin_chat_overview(search_text text default '')
returns table (
  user_id uuid,
  full_name text,
  role text,
  email text,
  thread_id uuid,
  last_message text,
  last_message_at timestamptz,
  unread_count bigint
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
      coalesce(unread.count, 0)
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

create or replace function public.mark_admin_chat_thread_read(chat_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null or not public.is_site_editor() or not exists (
    select 1 from public.admin_chat_threads as threads
    where threads.id = chat_thread_id
      and (threads.user_one = current_user_id or threads.user_two = current_user_id)
  ) then
    raise exception 'You cannot mark this conversation as read.';
  end if;
  insert into public.admin_chat_thread_reads (thread_id, user_id, last_read_at)
  values (chat_thread_id, current_user_id, now())
  on conflict (thread_id, user_id) do update set last_read_at = excluded.last_read_at;
end;
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'admin_chat_messages'
    ) then
    alter publication supabase_realtime add table public.admin_chat_messages;
  end if;
end;
$$;

create or replace function public.list_active_admin_profiles()
returns table (user_id uuid, full_name text, role text, is_active boolean, email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_site_editor() then
    raise exception 'Active CMS access is required.';
  end if;
  return query
    select profiles.user_id, profiles.full_name, profiles.role, profiles.is_active, users.email::text
    from public.user_profiles as profiles
    join auth.users as users on users.id = profiles.user_id
    where profiles.is_active
    order by profiles.full_name, users.email;
end;
$$;

create or replace function public.get_or_create_admin_chat_thread(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  first_user_id uuid;
  second_user_id uuid;
  thread_id uuid;
begin
  if current_user_id is null or other_user_id is null or current_user_id = other_user_id then
    raise exception 'Choose another active CMS user.';
  end if;
  if not public.is_site_editor() or not exists (
    select 1 from public.user_profiles where user_id = other_user_id and is_active and role in ('admin', 'editor')
  ) then
    raise exception 'Both participants must have active CMS access.';
  end if;
  first_user_id := least(current_user_id, other_user_id);
  second_user_id := greatest(current_user_id, other_user_id);
  insert into public.admin_chat_threads (user_one, user_two)
  values (first_user_id, second_user_id)
  on conflict (user_one, user_two) do nothing;
  select id into thread_id from public.admin_chat_threads
  where user_one = first_user_id and user_two = second_user_id;
  return thread_id;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists content_items_set_updated_at on public.content_items;
create trigger content_items_set_updated_at
before update on public.content_items
for each row execute function public.set_updated_at();

alter table public.user_profiles enable row level security;
alter table public.content_items enable row level security;
alter table public.contact_inquiries enable row level security;
alter table public.site_settings enable row level security;
alter table public.website_page_views enable row level security;
alter table public.admin_chat_threads enable row level security;
alter table public.admin_chat_messages enable row level security;
alter table public.admin_chat_thread_reads enable row level security;
alter table public.admin_notifications enable row level security;
alter table public.admin_activity_logs enable row level security;

drop policy if exists "Users can read their own profile" on public.user_profiles;
create policy "Users can read their own profile"
on public.user_profiles for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Published content is public" on public.content_items;
create policy "Published content is public"
on public.content_items for select to anon, authenticated
using (status = 'published');

drop policy if exists "Admins can read all content" on public.content_items;
create policy "CMS users can read all content"
on public.content_items for select to authenticated
using (public.is_site_editor());

drop policy if exists "Admins can insert content" on public.content_items;
create policy "CMS users can insert content"
on public.content_items for insert to authenticated
with check (public.is_site_editor());

drop policy if exists "Admins can update content" on public.content_items;
create policy "CMS users can update content"
on public.content_items for update to authenticated
using (public.is_site_editor())
with check (public.is_site_editor());

drop policy if exists "Admins can delete content" on public.content_items;
create policy "CMS users can delete content"
on public.content_items for delete to authenticated
using (public.is_site_editor());

drop policy if exists "Anyone can submit a contact enquiry" on public.contact_inquiries;
create policy "Anyone can submit a contact enquiry"
on public.contact_inquiries for insert to anon, authenticated
with check (is_read = false);

drop policy if exists "Admins can read enquiries" on public.contact_inquiries;
create policy "CMS users can read enquiries"
on public.contact_inquiries for select to authenticated
using (public.is_site_editor());

drop policy if exists "Admins can update enquiries" on public.contact_inquiries;
create policy "CMS users can update enquiries"
on public.contact_inquiries for update to authenticated
using (public.is_site_editor())
with check (public.is_site_editor());

drop policy if exists "Admins can delete enquiries" on public.contact_inquiries;
create policy "CMS users can delete enquiries"
on public.contact_inquiries for delete to authenticated
using (public.is_site_editor());

drop policy if exists "Site settings are public" on public.site_settings;
create policy "Site settings are public"
on public.site_settings for select to anon, authenticated
using (true);

drop policy if exists "Admins can update site settings" on public.site_settings;
create policy "Admins can update site settings"
on public.site_settings for all to authenticated
using (public.is_site_admin())
with check (public.is_site_admin());

drop policy if exists "Anyone can record a page view" on public.website_page_views;
create policy "Anyone can record a page view"
on public.website_page_views for insert to anon, authenticated
with check (char_length(path) between 1 and 500 and left(path, 1) = '/');

drop policy if exists "CMS users can read page views" on public.website_page_views;
create policy "CMS users can read page views"
on public.website_page_views for select to authenticated
using (public.is_site_editor());

drop policy if exists "CMS users can read their chat threads" on public.admin_chat_threads;
create policy "CMS users can read their chat threads"
on public.admin_chat_threads for select to authenticated
using (public.is_site_editor() and (user_one = (select auth.uid()) or user_two = (select auth.uid())));

drop policy if exists "Participants can read chat messages" on public.admin_chat_messages;
create policy "Participants can read chat messages"
on public.admin_chat_messages for select to authenticated
using (
  public.is_site_editor()
  and exists (
    select 1 from public.admin_chat_threads as threads
    where threads.id = thread_id
      and ((threads.user_one = (select auth.uid())) or (threads.user_two = (select auth.uid())))
  )
);

drop policy if exists "Participants can send chat messages" on public.admin_chat_messages;
create policy "Participants can send chat messages"
on public.admin_chat_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and public.is_site_editor()
  and exists (
    select 1 from public.admin_chat_threads as threads
    where threads.id = thread_id
      and ((threads.user_one = (select auth.uid())) or (threads.user_two = (select auth.uid())))
  )
);

drop policy if exists "Users can read their chat read state" on public.admin_chat_thread_reads;
create policy "Users can read their chat read state"
on public.admin_chat_thread_reads for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users can update their chat read state" on public.admin_chat_thread_reads;
create policy "Users can update their chat read state"
on public.admin_chat_thread_reads for all to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.admin_chat_threads as threads
    where threads.id = thread_id
      and (threads.user_one = (select auth.uid()) or threads.user_two = (select auth.uid()))
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.admin_chat_threads as threads
    where threads.id = thread_id
      and (threads.user_one = (select auth.uid()) or threads.user_two = (select auth.uid()))
  )
);

drop policy if exists "Users can read their notifications" on public.admin_notifications;
create policy "Users can read their notifications"
on public.admin_notifications for select to authenticated
using (user_id = (select auth.uid()) and public.is_site_editor());

drop policy if exists "Users can mark their notifications read" on public.admin_notifications;
create policy "Users can mark their notifications read"
on public.admin_notifications for update to authenticated
using (user_id = (select auth.uid()) and public.is_site_editor())
with check (user_id = (select auth.uid()) and public.is_site_editor());

drop policy if exists "Admins can read activity logs" on public.admin_activity_logs;
create policy "Admins can read activity logs"
on public.admin_activity_logs for select to authenticated
using (public.is_site_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-images', 'site-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do nothing;

drop policy if exists "Website images are public" on storage.objects;
create policy "Website images are public"
on storage.objects for select to anon, authenticated
using (bucket_id = 'site-images');

drop policy if exists "Admins can upload website images" on storage.objects;
create policy "CMS users can upload website images"
on storage.objects for insert to authenticated
with check (bucket_id = 'site-images' and public.is_site_editor());

drop policy if exists "Admins can update website images" on storage.objects;
create policy "CMS users can update website images"
on storage.objects for update to authenticated
using (bucket_id = 'site-images' and public.is_site_editor())
with check (bucket_id = 'site-images' and public.is_site_editor());

drop policy if exists "Admins can delete website images" on storage.objects;
create policy "CMS users can delete website images"
on storage.objects for delete to authenticated
using (bucket_id = 'site-images' and public.is_site_editor());

grant select on public.content_items to anon, authenticated;
grant insert, update, delete on public.content_items to authenticated;
grant select on public.user_profiles to authenticated;
grant all on public.user_profiles to service_role;
grant insert on public.contact_inquiries to anon, authenticated;
grant select, update, delete on public.contact_inquiries to authenticated;
grant select on public.site_settings to anon, authenticated;
grant insert, update on public.site_settings to authenticated;
revoke all on function public.is_site_admin() from public, anon;
revoke all on function public.is_site_editor() from public, anon;
revoke all on function public.list_active_admin_profiles() from public, anon;
revoke all on function public.get_or_create_admin_chat_thread(uuid) from public, anon;
revoke all on function public.get_website_analytics(timestamptz) from public, anon;
revoke all on function public.get_admin_chat_overview(text) from public, anon;
revoke all on function public.mark_admin_chat_thread_read(uuid) from public, anon;
revoke all on function public.bootstrap_first_site_admin(uuid, text) from public, anon, authenticated;
grant execute on function public.is_site_admin() to authenticated;
grant execute on function public.is_site_editor() to authenticated;
grant execute on function public.list_active_admin_profiles() to authenticated;
grant execute on function public.get_or_create_admin_chat_thread(uuid) to authenticated;
grant execute on function public.get_website_analytics(timestamptz) to authenticated;
grant execute on function public.get_admin_chat_overview(text) to authenticated;
grant execute on function public.mark_admin_chat_thread_read(uuid) to authenticated;
grant execute on function public.bootstrap_first_site_admin(uuid, text) to service_role;
revoke all on function public.notify_admins_of_inquiry() from public, anon, authenticated;
revoke all on function public.notify_admin_chat_recipient() from public, anon, authenticated;
revoke all on function public.log_content_activity() from public, anon, authenticated;
grant insert on public.website_page_views to anon, authenticated;
grant select on public.website_page_views to authenticated;
grant select on public.admin_chat_threads to authenticated;
grant select, insert on public.admin_chat_messages to authenticated;
grant select, insert, update on public.admin_chat_thread_reads to authenticated;
grant select on public.admin_notifications to authenticated;
grant update (is_read) on public.admin_notifications to authenticated;
grant select on public.admin_activity_logs to authenticated;
grant all on public.admin_notifications to service_role;
grant all on public.admin_activity_logs to service_role;

insert into public.site_settings (id, settings) values ('global', '{}'::jsonb)
on conflict (id) do nothing;

insert into public.content_items (kind, title, slug, summary, body, image_url, metadata, status) values
('homepage', 'A better way to build, connect and grow.', 'home', 'Technology, infrastructure and creative solutions for businesses.', 'We bring the right people, technology and expertise together to help ambitious businesses move forward.', 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1800&q=85', '{"eyebrow":"Technology. Infrastructure. Creativity.","cta":"Explore our services","image_alt":"Modern office workspace"}', 'published'),
('about', 'Built around what comes next.', 'about', 'Again is a multi-service company connecting business challenges to practical solutions.', 'Again brings together technology, infrastructure and creative services to support the needs of businesses.', 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1200&q=85', '{"image_alt":"Colleagues working together"}', 'published')
on conflict (slug) do nothing;
