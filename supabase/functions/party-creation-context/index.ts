import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authorizeSession, resolveCreationContext } from "../_shared/party-creation-context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);
    const { data: { user } } = await db.auth.getUser(token);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    if (action !== "context" && action !== "retry") return json({ error: "Unknown action" }, 400);

    const auth = await authorizeSession(db, user.id, body.sessionId);
    if ("error" in auth) return json({ error: auth.error }, 404);

    if (action === "retry") {
      const { data: ok } = await db.rpc("onboarding_rate_ok", { _user_id: user.id, _kind: "context_retry", _max: 6, _window: "1 hour" });
      if (!ok) return json({ status: "error", message: "Too many retries. Please wait a little and try again." }, 429);
    }
    const ctx = await resolveCreationContext(db, auth.party, { retry: action === "retry" });
    return json({ ...ctx, sessionId: auth.session.id });
  } catch (e) {
    console.error("[party-creation-context]", (e as Error).message);
    return json({ status: "error", message: "We couldn't prepare your campaign. Your draft is safe — try again." }, 500);
  }
});
