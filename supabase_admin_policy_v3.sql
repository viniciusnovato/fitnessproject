-- Allow public (anon) access to ai_cache for the admin dashboard
-- WARNING: This allows anyone with the anon key to read/update these tables.
-- Use only for development/internal tools.

-- Policy for ai_cache
create policy "Enable read access for all users"
on public.ai_cache for select
using (true);

create policy "Enable update access for all users"
on public.ai_cache for update
using (true);

-- Policy for meals_log (to see stats)
create policy "Enable read access for all users"
on public.meals_log for select
using (true);

-- Policy for profiles (to see stats)
create policy "Enable read access for all users"
on public.profiles for select
using (true);

-- Policy for recipes (to see stats)
create policy "Enable read access for all users"
on public.recipes for select
using (true);

-- Policy for meal_plans (to see stats)
create policy "Enable read access for all users"
on public.meal_plans for select
using (true);
