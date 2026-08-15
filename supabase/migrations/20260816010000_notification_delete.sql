-- A notification is the recipient's to discard (Rayan, 2026-08-16). Delete
-- was deliberately absent from the original grants; the bell now offers an ×
-- per row, so the verb exists — still strictly scoped to the owner's rows.
grant delete on public.notifications to authenticated;

create policy "users delete own notifications"
  on public.notifications for delete to authenticated
  using (user_id = auth.uid());
