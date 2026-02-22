// Update load status - Edge Function
// Valid transitions: assigned → in_transit → delivered
import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const VALID_NEW_STATUSES = ["in_transit", "delivered"] as const;
const VALID_TRANSITIONS: Record<string, string> = {
  assigned: "in_transit",
  in_transit: "delivered",
};

type UpdateStatusInput = {
  load_id: string;
  new_status: "in_transit" | "delivered";
  delivery_photo_url?: string | null;
};

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isValidUuid(str: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return str.startsWith("http://") || str.startsWith("https://");
  } catch {
    return false;
  }
}

function validateInput(body: unknown): UpdateStatusInput {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object");
  }
  const b = body as Record<string, unknown>;

  const load_id = b.load_id;
  if (typeof load_id !== "string" || !load_id.trim()) {
    throw new Error("load_id is required and must be a non-empty string");
  }
  if (!isValidUuid(load_id)) {
    throw new Error("load_id must be a valid UUID");
  }

  const new_status = b.new_status;
  if (typeof new_status !== "string" || !VALID_NEW_STATUSES.includes(new_status as typeof VALID_NEW_STATUSES[number])) {
    throw new Error("new_status must be 'in_transit' or 'delivered'");
  }

  const delivery_photo_url =
    typeof b.delivery_photo_url === "string" && b.delivery_photo_url.trim()
      ? b.delivery_photo_url.trim()
      : null;

  if (new_status === "delivered") {
    if (!delivery_photo_url) {
      throw new Error("delivery_photo_url is required when new_status is 'delivered'");
    }
    if (!isValidUrl(delivery_photo_url)) {
      throw new Error("delivery_photo_url must be a valid HTTP/HTTPS URL");
    }
  }

  return {
    load_id: load_id.trim(),
    new_status: new_status as "in_transit" | "delivered",
    delivery_photo_url: new_status === "delivered" ? delivery_photo_url : null,
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({
        error: "Missing or invalid Authorization header",
      }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } =
      await supabaseUser.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    let input: UpdateStatusInput;
    try {
      input = validateInput(body);
    } catch (err) {
      return jsonResponse(
        { error: err instanceof Error ? err.message : "Invalid input" },
        400
      );
    }

    // Fetch load
    const { data: load, error: loadError } = await supabaseAdmin
      .from("loads")
      .select("id, user_id, assigned_to, status")
      .eq("id", input.load_id)
      .single();

    if (loadError || !load) {
      return jsonResponse({ error: "Load not found" }, 404);
    }

    const currentStatus = load.status as string;
    const expectedNext = VALID_TRANSITIONS[currentStatus];

    if (!expectedNext || expectedNext !== input.new_status) {
      const allowed =
        expectedNext
          ? `Only '${expectedNext}' is allowed from current status '${currentStatus}'`
          : `Invalid status transition from '${currentStatus}'. Allowed: assigned → in_transit → delivered`;
      return jsonResponse(
        {
          error: allowed,
          current_status: currentStatus,
        },
        400
      );
    }

    // Only assigned driver or load owner can update status
    const isDriver = load.assigned_to === user.id;
    const isOwner = load.user_id === user.id;

    if (!isDriver && !isOwner) {
      return jsonResponse(
        { error: "Only the assigned driver or load owner can update status" },
        403
      );
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      status: input.new_status,
    };

    if (input.new_status === "delivered" && input.delivery_photo_url) {
      updatePayload.delivery_photo_url = input.delivery_photo_url;
    }

    const { error: updateError } = await supabaseAdmin
      .from("loads")
      .update(updatePayload)
      .eq("id", input.load_id);

    if (updateError) {
      console.error("Load status update error:", updateError);
      return jsonResponse(
        { error: updateError.message ?? "Failed to update load status" },
        500
      );
    }

    return jsonResponse({
      load: {
        id: load.id,
        status: input.new_status,
        ...(input.delivery_photo_url && {
          delivery_photo_url: input.delivery_photo_url,
        }),
      },
    });
  } catch (err) {
    console.error("update-load-status error:", err);
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : "Internal server error",
      },
      500
    );
  }
});

/* To invoke locally:

  # assigned → in_transit
  curl -i -X POST 'http://127.0.0.1:54321/functions/v1/update-load-status' \
    -H 'Authorization: Bearer YOUR_DRIVER_JWT' \
    -H 'Content-Type: application/json' \
    -d '{"load_id":"uuid","new_status":"in_transit"}'

  # in_transit → delivered (requires delivery_photo_url)
  curl -i -X POST 'http://127.0.0.1:54321/functions/v1/update-load-status' \
    -H 'Authorization: Bearer YOUR_DRIVER_JWT' \
    -H 'Content-Type: application/json' \
    -d '{"load_id":"uuid","new_status":"delivered","delivery_photo_url":"https://..."}'
*/
