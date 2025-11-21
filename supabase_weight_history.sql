-- Create weight_history table
create table if not exists weight_history (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  weight decimal not null,
  notes text,
  date timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table weight_history enable row level security;

-- Policies
create policy "Users can view their own weight history"
  on weight_history for select
  using ( auth.uid() = user_id );

create policy "Users can insert their own weight history"
  on weight_history for insert
  with check ( auth.uid() = user_id );

create policy "Users can update their own weight history"
  on weight_history for update
  using ( auth.uid() = user_id );

create policy "Users can delete their own weight history"
  on weight_history for delete
  using ( auth.uid() = user_id );
