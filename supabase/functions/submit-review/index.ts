// Submit review - Edge Function
import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

type ReviewInput = {
  load_id: string;
  reviewed_id: string;
  rating: number;
  comment?: string | null;
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

function validateInput(body: unknown): ReviewInput {
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

  const reviewed_id = b.reviewed_id;
  if (typeof reviewed_id !== "string" || !reviewed_id.trim()) {
    throw new Error("reviewed_id is required and must be a non-empty string");
  }
  if (!isValidUuid(reviewed_id)) {
    throw new Error("reviewed_id must be a valid UUID");
  }

  const ratingRaw = b.rating;
  const rating =
    typeof ratingRaw === "number" ? ratingRaw : Number(ratingRaw);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("rating must be an integer between 1 and 5");
  }

  const comment =
    typeof b.comment === "string" ? b.comment.trim() || null : null;

  return {
    load_id: load_id.trim(),
    reviewed_id: reviewed_id.trim(),
    rating,
    comment,
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

    let input: ReviewInput;
    try {
      input = validateInput(body);
    } catch (err) {
      return jsonResponse(
        { error: err instanceof Error ? err.message : "Invalid input" },
        400
      );
    }

    if (input.reviewed_id === user.id) {
      return jsonResponse(
        { error: "You cannot review yourself" },
        400
      );
    }

    // Fetch load and validate status
    const { data: load, error: loadError } = await supabaseAdmin
      .from("loads")
      .select("id, user_id, assigned_to, status")
      .eq("id", input.load_id)
      .single();

    if (loadError || !load) {
      return jsonResponse({ error: "Load not found" }, 404);
    }

    if (load.status !== "delivered") {
      return jsonResponse(
        {
          error: "Reviews can only be submitted for delivered loads",
          status: load.status,
        },
        400
      );
    }

    // Reviewer must be load owner or assigned driver
    const isOwner = load.user_id === user.id;
    const isDriver = load.assigned_to === user.id;

    if (!isOwner && !isDriver) {
      return jsonResponse(
        { error: "Only load participants can submit reviews" },
        403
      );
    }

    // Reviewed user must be the other party (owner or driver)
    const validReviewedIds = [load.user_id, load.assigned_to].filter(Boolean);
    if (!validReviewedIds.includes(input.reviewed_id)) {
      return jsonResponse(
        { error: "reviewed_id must be the other load participant" },
        400
      );
    }

    // Check for duplicate review
    const { data: existingReview } = await supabaseAdmin
      .from("reviews")
      .select("id")
      .eq("load_id", input.load_id)
      .eq("reviewer_id", user.id)
      .eq("reviewed_id", input.reviewed_id)
      .maybeSingle();

    if (existingReview) {
      return jsonResponse(
        { error: "You have already submitted a review for this load" },
        409
      );
    }

    // Insert review (user client - RLS allows if participant + delivered)
    const { data: review, error: reviewError } = await supabaseUser
      .from("reviews")
      .insert({
        reviewer_id: user.id,
        reviewed_id: input.reviewed_id,
        load_id: input.load_id,
        rating: input.rating,
        comment: input.comment,
      })
      .select("id, load_id, reviewed_id, rating, created_at")
      .single();

    if (reviewError) {
      if (reviewError.code === "23505") {
        return jsonResponse(
          { error: "You have already submitted a review for this load" },
          409
        );
      }
      console.error("Review insert error:", reviewError);
      return jsonResponse(
        { error: reviewError.message ?? "Failed to submit review" },
        500
      );
    }

    // Notification to reviewed user
    const { error: notifError } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: input.reviewed_id,
        type: "new_review",
        title: "Yeni Değerlendirme",
        body: `Yeni bir değerlendirme aldınız: ⭐${input.rating}`,
        data: {
          review_id: review.id,
          load_id: input.load_id,
          rating: input.rating,
          reviewer_id: user.id,
        },
        read: false,
      });

    if (notifError) {
      console.error("Notification insert error:", notifError);
    }

    return jsonResponse({
      review: {
        id: review.id,
        load_id: review.load_id,
        reviewed_id: review.reviewed_id,
        rating: review.rating,
        created_at: review.created_at,
      },
    });
  } catch (err) {
    console.error("submit-review error:", err);
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : "Internal server error",
      },
      500
    );
  }
});

/* To invoke locally:

  curl -i -X POST 'http://127.0.0.1:54321/functions/v1/submit-review' \
    -H 'Authorization: Bearer YOUR_JWT' \
    -H 'Content-Type: application/json' \
    -d '{
      "load_id": "uuid",
      "reviewed_id": "uuid-of-other-party",
      "rating": 5,
      "comment": "Çok iyi hizmet!"
    }'
*/
