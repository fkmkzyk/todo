create extension if not exists pgcrypto;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  text text not null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.tasks
add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.tasks
add column if not exists created_at timestamptz not null default now();

delete from public.tasks
where user_id is null;

alter table public.tasks
alter column user_id set not null;

alter table public.tasks enable row level security;

drop policy if exists "users can read own tasks" on public.tasks;
create policy "users can read own tasks"
on public.tasks
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "users can insert own tasks" on public.tasks;
create policy "users can insert own tasks"
on public.tasks
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "users can update own tasks" on public.tasks;
create policy "users can update own tasks"
on public.tasks
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users can delete own tasks" on public.tasks;
create policy "users can delete own tasks"
on public.tasks
for delete
to authenticated
using (auth.uid() = user_id);
