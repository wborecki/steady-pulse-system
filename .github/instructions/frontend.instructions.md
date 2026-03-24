---
description: "Use when creating or editing React components, hooks, pages, or forms in the Monitor Hub frontend. Covers component patterns, data fetching, UI framework, and routing."
applyTo: "src/**/*.{ts,tsx}"
---

# Frontend React

## Componentes UI
- Usar **shadcn/ui** para todos componentes base. Adicionar: `npx shadcn-ui@latest add COMPONENT`
- **NÃO editar** nada em `src/components/ui/` manualmente
- Componentes de domínio ficam em `src/components/monitoring/`
- Usar `cn()` de `@/lib/utils` para merge de classes Tailwind

## Data Fetching
- TanStack React Query para TODAS as chamadas a Supabase
- Hooks em `src/hooks/`, um por arquivo, prefixo `use`
- `staleTime: 15_000` (15s), `gcTime: 5 * 60_000` (5min) — definidos globalmente
- Usar `useRefreshInterval()` para polling dinâmico
- Padrão: `useQuery` para leitura, `useMutation` com `queryClient.invalidateQueries` para escrita

## Formulários
- React Hook Form + Zod schema para validação
- Não usar `useState` manual para forms complexos
- `sonner` para feedback: `toast.success("Salvo!")`, `toast.error("Erro...")`

## Routing
- React Router DOM v6
- Páginas em `src/pages/`, lazy-loaded via `lazyWithRetry()` em App.tsx
- Adicionar novas pages: criar arquivo em `src/pages/`, importar lazy em App.tsx, adicionar Route

## Estilo
- Dark mode default (next-themes com `defaultTheme="dark"`)
- Tailwind CSS utility classes
- CSS variables para cores: `hsl(var(--primary))`, `hsl(var(--destructive))`
- Fontes: Space Grotesk (body/heading), JetBrains Mono (code)
- Tamanhos customizados: `success`, `warning` além dos padrões Tailwind

## Tipos
- `src/integrations/supabase/types.ts` — auto-gerado, NÃO editar
- `src/integrations/supabase/client.ts` — auto-gerado, NÃO editar
- Para tipos do serviço: `DbService` em `useServices.ts`
- Usar imports com alias: `import { X } from "@/components/..."`, `@/hooks/...`

## Idioma
- UI em Português (pt-BR): labels, mensagens de erro, toasts, placeholders
