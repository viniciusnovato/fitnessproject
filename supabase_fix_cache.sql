-- Add unique constraint to ai_cache table to support upsert
alter table public.ai_cache drop constraint if exists ai_cache_key_user_unique;
alter table public.ai_cache add constraint ai_cache_key_user_unique unique (cache_key, user_id);
