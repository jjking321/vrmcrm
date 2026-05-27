import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Supabase configuration missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Require an authenticated user
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const authClient = createClient(SUPABASE_URL, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { streetViewUrl, propertyId } = await req.json();

    if (!streetViewUrl || !propertyId) {
      return new Response(
        JSON.stringify({ error: "streetViewUrl and propertyId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Strict URL allowlist — must be a Google Maps Street View static image URL.
    let parsed: URL;
    try { parsed = new URL(streetViewUrl); } catch {
      return new Response(JSON.stringify({ error: "Invalid URL" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (parsed.protocol !== "https:" || parsed.hostname !== "maps.googleapis.com") {
      return new Response(JSON.stringify({ error: "URL not allowed" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify caller has access to this property (same company).
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: prof } = await admin
      .from("profiles").select("company_id").eq("id", userData.user.id).maybeSingle();
    if (!prof?.company_id) {
      return new Response(JSON.stringify({ error: "No company" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: prop } = await admin
      .from("properties").select("id").eq("id", propertyId).eq("company_id", prof.company_id).maybeSingle();
    if (!prop) {
      return new Response(JSON.stringify({ error: "Property not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("Capturing Street View image for property:", propertyId);
    console.log("Street View URL:", streetViewUrl);

    // Directly fetch the Google Maps static image (no need for Firecrawl)
    const imageResponse = await fetch(streetViewUrl);
    
    if (!imageResponse.ok) {
      console.error("Failed to fetch image:", imageResponse.status);
      return new Response(
        JSON.stringify({ error: "Failed to fetch Street View image" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the image as bytes directly
    const bytes = new Uint8Array(await imageResponse.arrayBuffer());
    const contentType = imageResponse.headers.get("content-type") || "image/png";
    const extension = contentType.includes("jpeg") ? "jpg" : "png";
    
    console.log("Image fetched successfully, size:", bytes.length, "bytes");

    // Use the admin client for storage upload
    const supabase = admin;

    // Generate unique filename
    const filename = `${propertyId}-streetview-${Date.now()}.${extension}`;
    
    console.log("Uploading to storage:", filename);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("property-images")
      .upload(filename, bytes, {
        contentType: contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload screenshot to storage" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("property-images")
      .getPublicUrl(filename);

    const publicUrl = urlData.publicUrl;
    console.log("Screenshot captured and uploaded:", publicUrl);

    return new Response(
      JSON.stringify({ 
        success: true, 
        imageUrl: publicUrl,
        filename: filename
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in capture-street-view:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
