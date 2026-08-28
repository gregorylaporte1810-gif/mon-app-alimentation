-- À exécuter dans Supabase > SQL Editor pour activer la synchronisation.
create table if not exists public.wellness_sync (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.wellness_sync enable row level security;

-- Le script peut être relancé sans erreur : les politiques sont recréées
-- avec la définition attendue à chaque exécution.
drop policy if exists "Users can read their wellness data" on public.wellness_sync;
drop policy if exists "Users can insert their wellness data" on public.wellness_sync;
drop policy if exists "Users can update their wellness data" on public.wellness_sync;
drop policy if exists "Users can delete their wellness data" on public.wellness_sync;

create policy "Users can read their wellness data"
on public.wellness_sync for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their wellness data"
on public.wellness_sync for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their wellness data"
on public.wellness_sync for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their wellness data"
on public.wellness_sync for delete
to authenticated
using (auth.uid() = user_id);

-- Défense en profondeur : aucun accès direct n'est accordé aux visiteurs
-- anonymes ni au rôle PostgreSQL PUBLIC.
revoke all on table public.wellness_sync from anon;
revoke all on table public.wellness_sync from public;

-- Permissions minimales requises pour les utilisateurs connectés.
grant usage on schema public to authenticated;
grant select, insert, update, delete
on table public.wellness_sync
to authenticated;
