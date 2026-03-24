---
description: "Use when creating or editing Supabase Edge Functions in supabase/functions/. Covers Deno runtime, CORS, error handling, and deployment patterns."
applyTo: "supabase/functions/**/*.ts"
---

# Edge Functions (Deno)

## Runtime
- Deno runtime, NÃO Node.js
- Imports via URL ou `npm:` specifier (`npm:pg@8`, `npm:mssql@11`, `npm:mongodb@6`)
- Não usar `require()` — apenas `import`

## Boilerplate Obrigatório

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 204, headers: corsHeaders });
  }

  try {
    // ... lógica
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

## Regras
- CORS headers em TODAS as respostas (inclusive erros)
- OPTIONS → 204 com corsHeaders (primeira coisa no handler)
- Sempre retornar JSON com campo `error` em caso de falha
- Supabase client: `createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)`
- Nunca lançar exceções não tratadas — sempre wrap em try/catch
- `catch {}` vazio NÃO captura todos os erros de drivers npm no Deno — evitar queries que podem falhar
- Timeout do Supabase: 25s máximo — evitar operações longas

## Credential Resolution Pattern
```typescript
// Se check_config tem credential_id, buscar da tabela credentials e fazer merge
if (config.credential_id) {
  const { data: cred } = await supabase.from("credentials").select("config").eq("id", config.credential_id).single();
  if (cred?.config) resolvedConfig = { ...cred.config, ...config };
}
```

## Deploy
```bash
npx supabase functions deploy FUNCTION_NAME --project-ref zzkwldfssxopclqsxtku --no-verify-jwt
```
- `--no-verify-jwt` para funções chamadas internamente pelo health-check/cron
