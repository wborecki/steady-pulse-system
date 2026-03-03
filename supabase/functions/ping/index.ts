// Minimal edge function used by supabase-monitor to test Edge Functions runtime
// Avoids circular dependency with health-check
Deno.serve(() => new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
  headers: { "Content-Type": "application/json" },
}));
