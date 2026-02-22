// Triggered by Database Webhook on loads INSERT - sends push to matching users
import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const VEHICLE_CONFIG: Record<string, { maxWeightKg: number }> = {
  kamyonet: { maxWeightKg: 1500 },
  panelvan: { maxWeightKg: 1000 },
  "kasa kamyon": { maxWeightKg: 10000 },
  kamyon: { maxWeightKg: 20000 },
  tır: { maxWeightKg: 40000 },
};

const VEHICLE_ORDER = ["panelvan", "kamyonet", "kasa kamyon", "kamyon", "tır"] as const;

type WebhookPayload = {
  type?: string;
  table?: string;
  record?: {
    id?: string;
    user_id?: string;
    from_city?: string;
    from_district?: string | null;
    to_city?: string;
    to_district?: string | null;
    weight_kg?: number;
    vehicle_type?: string;
  };
};

function getCompatibleVehicleTypes(weightKg: number): string[] {
  return VEHICLE_ORDER.filter((vt) => {
    const config = VEHICLE_CONFIG[vt];
    return config && weightKg <= config.maxWeightKg;
  });
}

async function callSendNotification(
  supabaseUrl: string,
  serviceKey: string,
  payload: { user_id: string; title: string; body: string; data?: Record<string, unknown> }
) {
  const res = await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("send-notification error:", err);
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as WebhookPayload;
    if (body?.type !== "INSERT" || body?.table !== "loads" || !body?.record) {
      return new Response(JSON.stringify({ error: "Invalid webhook payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const record = body.record;
    const loadId = record.id;
    const ownerId = record.user_id;
    const fromCity = record.from_city?.trim();
    const fromDistrict = record.from_district?.trim() || "";
    const toCity = record.to_city?.trim();
    const toDistrict = record.to_district?.trim() || "";
    const weightKg = Number(record.weight_kg) || 0;
    const vehicleType = record.vehicle_type || "kamyonet";

    if (!loadId || !fromCity || !toCity) {
      return new Response(JSON.stringify({ ok: true, skipped: "invalid load" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const bodyText = `${fromCity}${fromDistrict ? "/" + fromDistrict : ""} → ${toCity}${toDistrict ? "/" + toDistrict : ""} | ${weightKg} kg`;

    const compatibleTypes = getCompatibleVehicleTypes(weightKg);
    if (compatibleTypes.length === 0) {
      return new Response(JSON.stringify({ ok: true, notified: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: drivers } = await supabase
      .from("profiles")
      .select("id")
      .eq("city", fromCity)
      .in("vehicle_type", compatibleTypes)
      .neq("id", ownerId || "");

    const ids = (drivers ?? []).map((d) => d.id);
    for (const userId of ids) {
      await callSendNotification(supabaseUrl, serviceKey, {
        user_id: userId,
        title: "Yeni Yük",
        body: bodyText,
        data: {
          type: "load",
          loadId,
        },
      });
    }

    return new Response(JSON.stringify({ ok: true, notified: ids.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("on-new-load error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
