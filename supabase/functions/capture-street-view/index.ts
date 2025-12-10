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

    const { streetViewUrl, propertyId } = await req.json();

    if (!streetViewUrl || !propertyId) {
      return new Response(
        JSON.stringify({ error: "streetViewUrl and propertyId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    // Create Supabase client with service role for storage upload
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
