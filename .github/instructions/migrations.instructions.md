---
description: "Use when creating SQL migrations for Supabase, modifying database schema, adding enums, creating tables, or writing RPCs. Covers idempotency, RLS, naming, and deployment."
applyTo: "supabase/migrations/**/*.sql"
---

# SQL Migrations

## Naming
- Formato: `YYYYMMDDHHMMSS_description.sql` (ex: `20260324100000_add_sql_server_check_type.sql`)

## Idempotência Obrigatória
Toda migration deve ser segura para re-execução:

```sql
-- Enums
ALTER TYPE check_type ADD VALUE IF NOT EXISTS 'new_value';

-- Tabelas
CREATE TABLE IF NOT EXISTS public.my_table (...);

-- Colunas
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='services' AND column_name='new_col') THEN
    ALTER TABLE public.services ADD COLUMN new_col TEXT;
  END IF;
END $$;

-- Functions
CREATE OR REPLACE FUNCTION public.my_func() RETURNS void AS $$ ... $$ LANGUAGE sql;
```

## RLS (Row Level Security)
Novas tabelas DEVEM ter:
```sql
ALTER TABLE public.my_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can all" ON public.my_table FOR ALL USING (auth.role() = 'authenticated');
```
- `notification_settings`: RLS por `user_id` (`auth.uid() = user_id`)
- Tabelas compartilhadas (services, alerts, credentials): RLS para `authenticated`

## Enums do Projeto
```sql
-- Alterar com cuidado, types.ts precisa ser regenerado depois
ALTER TYPE public.check_type ADD VALUE IF NOT EXISTS 'new_check';
ALTER TYPE public.service_category ADD VALUE IF NOT EXISTS 'new_category';
```

## Realtime
Para tabelas que precisam de atualização em tempo real:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.my_table;
```

## Deploy
```bash
SUPABASE_DB_PASSWORD="..." npx supabase db push --project-ref zzkwldfssxopclqsxtku
```

## Pós-Deploy
Após alterar schema (tabelas, colunas, enums), SEMPRE regenerar tipos:
```bash
npx supabase gen types --lang=typescript --project-id zzkwldfssxopclqsxtku > src/integrations/supabase/types.ts
```
