-- Fix RLS policies for ai_cache
drop policy if exists "Users can insert their own cache" on public.ai_cache;
create policy "Users can insert their own cache"
  on public.ai_cache for insert
  with check (auth.uid() = user_id);

-- Fix RLS policies for diet_plans
drop policy if exists "Users can insert own diet plans" on public.diet_plans;
create policy "Users can insert own diet plans"
  on public.diet_plans for insert
  with check (auth.uid() = user_id);

-- Fix RLS policies for recipes
drop policy if exists "Users can create own recipes" on public.recipes;
create policy "Users can create own recipes"
  on public.recipes for insert
  with check (auth.uid() = user_id);
