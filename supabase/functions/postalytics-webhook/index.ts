import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// UUID v4 regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    console.log("Postalytics webhook received:", JSON.stringify(body));

    // Extract owner UUID from var_field_1
    const ownerUuid = body.var_field_1;
    if (!ownerUuid || !UUID_REGEX.test(ownerUuid)) {
      console.log("Invalid or missing var_field_1 (ContactID):", ownerUuid);
      return new Response(
        JSON.stringify({ ok: true, skipped: "invalid_contact_id" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Look up the owner
    const { data: owner, error: ownerError } = await supabase
      .from("owners")
      .select("id, property_id, company_id, name, contact_name, owners")
      .eq("id", ownerUuid)
      .single();

    if (ownerError || !owner) {
      console.log("Owner not found for UUID:", ownerUuid);
      return new Response(
        JSON.stringify({ ok: true, skipped: "owner_not_found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine display name
    const owners = (owner.owners as any[]) || [];
    let displayName = owner.contact_name || owner.name || "";
    if (!displayName && owners.length > 0) {
      const first = owners[0];
      displayName = `${first.firstName || ""} ${first.lastName || ""}`.trim();
    }

    // Build activity content
    const eventName = body.event_name || "PURL Event";
    const eventDate = body.event_date || new Date().toISOString();
    const recipientName = [body.first_name, body.last_name]
      .filter(Boolean)
      .join(" ");
    const metadataUrl = body.metadata?.url || "";

    let content = `PURL scanned: ${eventName}`;
    if (recipientName) content += ` by ${recipientName}`;
    if (metadataUrl) content += ` — ${metadataUrl}`;

    // Insert activity log
    const { error: insertError } = await supabase
      .from("activity_logs")
      .insert({
        property_id: owner.property_id,
        company_id: owner.company_id,
        type: "mail",
        content,
        outcome: eventName,
        owner_name: displayName || null,
        date: eventDate,
        created_by: null,
      });

    if (insertError) {
      console.error("Failed to insert activity:", insertError);
      return new Response(
        JSON.stringify({ ok: false, error: "insert_failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(
      `Activity logged for owner ${ownerUuid} (${displayName}): ${eventName}`
    );
    return new Response(
      JSON.stringify({ ok: true, logged: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
