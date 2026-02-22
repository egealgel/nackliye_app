// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

// Vehicle type config: max weight (kg) and default dimensions (cm) if not provided
const VEHICLE_CONFIG: Record<
  string,
  { maxWeightKg: number; width: number; height: number; length: number }
> = {
  kamyonet: { maxWeightKg: 1500, width: 180, height: 150, length: 350 },
  panelvan: { maxWeightKg: 1000, width: 160, height: 140, length: 300 },
  "kasa kamyon": { maxWeightKg: 10000, width: 245, height: 270, length: 610 },
  kamyon: { maxWeightKg: 20000, width: 255, height: 400, length: 1360 },
  tır: { maxWeightKg: 40000, width: 255, height: 400, length: 1360 },
};

// Vehicle type upgrade path when weight exceeds capacity
const VEHICLE_UPGRADE_ORDER = [
  "panelvan",
  "kamyonet",
  "kasa kamyon",
  "kamyon",
  "tır",
] as const;

type LoadInput = {
  from_city: string;
  to_city: string;
  weight_kg: number;
  width_cm?: number | null;
  height_cm?: number | null;
  length_cm?: number | null;
  vehicle_type?: string | null;
  description?: string | null;
  photos?: string[] | null;
};

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getCompatibleVehicleType(weightKg: number): string {
  for (const vt of VEHICLE_UPGRADE_ORDER) {
    const config = VEHICLE_CONFIG[vt];
    if (config && weightKg <= config.maxWeightKg) return vt;
  }
  return "tır";
}

function getDefaultDimensions(vehicleType: string) {
  const config = VEHICLE_CONFIG[vehicleType] ?? VEHICLE_CONFIG.tır;
  return { width: config.width, height: config.height, length: config.length };
}

function validateInput(body: unknown): LoadInput {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object");
  }
  const b = body as Record<string, unknown>;

  const from_city = b.from_city;
  const to_city = b.to_city;
  const weight_kg = b.weight_kg;

  if (typeof from_city !== "string" || !from_city.trim()) {
    throw new Error("from_city is required and must be a non-empty string");
  }
  if (typeof to_city !== "string" || !to_city.trim()) {
    throw new Error("to_city is required and must be a non-empty string");
  }
  const w = Number(weight_kg);
  if (!Number.isFinite(w) || w <= 0 || w > 100000) {
    throw new Error("weight_kg must be a positive number up to 100000");
  }

  const vehicle_type =
    typeof b.vehicle_type === "string" && b.vehicle_type.trim()
      ? b.vehicle_type.trim().toLowerCase()
      : null;

  const suggestedVehicle = getCompatibleVehicleType(w);
  const effectiveVehicle = vehicle_type ?? suggestedVehicle;
  const config = VEHICLE_CONFIG[effectiveVehicle];
  // If requested vehicle cannot carry weight → auto-assign compatible type
  const finalVehicle =
    config && w > config.maxWeightKg ? suggestedVehicle : effectiveVehicle;
  const dims = getDefaultDimensions(finalVehicle);

  const widthRaw = b.width_cm != null ? b.width_cm : dims.width;
  const heightRaw = b.height_cm != null ? b.height_cm : dims.height;
  const lengthRaw = b.length_cm != null ? b.length_cm : dims.length;

  const width_cm = typeof widthRaw === "number" ? widthRaw : Number(widthRaw);
  const height_cm = typeof heightRaw === "number" ? heightRaw : Number(heightRaw);
  const length_cm = typeof lengthRaw === "number" ? lengthRaw : Number(lengthRaw);

  if (!Number.isFinite(width_cm) || width_cm <= 0) {
    throw new Error("width_cm must be a positive number");
  }
  if (!Number.isFinite(height_cm) || height_cm <= 0) {
    throw new Error("height_cm must be a positive number");
  }
  if (!Number.isFinite(length_cm) || length_cm <= 0) {
    throw new Error("length_cm must be a positive number");
  }

  const description =
    typeof b.description === "string" ? b.description : null;
  const photos = Array.isArray(b.photos)
    ? (b.photos.filter((p): p is string => typeof p === "string") as string[])
    : [];

  return {
    from_city: from_city.trim(),
    to_city: to_city.trim(),
    weight_kg: w,
    width_cm,
    height_cm,
    length_cm,
    vehicle_type: finalVehicle,
    description: description ?? null,
    photos: photos.length ? photos : null,
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Missing or invalid Authorization header" }, 401);
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

    let input: LoadInput;
    try {
      input = validateInput(body);
    } catch (err) {
      return jsonResponse(
        { error: err instanceof Error ? err.message : "Invalid input" },
        400
      );
    }

    // Create load record (uses user JWT, respects RLS)
    const { data: load, error: loadError } = await supabaseUser
      .from("loads")
      .insert({
        user_id: user.id,
        from_city: input.from_city,
        to_city: input.to_city,
        weight_kg: input.weight_kg,
        width_cm: input.width_cm,
        height_cm: input.height_cm,
        length_cm: input.length_cm,
        vehicle_type: input.vehicle_type,
        description: input.description,
        photos: input.photos ?? [],
        status: "active",
      })
      .select("id, from_city, to_city, vehicle_type")
      .single();

    if (loadError) {
      console.error("Load insert error:", loadError);
      return jsonResponse(
        { error: loadError.message ?? "Failed to create load" },
        500
      );
    }

    // Find matching drivers: same from_city + compatible vehicle (has vehicle_type that can carry weight)
    const driverVehicleTypes = VEHICLE_UPGRADE_ORDER.filter(
      (vt) =>
        VEHICLE_CONFIG[vt] &&
        input.weight_kg <= VEHICLE_CONFIG[vt].maxWeightKg
    );

    const { data: drivers, error: driversError } = await supabaseAdmin
      .from("profiles")
      .select("id, name")
      .eq("city", input.from_city)
      .in("vehicle_type", driverVehicleTypes)
      .neq("id", user.id);

    if (driversError) {
      console.error("Drivers query error:", driversError);
      // Don't fail the request; load was created
    }

    const matchingDrivers = drivers ?? [];

    // Push notifications via send-notification (DB webhook on-new-load handles direct inserts)
    const bodyText = `${input.from_city} → ${input.to_city} | ${input.weight_kg} kg`;
    const fnUrl = `${supabaseUrl}/functions/v1/send-notification`;
    for (const d of matchingDrivers) {
      try {
        await fetch(fnUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            user_id: d.id,
            title: "Yeni Yük",
            body: bodyText,
            data: { type: "load", loadId: load.id },
          }),
        });
      } catch (e) {
        console.error("Push to", d.id, e);
      }
    }

    return jsonResponse({
      load: {
        id: load.id,
        from_city: load.from_city,
        to_city: load.to_city,
        vehicle_type: load.vehicle_type,
        weight_kg: input.weight_kg,
        width_cm: input.width_cm,
        height_cm: input.height_cm,
        length_cm: input.length_cm,
      },
      notified_drivers: matchingDrivers.length,
    });
  } catch (err) {
    console.error("create-load error:", err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Internal server error" },
      500
    );
  }
});

/* To invoke locally:

  1. Run `supabase start`
  2. Create load:
  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/create-load' \
    --header 'Authorization: Bearer YOUR_USER_JWT' \
    --header 'Content-Type: application/json' \
    --data '{
      "from_city": "Istanbul",
      "to_city": "Ankara",
      "weight_kg": 500,
      "vehicle_type": "kamyonet",
      "description": "Ev eşyası"
    }'

  For push notifications: add a DB webhook on notifications INSERT that calls
  a push Edge Function (Expo/FCM), or add expo_push_token to profiles.
*/
