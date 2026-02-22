import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } =
      await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: { load_id?: unknown; reviewed_id?: unknown; rating?: unknown; comment?: unknown };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const load_id = typeof body.load_id === "string" ? body.load_id.trim() : "";
    const reviewed_id = typeof body.reviewed_id === "string" ? body.reviewed_id.trim() : "";
    const ratingRaw = body.rating;
    const rating = typeof ratingRaw === "number" ? ratingRaw : Number(ratingRaw);
    const comment =
      typeof body.comment === "string" ? body.comment.trim() || null : null;

    if (!load_id || !reviewed_id) {
      return new Response(
        JSON.stringify({ error: "load_id and reviewed_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return new Response(
        JSON.stringify({ error: "rating must be an integer between 1 and 5" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (reviewed_id === user.id) {
      return new Response(
        JSON.stringify({ error: "You cannot review yourself" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: load, error: loadError } = await supabase
      .from("loads")
      .select("id, user_id, assigned_to, status")
      .eq("id", load_id)
      .single();

    if (loadError || !load) {
      return new Response(
        JSON.stringify({ error: "Load not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allowedStatuses = ["assigned", "in_transit", "delivered"];
    if (!allowedStatuses.includes(load.status)) {
      return new Response(
        JSON.stringify({
          error: "Reviews can only be submitted after the load is assigned",
          status: load.status,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isOwner = load.user_id === user.id;
    const isDriver = load.assigned_to === user.id;
    if (!isOwner && !isDriver) {
      return new Response(
        JSON.stringify({ error: "Only load participants can submit reviews" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validReviewedIds = [load.user_id, load.assigned_to].filter(Boolean);
    if (!validReviewedIds.includes(reviewed_id)) {
      return new Response(
        JSON.stringify({ error: "reviewed_id must be the other load participant" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: existing } = await supabase
      .from("reviews")
      .select("id")
      .eq("load_id", load_id)
      .eq("reviewer_id", user.id)
      .eq("reviewed_id", reviewed_id)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ error: "You have already submitted a review for this load" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: review, error: insertError } = await supabase
      .from("reviews")
      .insert({
        reviewer_id: user.id,
        reviewed_id,
        load_id,
        rating,
        comment,
      })
      .select("id, load_id, reviewed_id, rating, created_at")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return new Response(
          JSON.stringify({ error: "You have already submitted a review for this load" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: insertError.message ?? "Failed to submit review" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ review }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
