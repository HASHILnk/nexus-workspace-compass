-- Multiple independent Beacon project connections.
create table if not exists public.beacon_connections (
  id uuid primary key default gen_random_uuid(),
  project_name text not null,
  endpoint text not null unique,
  encrypted_key text not null,
  allowed_user_ids uuid[] not null default '{}',
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.beacon_connections enable row level security;
revoke all on public.beacon_connections from anon, authenticated;
grant select, insert, update on public.beacon_connections to authenticated;
grant all on public.beacon_connections to service_role;
drop policy if exists "Beacon viewers read encrypted connection" on public.beacon_connections;
create policy "Beacon viewers read encrypted connection" on public.beacon_connections
for select to authenticated using (
  public.has_role(auth.uid(), 'admin') or auth.uid() = any(allowed_user_ids)
);
drop policy if exists "Admins create Beacon connection" on public.beacon_connections;
create policy "Admins create Beacon connection" on public.beacon_connections
for insert to authenticated with check (
  public.has_role(auth.uid(), 'admin') and updated_by = auth.uid()
);
drop policy if exists "Admins update Beacon connection" on public.beacon_connections;
create policy "Admins update Beacon connection" on public.beacon_connections
for update to authenticated using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin') and updated_by = auth.uid());

-- Preserve the existing connection without exposing or re-encrypting its key.
do $$
begin
  if to_regclass('public.beacon_connection') is not null
     and not exists (select 1 from public.beacon_connections) then
    insert into public.beacon_connections (project_name, endpoint, encrypted_key, allowed_user_ids, updated_by, updated_at)
    select 'Existing Beacon project', endpoint, encrypted_key, allowed_user_ids, updated_by, updated_at
    from public.beacon_connection
    on conflict (endpoint) do nothing;
  end if;
end $$;
notify pgrst, 'reload schema';
