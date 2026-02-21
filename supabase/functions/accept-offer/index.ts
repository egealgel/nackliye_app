// Accept offer on a load - Edge Function
import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const ACCEPTABLE_LOAD_STATUSES = ["active", "has_offers"] as const;

type AcceptOfferInput = {
  offer_id: string;
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

function validateInput(body: unknown): AcceptOfferInput {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object");
  }
  const b = body as Record<string, unknown>;

  const offer_id = b.offer_id;
  if (typeof offer_id !== "string" || !offer_id.trim()) {
    throw new Error("offer_id is required and must be a non-empty string");
  }
  if (!isValidUuid(offer_id)) {
    throw new Error("offer_id must be a valid UUID");
  }

  return { offer_id: offer_id.trim() };
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

    let input: AcceptOfferInput;
    try {
      input = validateInput(body);
    } catch (err) {
      return jsonResponse(
        { error: err instanceof Error ? err.message : "Invalid input" },
        400
      );
    }

    // Fetch offer with load
    const { data: offer, error: offerError } = await supabaseAdmin
      .from("offers")
      .select("id, load_id, driver_id, status")
      .eq("id", input.offer_id)
      .single();

    if (offerError || !offer) {
      return jsonResponse({ error: "Offer not found" }, 404);
    }

    if (offer.status !== "pending") {
      return jsonResponse(
        { error: "Offer is no longer pending", status: offer.status },
        409
      );
    }

    // Fetch load and verify requester is owner
    const { data: load, error: loadError } = await supabaseAdmin
      .from("loads")
      .select("id, user_id, status, assigned_to")
      .eq("id", offer.load_id)
      .single();

    if (loadError || !load) {
      return jsonResponse({ error: "Load not found" }, 404);
    }

    if (load.user_id !== user.id) {
      return jsonResponse(
        { error: "Only the load owner can accept offers" },
        403
      );
    }

    if (!ACCEPTABLE_LOAD_STATUSES.includes(load.status as typeof ACCEPTABLE_LOAD_STATUSES[number])) {
      return jsonResponse(
        {
          error: "Load cannot accept offers in current status",
          status: load.status,
        },
        409
      );
    }

    if (load.assigned_to) {
      return jsonResponse(
        { error: "Load is already assigned to a driver" },
        409
      );
    }

    // Update accepted offer
    const { error: acceptError } = await supabaseAdmin
      .from("offers")
      .update({ status: "accepted" })
      .eq("id", input.offer_id);

    if (acceptError) {
      console.error("Offer accept error:", acceptError);
      return jsonResponse(
        { error: acceptError.message ?? "Failed to accept offer" },
        500
      );
    }

    // Update load: assigned_to, status
    const { error: loadUpdateError } = await supabaseAdmin
      .from("loads")
      .update({
        assigned_to: offer.driver_id,
        status: "assigned",
      })
      .eq("id", offer.load_id);

    if (loadUpdateError) {
      console.error("Load update error:", loadUpdateError);
      return jsonResponse(
        { error: loadUpdateError.message ?? "Failed to assign load" },
        500
      );
    }

    // Reject other pending offers on same load
    const { data: rejectedOffers, error: rejectError } = await supabaseAdmin
      .from("offers")
      .update({ status: "rejected" })
      .eq("load_id", offer.load_id)
      .eq("status", "pending")
      .neq("id", input.offer_id)
      .select("driver_id");

    if (rejectError) {
      console.error("Reject offers error:", rejectError);
    }

    const rejectedDriverIds = (rejectedOffers ?? []).map((o) => o.driver_id);

    // Notification to accepted driver
    const { error: acceptedNotifError } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: offer.driver_id,
        type: "offer_accepted",
        title: "Teklif Kabul Edildi",
        body: "Teklifiniz kabul edildi!",
        data: {
          offer_id: offer.id,
          load_id: offer.load_id,
        },
        read: false,
      });

    if (acceptedNotifError) {
      console.error("Accepted driver notification error:", acceptedNotifError);
    }

    // Notifications to rejected drivers
    if (rejectedDriverIds.length > 0) {
      const rejectedNotifications = rejectedDriverIds.map(
        (driver_id: string) => ({
          user_id: driver_id,
          type: "offer_rejected",
          title: "Teklif Reddedildi",
          body: "Teklifiniz reddedildi.",
          data: { load_id: offer.load_id },
          read: false,
        })
      );

      const { error: rejectedNotifError } = await supabaseAdmin
        .from("notifications")
        .insert(rejectedNotifications);

      if (rejectedNotifError) {
        console.error("Rejected drivers notification error:", rejectedNotifError);
      }
    }

    return jsonResponse({
      offer: {
        id: offer.id,
        load_id: offer.load_id,
        driver_id: offer.driver_id,
        status: "accepted",
      },
      load: {
        id: load.id,
        assigned_to: offer.driver_id,
        status: "assigned",
      },
      rejected_count: rejectedDriverIds.length,
    });
  } catch (err) {
    console.error("accept-offer error:", err);
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : "Internal server error",
      },
      500
    );
  }
});

/* To invoke locally:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/accept-offer' \
    --header 'Authorization: Bearer YOUR_LOAD_OWNER_JWT' \
    --header 'Content-Type: application/json' \
    --data '{"offer_id":"uuid-of-offer"}'
*/
