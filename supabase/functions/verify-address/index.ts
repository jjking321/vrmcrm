import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getApiKey(req: Request, serviceName: string, envVarName: string): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (authHeader && supabaseUrl && serviceRoleKey) {
    try {
      const token = authHeader.replace("Bearer ", "");
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "", {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      
      if (user) {
        const adminClient = createClient(supabaseUrl, serviceRoleKey);
        const { data: profile } = await adminClient
          .from("profiles")
          .select("company_id")
          .eq("id", user.id)
          .single();
        
        if (profile?.company_id) {
          const { data: keyRow } = await adminClient
            .from("company_api_keys")
            .select("api_key")
            .eq("company_id", profile.company_id)
            .eq("service_name", serviceName)
            .single();
          
          if (keyRow?.api_key) {
            console.log(`Using company-level ${serviceName} API key`);
            return keyRow.api_key;
          }
        }
      }
    } catch (e) {
      console.log(`Could not fetch company API key for ${serviceName}, falling back to env var:`, e);
    }
  }

  return Deno.env.get(envVarName) || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEOCODIO_API_KEY = await getApiKey(req, "geocodio", "GEOCODIO_API_KEY");
    if (!GEOCODIO_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Geocodio API key is not configured. Please add it in Settings > Integrations." }),
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

    const isValid = accuracy >= 0.8;
    const formattedAddress = result.formatted_address;
    
    const streetNumber = addressComponents.number || '';
    const streetName = addressComponents.formatted_street || addressComponents.street || '';
    const unitType = addressComponents.secondaryunit || '';
    const unitNumber = addressComponents.secondarynumber || '';
    
    let fullStreet = `${streetNumber} ${streetName}`.trim();
    if (unitType && unitNumber) {
      fullStreet += `, ${unitType} ${unitNumber}`;
    } else if (unitNumber) {
      fullStreet += `, # ${unitNumber}`;
    }
    
    const standardized = {
      street: fullStreet,
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
