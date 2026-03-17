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
  bos_arac: { maxWeightKg: 0, width: 0, height: 0, length: 0 }, // empty vehicle posts; route/weight not used
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
  from_city: string | null;
  to_city: string | null;
  weight_kg: number | null;
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

  const vehicle_type =
    typeof b.vehicle_type === "string" && b.vehicle_type.trim()
      ? b.vehicle_type.trim().toLowerCase()
      : null;

  const isBosArac = vehicle_type === "bos_arac";

  const from_city = b.from_city;
  const to_city = b.to_city;
  const weight_kg = b.weight_kg;

  if (isBosArac) {
    // Boş Araç: from_city, to_city, weight_kg may be null or omitted
    if (from_city != null && (typeof from_city !== "string" || from_city.trim() !== "")) {
      throw new Error("from_city must be null or empty for vehicle_type bos_arac");
    }
    if (to_city != null && (typeof to_city !== "string" || to_city.trim() !== "")) {
      throw new Error("to_city must be null or empty for vehicle_type bos_arac");
    }
    if (weight_kg != null && typeof weight_kg === "number" && Number.isFinite(weight_kg) && weight_kg > 0) {
      throw new Error("weight_kg must be null or 0 for vehicle_type bos_arac");
    }
  } else {
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
  }

  const suggestedVehicle = getCompatibleVehicleType(
    weight_kg != null && typeof weight_kg === "number" && Number.isFinite(weight_kg) && weight_kg > 0
      ? weight_kg
      : 1
  );
  const effectiveVehicle = vehicle_type ?? suggestedVehicle;
  const config = VEHICLE_CONFIG[effectiveVehicle];
  const wNum =
    weight_kg != null && typeof weight_kg === "number" && Number.isFinite(weight_kg) && weight_kg > 0
      ? weight_kg
      : 1;
  const finalVehicle = isBosArac
    ? "bos_arac"
    : config && wNum > config.maxWeightKg
      ? getCompatibleVehicleType(wNum)
      : effectiveVehicle;
  const dims = getDefaultDimensions(finalVehicle);

  const widthRaw = b.width_cm != null ? b.width_cm : dims.width;
  const heightRaw = b.height_cm != null ? b.height_cm : dims.height;
  const lengthRaw = b.length_cm != null ? b.length_cm : dims.length;

  const width_cm = typeof widthRaw === "number" ? widthRaw : Number(widthRaw);
  const height_cm = typeof heightRaw === "number" ? heightRaw : Number(heightRaw);
  const length_cm = typeof lengthRaw === "number" ? lengthRaw : Number(lengthRaw);

  if (!isBosArac) {
    if (!Number.isFinite(width_cm) || width_cm <= 0) {
      throw new Error("width_cm must be a positive number");
    }
    if (!Number.isFinite(height_cm) || height_cm <= 0) {
      throw new Error("height_cm must be a positive number");
    }
    if (!Number.isFinite(length_cm) || length_cm <= 0) {
      throw new Error("length_cm must be a positive number");
    }
  }

  const description =
    typeof b.description === "string" ? b.description : null;
  const photos = Array.isArray(b.photos)
    ? (b.photos.filter((p): p is string => typeof p === "string") as string[])
    : [];

  const fromCityVal =
    isBosArac || from_city == null || (typeof from_city === "string" && !from_city.trim())
      ? null
      : (from_city as string).trim();
  const toCityVal =
    isBosArac || to_city == null || (typeof to_city === "string" && !to_city.trim())
      ? null
      : (to_city as string).trim();
  const weightVal =
    isBosArac || weight_kg == null || (typeof weight_kg === "number" && (!Number.isFinite(weight_kg) || weight_kg <= 0))
      ? null
      : Number(weight_kg);

  return {
    from_city: fromCityVal,
    to_city: toCityVal,
    weight_kg: weightVal,
    width_cm: isBosArac ? null : width_cm,
    height_cm: isBosArac ? null : height_cm,
    length_cm: isBosArac ? null : length_cm,
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

    // Find matching drivers: same from_city + compatible vehicle (skip for bos_arac — no route)
    const matchingDrivers: { id: string; name: string }[] = [];
    if (input.vehicle_type !== "bos_arac" && input.from_city != null && input.weight_kg != null) {
      const driverVehicleTypes = VEHICLE_UPGRADE_ORDER.filter(
        (vt) =>
          VEHICLE_CONFIG[vt] &&
          input.weight_kg! <= VEHICLE_CONFIG[vt].maxWeightKg
      );

      const { data: drivers, error: driversError } = await supabaseAdmin
        .from("profiles")
        .select("id, name")
        .eq("city", input.from_city)
        .in("vehicle_type", driverVehicleTypes)
        .neq("id", user.id);

      if (driversError) {
        console.error("Drivers query error:", driversError);
      } else if (drivers) {
        matchingDrivers.push(...drivers);
      }
    }

    // Push notifications:
    // Client-side push (Expo Push API) is used in the app for now.

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
