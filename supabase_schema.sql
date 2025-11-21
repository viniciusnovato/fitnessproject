-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROFILES
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  full_name text,
  height float,
  weight float,
  birth_date date,
  sex text,
  activity_level text,
  goal text,
  dietary_preferences jsonb,
  allergies jsonb,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- PANTRY ITEMS
create table public.pantry_items (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  quantity text,
  status text check (status in ('in_stock', 'running_low', 'out_of_stock')) default 'in_stock',
  created_at timestamptz default now()
);

alter table public.pantry_items enable row level security;

create policy "Users can CRUD own pantry items" on public.pantry_items
  for all using (auth.uid() = user_id);

-- RECIPES
create table public.recipes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade, -- null means global/system recipe
  name text not null,
  ingredients jsonb,
  instructions jsonb,
  macros jsonb,
  tags jsonb,
  image_url text,
  created_at timestamptz default now()
);

alter table public.recipes enable row level security;

create policy "Users can view all recipes" on public.recipes
  for select using (true);

create policy "Users can create own recipes" on public.recipes
  for insert with check (auth.uid() = user_id);

create policy "Users can update own recipes" on public.recipes
  for update using (auth.uid() = user_id);

-- MEAL PLANS
create table public.meal_plans (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  meals jsonb, -- {breakfast: recipe_id, ...}
  created_at timestamptz default now()
);

alter table public.meal_plans enable row level security;

create policy "Users can CRUD own meal plans" on public.meal_plans
  for all using (auth.uid() = user_id);

-- SHOPPING LISTS
create table public.shopping_lists (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  items jsonb,
  created_at timestamptz default now()
);

alter table public.shopping_lists enable row level security;

create policy "Users can CRUD own shopping lists" on public.shopping_lists
  for all using (auth.uid() = user_id);

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, created_at)
  values (new.id, new.raw_user_meta_data->>'full_name', now());
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
