-- Rode este script no SQL Editor do seu projeto Supabase

-- Cria a tabela de itens da despensa
CREATE TABLE IF NOT EXISTS pantry_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity TEXT,
  unit TEXT,
  category TEXT DEFAULT 'outros',
  status TEXT DEFAULT 'available',
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, name)
);

-- Cria índice para performance
CREATE INDEX IF NOT EXISTS idx_pantry_user ON pantry_items(user_id);

-- Habilita segurança (RLS)
ALTER TABLE pantry_items ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (apenas o dono pode ver/editar seus itens)
CREATE POLICY "Users can view their own pantry items" ON pantry_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pantry items" ON pantry_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pantry items" ON pantry_items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pantry items" ON pantry_items
  FOR DELETE USING (auth.uid() = user_id);
