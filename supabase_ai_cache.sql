-- AI Cache Table for storing OpenAI API responses
-- This reduces API costs and improves performance by reusing previous generations

-- Drop table if exists (for development)
drop table if exists public.ai_cache cascade;

-- Create ai_cache table
create table public.ai_cache (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  cache_key text not null,
  request_type text not null, -- 'recipe', 'insight', 'meal_image', 'meal_plan', 'pantry_image'
  request_params jsonb not null,
  response_data jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  expires_at timestamp with time zone,
  hit_count integer default 0,
  last_hit_at timestamp with time zone
);

-- Create indexes for fast lookups
create index ai_cache_key_user_idx on public.ai_cache (cache_key, user_id);
create index ai_cache_expires_idx on public.ai_cache (expires_at) where expires_at is not null;
create index ai_cache_type_idx on public.ai_cache (request_type, user_id);

-- Enable RLS
alter table public.ai_cache enable row level security;

-- RLS Policies
create policy "Users can view their own cache"
  on public.ai_cache for select
  using (auth.uid() = user_id);

create policy "Users can insert their own cache"
  on public.ai_cache for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own cache"
  on public.ai_cache for update
  using (auth.uid() = user_id);

create policy "Users can delete their own cache"
  on public.ai_cache for delete
  using (auth.uid() = user_id);

-- Function to clean expired cache entries (run periodically)
create or replace function clean_expired_cache()
returns void
language plpgsql
security definer
as $$
begin
  delete from public.ai_cache
  where expires_at is not null
    and expires_at < now();
end;
$$;

-- Comment on table
comment on table public.ai_cache is 'Stores AI-generated responses to reduce API costs and improve performance';
