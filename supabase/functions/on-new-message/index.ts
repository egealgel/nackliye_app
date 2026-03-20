// Triggered by Database Webhook on messages INSERT - sends push to receiver
import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

type WebhookPayload = {
  type?: string;
  table?: string;
  record?: {
    id?: string;
    sender_id?: string;
    receiver_id?: string;
    load_id?: string;
    content?: string | null;
    message_type?: string | null;
    created_at?: string;
  };
};

function formatMessagePreview(record: WebhookPayload["record"]): string {
  if (!record) return "";
  const type = record.message_type || "text";
  if (type === "image") return "📷 Fotoğraf";
  if (type === "document") {
    try {
      const meta = record.content ? JSON.parse(record.content) as { fileName?: string } : null;
      return meta?.fileName ? `📄 ${meta.fileName}` : "📄 Belge";
    } catch {
      return "📄 Belge";
    }
  }
  const text = (record.content || "").trim().slice(0, 50);
  return text ? (text.length >= 50 ? text + "…" : text) : "";
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
    if (body?.type !== "INSERT" || body?.table !== "messages" || !body?.record) {
      return new Response(JSON.stringify({ error: "Invalid webhook payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const record = body.record;
    const receiverId = record.receiver_id;
    const loadId = record.load_id;
    const senderId = record.sender_id;

    if (!receiverId || !senderId) {
      return new Response(JSON.stringify({ ok: true, skipped: "no receiver/sender" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: sender } = await supabase
      .from("profiles")
      .select("name, phone")
      .eq("id", senderId)
      .single();

    const senderName = (sender as { name?: string })?.name ?? "Biri";
    const senderPhone = (sender as { phone?: string })?.phone ?? "";
    const preview = formatMessagePreview(record);

    const { data: load } = loadId
      ? await supabase
          .from("loads")
          .select("from_city, from_district, to_city, to_district")
          .eq("id", loadId)
          .single()
      : { data: null };

    await callSendNotification(supabaseUrl, serviceKey, {
      user_id: receiverId,
      title: "Yeni Mesaj",
      body: `${senderName}: ${preview}`,
      data: {
        type: "chat",
        loadId: loadId ?? "",
        otherUserId: senderId,
        otherUserName: senderName,
        otherUserPhone: senderPhone,
        fromCity: (load?.data as { from_city?: string })?.from_city ?? "",
        fromDistrict: (load?.data as { from_district?: string })?.from_district ?? "",
        toCity: (load?.data as { to_city?: string })?.to_city ?? "",
        toDistrict: (load?.data as { to_district?: string })?.to_district ?? "",
      },
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("on-new-message error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
