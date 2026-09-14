import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

async function hashValue(value: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, {
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return jsonResponse(500, {
        success: false,
        error: "Missing Supabase environment variables"
      });
    }

    const body = await req.json();
    const action = body?.action;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    if (action === "signup") {
      const profile = body?.profile || {};
      const alias = (profile.alias || "").trim();
      const name = (profile.name || "").trim();
      const password = (profile.password || "").trim();

      if (!alias || !name || !password) {
        return jsonResponse(400, {
          success: false,
          error: "Alias, namn och lösenord krävs"
        });
      }

      if (password.length < 6) {
        return jsonResponse(400, {
          success: false,
          error: "Lösenordet måste vara minst 6 tecken"
        });
      }

      const { data: existing, error: existingError } = await supabaseAdmin
        .from("festival2026_deltagare")
        .select("id")
        .eq("alias", alias)
        .maybeSingle();

      if (existingError) {
        return jsonResponse(500, {
          success: false,
          error: existingError.message
        });
      }

      if (existing) {
        return jsonResponse(409, {
          success: false,
          error: "Användarnamnet finns redan"
        });
      }

      const passwordHash = await hashValue(password);

      const { data, error } = await supabaseAdmin
        .from("festival2026_deltagare")
        .insert({
          name,
          alias,
          sauna_oil: profile.sauna_oil || null,
          favorite_temperature: profile.favorite_temperature ?? null,
          motto: profile.motto || null,
          password_hash: passwordHash
        })
        .select()
        .single();

      if (error) {
        return jsonResponse(500, {
          success: false,
          error: error.message
        });
      }

      return jsonResponse(200, {
        success: true,
        id: data.id,
        participant: data
      });
    }

    if (action === "login") {
      const username = (body?.username || "").trim();
      const password = (body?.password || "").trim();

      if (!username || !password) {
        return jsonResponse(400, {
          success: false,
          error: "Användarnamn och lösenord krävs"
        });
      }

      const { data, error } = await supabaseAdmin
        .from("festival2026_deltagare")
        .select("id, alias, password_hash")
        .eq("alias", username)
        .maybeSingle();

      if (error) {
        return jsonResponse(500, {
          success: false,
          error: error.message
        });
      }

      if (!data || !data.password_hash) {
        return jsonResponse(401, {
          success: false,
          error: "Fel användarnamn eller lösenord"
        });
      }

      const passwordHash = await hashValue(password);

      if (passwordHash !== data.password_hash) {
        return jsonResponse(401, {
          success: false,
          error: "Fel användarnamn eller lösenord"
        });
      }

      return jsonResponse(200, {
        success: true,
        user_id: data.id
      });
    }

    return jsonResponse(400, {
      success: false,
      error: "Unknown action"
    });
  } catch (error) {
    console.error("festival2026-auth error", error);

    return jsonResponse(500, {
      success: false,
      error: error instanceof Error ? error.message : "Unexpected error"
    });
  }
});
