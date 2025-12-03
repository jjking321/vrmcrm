import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEOCODIO_API_KEY = Deno.env.get("GEOCODIO_API_KEY");
    if (!GEOCODIO_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GEOCODIO_API_KEY is not configured. Please add it in Settings." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { address, city, state, zip } = await req.json();

    if (!address) {
      return new Response(
        JSON.stringify({ error: "Address is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fullAddress = [address, city, state, zip].filter(Boolean).join(", ");
    console.log("Verifying address:", fullAddress);

    const geocodioUrl = `https://api.geocod.io/v1.7/geocode?q=${encodeURIComponent(fullAddress)}&api_key=${GEOCODIO_API_KEY}`;
    
    const response = await fetch(geocodioUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Geocodio API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Address verification failed. Check your Geocodio API key." }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return new Response(
        JSON.stringify({ 
          isValid: false, 
          message: "Address could not be verified",
          original: fullAddress,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = data.results[0];
    const accuracy = result.accuracy;
    const addressComponents = result.address_components;
    const location = result.location;

    // Determine if address is valid based on accuracy
    const isValid = accuracy >= 0.8;
    
    // Format standardized address
    const formattedAddress = result.formatted_address;
    const standardized = {
      street: addressComponents.formatted_street || `${addressComponents.number || ''} ${addressComponents.street || ''}`.trim(),
      city: addressComponents.city,
      state: addressComponents.state,
      zip: addressComponents.zip,
      county: addressComponents.county,
      country: addressComponents.country,
    };

    console.log("Address verified:", formattedAddress, "Accuracy:", accuracy);

    return new Response(
      JSON.stringify({
        isValid,
        accuracy,
        formattedAddress,
        standardized,
        latitude: location.lat,
        longitude: location.lng,
        message: isValid 
          ? "Address verified successfully" 
          : `Low confidence match (${Math.round(accuracy * 100)}%). Please verify.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in verify-address:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
