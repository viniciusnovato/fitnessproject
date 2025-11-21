-- Drop table if it exists (for development/testing)
drop table if exists public.meals_log cascade;

-- Create meals_log table
create table public.meals_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  calories integer,
  protein numeric,
  carbs numeric,
  fat numeric,
  image_url text,
  is_generated boolean default false,
  date timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.meals_log enable row level security;

-- Create policies
create policy "Users can view their own meals"
  on public.meals_log for select
  using (auth.uid() = user_id);

create policy "Users can insert their own meals"
  on public.meals_log for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own meals"
  on public.meals_log for update
  using (auth.uid() = user_id);

create policy "Users can delete their own meals"
  on public.meals_log for delete
  using (auth.uid() = user_id);

-- Create index for faster queries by date
create index meals_log_user_date_idx on public.meals_log (user_id, date desc);
