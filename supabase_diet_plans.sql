-- DIET PLANS
create table public.diet_plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  duration_days integer default 7, -- 7, 14, 30
  created_at timestamptz default now(),
  is_active boolean default true,
  profile_snapshot jsonb -- Store profile at time of generation
);

-- Enable RLS for diet_plans
alter table public.diet_plans enable row level security;

create policy "Users can CRUD own diet plans" on public.diet_plans
  for all using (auth.uid() = user_id);

-- Add columns to RECIPES table
alter table public.recipes add column if not exists meal_type text; -- 'breakfast', 'lunch', 'dinner', 'snack'
alter table public.recipes add column if not exists day_of_week integer; -- 0-6 for weekly plans
alter table public.recipes add column if not exists is_diet_plan boolean default false;
alter table public.recipes add column if not exists diet_plan_id uuid references public.diet_plans(id) on delete cascade;
alter table public.recipes add column if not exists cooking_time integer;
alter table public.recipes add column if not exists budget_category text;
alter table public.recipes add column if not exists difficulty text; -- 'easy', 'medium', 'hard'

-- Create indexes
create index diet_plans_user_idx on public.diet_plans (user_id);
create index recipes_diet_plan_idx on public.recipes (diet_plan_id);
create index recipes_user_meal_type_idx on public.recipes (user_id, meal_type);
