import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const tempPassword = "Odyssey_Temp_2026!";

  const { error } = await supabase.auth.admin.updateUserById(
    "a296f3fd-7758-42a9-ab5f-776874d03140",
    { password: tempPassword }
  );

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true, tempPassword }), { status: 200 });
});
