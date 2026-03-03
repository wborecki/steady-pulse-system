

## Integrar Resend para Envio Real de Emails de Alerta

### Pré-requisito
Armazenar o secret `RESEND_API_KEY` no backend (via `add_secret`). O usuário precisa fornecer a key antes da implementação.

### Alteração

**Arquivo único: `supabase/functions/send-notification/index.ts`**

Substituir o bloco de email (linhas 83-105) que atualmente faz apenas `console.log` por uma chamada real à API do Resend:

```typescript
if (settings.alert_email) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (RESEND_API_KEY) {
    const emoji = type === "critical" ? "🔴" : type === "warning" ? "🟡" : "🔵";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Steady Pulse <alerts@SEU_DOMINIO>",  // ou onboarding@resend.dev
        to: [settings.alert_email],
        subject: `${emoji} [${type.toUpperCase()}] ${service_name} - Alerta`,
        html: `<h2>Alerta de Monitoramento</h2>
               <p><strong>Serviço:</strong> ${service_name}</p>
               <p><strong>Severidade:</strong> ${type.toUpperCase()}</p>
               <p><strong>Mensagem:</strong> ${message}</p>
               <hr/><small>Steady Pulse System</small>`,
      }),
    });
    results.push(`email:${res.ok ? "ok" : res.status}:${settings.alert_email}`);
  }
}
```

### Configuração adicional (UI)
Adicionar um campo na página de Settings para o remetente (`from` address), ou usar um valor default configurável. Opcional — pode ser hardcoded inicialmente.

### Resumo
| Item | Detalhe |
|---|---|
| Secret necessário | `RESEND_API_KEY` |
| Arquivo alterado | `supabase/functions/send-notification/index.ts` |
| Deploy | Automático após edição |

