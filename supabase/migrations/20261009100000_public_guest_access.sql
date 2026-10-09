-- Public read access is limited to approved reports on public campuses.
-- Guest chat is text-only and uses a per-session display name; authenticated chat remains supported.
alter table public.campus_chat_messages
  alter column user_id drop not null;

alter table public.campus_chat_messages
  add column if not exists guest_name text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'campus_chat_guest_name_length'
      and conrelid = 'public.campus_chat_messages'::regclass
  ) then
    alter table public.campus_chat_messages
      add constraint campus_chat_guest_name_length
      check (guest_name is null or char_length(guest_name) between 1 and 40);
  end if;
end $$;

drop policy if exists "public_read_approved_campus_issues" on public.issues;
create policy "public_read_approved_campus_issues"
on public.issues for select to anon, authenticated
using (
  moderation_status = 'approved'
  and exists (
    select 1 from public.campuses c
    where c.id = issues.campus_id and c.is_public = true
  )
);

drop policy if exists "public_read_categories_for_public_campuses" on public.categories;
create policy "public_read_categories_for_public_campuses"
on public.categories for select to anon, authenticated
using (exists (select 1 from public.campuses c where c.id = categories.campus_id and c.is_public = true));

drop policy if exists "public_read_locations_for_public_campuses" on public.locations;
create policy "public_read_locations_for_public_campuses"
on public.locations for select to anon, authenticated
using (exists (select 1 from public.campuses c where c.id = locations.campus_id and c.is_public = true));

drop policy if exists "public_read_departments_for_public_campuses" on public.departments;
create policy "public_read_departments_for_public_campuses"
on public.departments for select to anon, authenticated
using (exists (select 1 from public.campuses c where c.id = departments.campus_id and c.is_public = true));

drop policy if exists "public_read_media_for_approved_public_issues" on public.issue_media;
create policy "public_read_media_for_approved_public_issues"
on public.issue_media for select to anon, authenticated
using (
  exists (
    select 1 from public.issues i
    join public.campuses c on c.id = i.campus_id
    where i.id = issue_media.issue_id
      and i.moderation_status = 'approved'
      and c.is_public = true
  )
);

drop policy if exists "public_read_comments_for_approved_public_issues" on public.comments;
create policy "public_read_comments_for_approved_public_issues"
on public.comments for select to anon, authenticated
using (
  exists (
    select 1 from public.issues i
    join public.campuses c on c.id = i.campus_id
    where i.id = comments.issue_id
      and i.moderation_status = 'approved'
      and c.is_public = true
  )
);

drop policy if exists "public_read_chat_for_public_campuses" on public.campus_chat_messages;
create policy "public_read_chat_for_public_campuses"
on public.campus_chat_messages for select to anon, authenticated
using (exists (select 1 from public.campuses c where c.id = campus_chat_messages.campus_id and c.is_public = true));

drop policy if exists "guest_insert_text_chat_for_public_campuses" on public.campus_chat_messages;
create policy "guest_insert_text_chat_for_public_campuses"
on public.campus_chat_messages for insert to anon, authenticated
with check (
  user_id is null
  and guest_name is not null
  and char_length(trim(guest_name)) between 1 and 40
  and char_length(trim(body)) between 1 and 1000
  and image_path is null
  and exists (select 1 from public.campuses c where c.id = campus_chat_messages.campus_id and c.is_public = true)
);
