// Deletes the calling user's account. All their rows cascade (profiles, attempts, mocks, srs_cards, kv).
// Only the signed-in user can delete themselves: auth 'user' + platform verify_jwt.
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const handler = withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method !== "POST") return Response.json({ message: "Use POST" }, { status: 405, headers: cors });
  const userId = ctx.userClaims?.id;
  if (!userId) return Response.json({ message: "Not signed in" }, { status: 401, headers: cors });
  // supabaseAdmin bypasses RLS; scoped strictly to the caller's own id from the verified JWT.
  const { error } = await ctx.supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) return Response.json({ message: "Could not delete account" }, { status: 500, headers: cors });
  return Response.json({ deleted: true }, { headers: cors });
});

export default {
  fetch: (req: Request) => (req.method === "OPTIONS" ? new Response("ok", { headers: cors }) : handler(req)),
};
