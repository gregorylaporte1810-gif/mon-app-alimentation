-- À exécuter dans Supabase > SQL Editor pour activer la synchronisation.
create table if not exists public.wellness_sync (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.wellness_sync enable row level security;

create policy "Users can read their wellness data"
on public.wellness_sync for select
using (auth.uid() = user_id);

create policy "Users can insert their wellness data"
on public.wellness_sync for insert
with check (auth.uid() = user_id);

create policy "Users can update their wellness data"
on public.wellness_sync for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
