-- One Beacon connection for the Nexus workspace. Keys are encrypted by the server.
create table if not exists public.beacon_connection (
  id boolean primary key default true check (id),
  endpoint text not null,
  encrypted_key text not null,
  allowed_user_ids uuid[] not null default '{}',
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.beacon_connection enable row level security;
revoke all on public.beacon_connection from anon, authenticated;
grant select, insert, update on public.beacon_connection to authenticated;
grant all on public.beacon_connection to service_role;
drop policy if exists "Beacon viewers read encrypted connection" on public.beacon_connection;
create policy "Beacon viewers read encrypted connection" on public.beacon_connection
for select to authenticated using (
  public.has_role(auth.uid(), 'admin') or auth.uid() = any(allowed_user_ids)
);
drop policy if exists "Admins create Beacon connection" on public.beacon_connection;
create policy "Admins create Beacon connection" on public.beacon_connection
for insert to authenticated with check (
  public.has_role(auth.uid(), 'admin') and updated_by = auth.uid()
);
drop policy if exists "Admins update Beacon connection" on public.beacon_connection;
create policy "Admins update Beacon connection" on public.beacon_connection
for update to authenticated using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin') and updated_by = auth.uid());

notify pgrst, 'reload schema';
