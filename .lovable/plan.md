

## Autenticação Simples com Usuário Único

Como o sistema é interno e precisa de apenas um usuário, a abordagem será:

1. **Criar o usuário no backend** via migration SQL que insere `admin@monitorhub.com` com senha `Admin123!` na tabela `auth.users` do Supabase
   - Na verdade, não podemos inserir diretamente em `auth.users`. Vou usar a Edge Function para criar o usuário via API admin, ou melhor: **habilitar auto-confirm** e criar o usuário programaticamente na primeira vez, OU simplesmente criar uma página de login e o usuário se cadastra uma vez.
   - Abordagem mais limpa: **habilitar auto-confirm de email**, criar o usuário via seed edge function, e proteger todas as rotas.

2. **Criar página de Login** (`/login`) — formulário simples com email e senha, visual consistente com o tema escuro do MonitorHub

3. **Criar hook de autenticação** (`useAuth`) — gerencia sessão, login, logout

4. **Proteger rotas** — componente `ProtectedRoute` que redireciona para `/login` se não autenticado

5. **Adicionar botão de logout** no sidebar

6. **Criar edge function `seed-admin`** que cria o usuário admin usando `supabase.auth.admin.createUser()` — chamada uma vez

### Arquivos

| Arquivo | Ação |
|---------|------|
| `src/pages/Login.tsx` | Nova página de login |
| `src/hooks/useAuth.ts` | Hook de autenticação |
| `src/components/ProtectedRoute.tsx` | Wrapper de proteção de rotas |
| `src/components/monitoring/AppSidebar.tsx` | Adicionar botão de logout |
| `src/App.tsx` | Adicionar rota `/login` e proteger demais rotas |
| `supabase/functions/seed-admin/index.ts` | Edge function para criar o usuário admin |

### Configuração
- Habilitar auto-confirm de email (para o usuário admin não precisar confirmar)
- Credenciais: `admin@monitorhub.com` / `Admin123!`

