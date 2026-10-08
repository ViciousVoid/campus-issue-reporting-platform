create policy "issue_media_delete_own_upload"
on public.issue_media
for delete
to authenticated
using (
  uploaded_by = (select auth.uid())
  and private.can_access_issue(issue_id)
);
