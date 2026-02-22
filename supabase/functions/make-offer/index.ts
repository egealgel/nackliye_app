// Make offer on a load - Edge Function
import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const ACCEPTABLE_LOAD_STATUSES = ["active", "has_offers"] as const;
const CLOSED_STATUSES = ["assigned", "in_transit", "delivered", "cancelled"];

type OfferInput = {
  load_id: string;
  price: number;
  message?: string | null;
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

function validateInput(body: unknown): OfferInput {
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

  const priceRaw = b.price;
  const price =
    typeof priceRaw === "number" ? priceRaw : Number(priceRaw);
  if (!Number.isFinite(price) || price < 0) {
    throw new Error("price must be a non-negative number");
  }

  const message =
    typeof b.message === "string" ? b.message.trim() || null : null;

  return {
    load_id: load_id.trim(),
    price,
    message,
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

    let input: OfferInput;
    try {
      input = validateInput(body);
    } catch (err) {
      return jsonResponse(
        { error: err instanceof Error ? err.message : "Invalid input" },
        400
      );
    }

    // Fetch load and validate status
    const { data: load, error: loadError } = await supabaseAdmin
      .from("loads")
      .select("id, status, user_id")
      .eq("id", input.load_id)
      .single();

    if (loadError || !load) {
      return jsonResponse({ error: "Load not found" }, 404);
    }

    if (CLOSED_STATUSES.includes(load.status)) {
      return jsonResponse(
        {
          error: "Load is no longer accepting offers",
          status: load.status,
        },
        409
      );
    }

    if (!ACCEPTABLE_LOAD_STATUSES.includes(load.status as typeof ACCEPTABLE_LOAD_STATUSES[number])) {
      return jsonResponse(
        { error: "Load is not accepting offers", status: load.status },
        409
      );
    }

    // Prevent driver from offering on their own load
    if (load.user_id === user.id) {
      return jsonResponse(
        { error: "You cannot make an offer on your own load" },
        400
      );
    }

    // Check for duplicate offer
    const { data: existingOffer } = await supabaseAdmin
      .from("offers")
      .select("id")
      .eq("load_id", input.load_id)
      .eq("driver_id", user.id)
      .maybeSingle();

    if (existingOffer) {
      return jsonResponse(
        { error: "You have already made an offer on this load" },
        409
      );
    }

    // Create offer (user client - RLS allows driver to insert)
    const { data: offer, error: offerError } = await supabaseUser
      .from("offers")
      .insert({
        load_id: input.load_id,
        driver_id: user.id,
        price: input.price,
        message: input.message,
        status: "pending",
      })
      .select("id, load_id, price, status, created_at")
      .single();

    if (offerError) {
      if (offerError.code === "23505") {
        return jsonResponse(
          { error: "You have already made an offer on this load" },
          409
        );
      }
      console.error("Offer insert error:", offerError);
      return jsonResponse(
        { error: offerError.message ?? "Failed to create offer" },
        500
      );
    }

    // Update load status to 'has_offers' if it was 'active'
    if (load.status === "active") {
      const { error: updateError } = await supabaseAdmin
        .from("loads")
        .update({ status: "has_offers" })
        .eq("id", input.load_id);

      if (updateError) {
        console.error("Load status update error:", updateError);
      }
    }

    return jsonResponse({
      offer: {
        id: offer.id,
        load_id: offer.load_id,
        price: offer.price,
        status: offer.status,
        created_at: offer.created_at,
      },
    });
  } catch (err) {
    console.error("make-offer error:", err);
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : "Internal server error",
      },
      500
    );
  }
});

/* To invoke locally:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/make-offer' \
    --header 'Authorization: Bearer YOUR_DRIVER_JWT' \
    --header 'Content-Type: application/json' \
    --data '{
      "load_id": "uuid-of-load",
      "price": 1500.50,
      "message": "Yarın sabah alabilirim"
    }'
*/
