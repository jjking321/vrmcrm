import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AddressInput {
  address: string;
  city: string;
  state: string;
  zip: string;
  index: number;
}

interface StandardizedResult {
  index: number;
  success: boolean;
  standardized?: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEOCODIO_API_KEY = Deno.env.get("GEOCODIO_API_KEY");
    if (!GEOCODIO_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GEOCODIO_API_KEY is not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { addresses } = await req.json() as { addresses: AddressInput[] };

    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return new Response(
        JSON.stringify({ error: "addresses array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Batch verifying ${addresses.length} addresses`);

    // Geocodio batch API supports up to 10,000 addresses per request
    // Format addresses for batch request
    const formattedAddresses = addresses.map(a => 
      [a.address, a.city, a.state, a.zip].filter(Boolean).join(", ")
    );

    const geocodioUrl = `https://api.geocod.io/v1.7/geocode?api_key=${GEOCODIO_API_KEY}`;
    
    const response = await fetch(geocodioUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formattedAddresses),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Geocodio batch API error:", response.status, errorText);
      
      // Try to extract specific error message from Geocodio
      let errorMessage = "Batch address verification failed";
      let errorCode = "GEOCODIO_ERROR";
      
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error) {
          errorMessage = errorJson.error;
          if (errorMessage.includes("exceeded the free tier")) {
            errorCode = "QUOTA_EXCEEDED";
          }
        }
      } catch {
        // If not JSON, use the raw error text if available
        if (errorText && errorText.length < 200) {
          errorMessage = errorText;
        }
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage, code: errorCode }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const results: StandardizedResult[] = [];

    // Process each result, matching back to original indices
    if (data.results && Array.isArray(data.results)) {
      data.results.forEach((item: any, idx: number) => {
        const originalIndex = addresses[idx].index;
        
        if (!item.response || !item.response.results || item.response.results.length === 0) {
          results.push({
            index: originalIndex,
            success: false,
            error: "Address could not be verified",
          });
          return;
        }

        const result = item.response.results[0];
        const accuracy = result.accuracy;
        const addressComponents = result.address_components;
        const location = result.location;

        // Only consider valid if accuracy >= 0.8
        if (accuracy < 0.8) {
          results.push({
            index: originalIndex,
            success: false,
            accuracy,
            error: `Low confidence match (${Math.round(accuracy * 100)}%)`,
          });
          return;
        }

        // Build full street address
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

        results.push({
          index: originalIndex,
          success: true,
          accuracy,
          standardized: {
            street: fullStreet,
            city: addressComponents.city,
            state: addressComponents.state,
            zip: addressComponents.zip,
          },
          latitude: location.lat,
          longitude: location.lng,
        });
      });
    }

    console.log(`Batch verification complete: ${results.filter(r => r.success).length}/${addresses.length} successful`);

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in verify-address-batch:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
