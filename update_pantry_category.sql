-- Adiciona coluna de categoria se não existir
ALTER TABLE pantry_items 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Outros';

-- Opcional: Atualizar categorias existentes baseadas no nome (exemplo simples)
-- UPDATE pantry_items SET category = 'Laticínios' WHERE name ILIKE '%queijo%' OR name ILIKE '%leite%';
