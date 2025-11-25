# FitPantry Admin Dashboard

Painel administrativo web para visualizar estatísticas e dados da plataforma FitPantry.

## 🚀 Como Usar

### 1. Configurar credenciais Supabase

Edite o arquivo `app.js` e substitua as credenciais:

```javascript
const SUPABASE_URL = 'seu_url_aqui';
const SUPABASE_ANON_KEY = 'sua_chave_aqui';
```

Você pode encontrar essas informações em:
- Supabase Dashboard → Settings → API
- `SUPABASE_URL`: Project URL
- `SUPABASE_ANON_KEY`: Project API keys → anon/public

### 2. Abrir o dashboard

Simplemente abra o arquivo `index.html` em um navegador moderno.

Ou use um servidor local:

```bash
# Com Python 3
python3 -m http.server 8000

# Com Node.js (npx)
npx http-server

# Com PHP
php -S localhost:8000
```

Depois acesse: `http://localhost:8000`

## 📊 Funcionalidades

- ✅ **Estatísticas em Tempo Real**
  - Total de usuários
  - Total de refeições registradas
  - Total de receitas geradas
  - Total de ingredientes
  - Cache da IA
  - Planos alimentares

- ✅ **Últimos Usuários Cadastrados**
  - Email
  - Data de cadastro
  - Objetivo
  - Calorias diárias

- ✅ **Últimas Refeições Registradas**
  - Usuário
  - Nome da refeição
  - Calorias e macros
  - Data

- ✅ **Estatísticas de Cache da IA**
  - Tipo de cache
  - Quantidade
  - Taxa de hit
  - Último uso

- ✅ **Auto-refresh a cada 30 segundos**

## 🎨 Design

- Interface moderna com tema escuro
- Gradientes e animações suaves
- Totalmente responsivo
- Cards interativos com hover effects

## 🔒 Segurança

**IMPORTANTE:** Este dashboard usa a chave `anon` do Supabase, que já tem Row Level Security (RLS) configurado. 

Para produção, considere:
1. Criar uma rota autenticada
2. Adicionar login de admin
3. Usar uma chave com permissões administrativas

## 📝 Estrutura de Arquivos

```
admin/
├── index.html    # Estrutura HTML
├── styles.css    # Estilos modernos
├── app.js        # Lógica e integração Supabase
└── README.md     # Este arquivo
```

## 🛠️ Personalização

### Alterar cores

Edite as variáveis CSS em `styles.css`:

```css
:root {
    --primary: #22c55e;
    --background: #0f172a;
    --surface: #1e293b;
    /* ... */
}
```

### Adicionar novos stats

1. Adicione um card em `index.html`
2. Adicione a consulta em `loadStats()` no `app.js`
3. Atualize o ID do elemento

## 📱 Compatibilidade

- ✅ Chrome/Edge (últimas versões)
- ✅ Firefox (últimas versões)
- ✅ Safari (últimas versões)
- ✅ Mobile browsers

---

Feito com 💚 para FitPantry
