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
    const AIRROI_API_KEY = Deno.env.get("AIRROI_API_KEY");
    if (!AIRROI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AIRROI_API_KEY is not configured. Please add it in Settings." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { lat, lng, bedrooms, baths, guests } = await req.json();

    if (!lat || !lng) {
      return new Response(
        JSON.stringify({ error: "Latitude and longitude are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Fetching AirROI data for coordinates:", lat, lng, "bedrooms:", bedrooms, "baths:", baths, "guests:", guests);

    // Build query parameters for GET request
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      bedrooms: String(bedrooms || 2),
      baths: String(baths || 1),
      guests: String(guests || 4),
      currency: 'native',
    });

    const apiUrl = `https://api.airroi.com/calculator/estimate?${params}`;
    console.log("AirROI API URL:", apiUrl);
    
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "x-api-key": AIRROI_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AirROI API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: `AirROI API error: ${response.status} - ${errorText}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("AirROI raw response:", JSON.stringify(data));
    
    // Map AirROI response fields to our format
    const result = {
      average_daily_rate: data.adr || data.average_daily_rate,
      occupancy: data.occupancy_rate || data.occupancy,
      estimated_annual_revenue: data.annual_revenue || data.estimated_annual_revenue,
      monthly_revenue_distributions: data.monthly_distribution || data.seasonality,
      data_source: "airroi",
    };

    console.log("Successfully fetched AirROI data:", JSON.stringify(result));

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in enrich-airroi:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
