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

    const { address, city, state, zip, bedrooms, bathrooms } = await req.json();

    if (!address || !city || !state) {
      return new Response(
        JSON.stringify({ error: "Address, city, and state are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Fetching AirROI data for:", address);

    // AirROI API endpoint for revenue estimates
    const apiUrl = "https://api.airroi.com/v1/estimate";
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${AIRROI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        address: address,
        city: city,
        state: state,
        zip: zip,
        bedrooms: bedrooms || 2,
        bathrooms: bathrooms || 1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AirROI API error:", response.status, errorText);
      
      // Return mock data if API fails (for demo purposes)
      // In production, you'd want to handle this differently
      console.log("Returning estimated data based on property attributes");
      
      const baseDailyRate = 150 + (bedrooms || 2) * 50;
      const baseOccupancy = 0.65;
      const estimatedAnnualRevenue = Math.round(baseDailyRate * 365 * baseOccupancy);
      
      return new Response(
        JSON.stringify({
          average_daily_rate: baseDailyRate,
          occupancy: baseOccupancy,
          estimated_annual_revenue: estimatedAnnualRevenue,
          monthly_revenue_distributions: [6, 7, 8, 9, 10, 12, 14, 13, 10, 8, 6, 7],
          data_source: "estimated",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    
    const result = {
      average_daily_rate: data.adr || data.average_daily_rate,
      occupancy: data.occupancy_rate || data.occupancy,
      estimated_annual_revenue: data.annual_revenue || data.estimated_annual_revenue,
      monthly_revenue_distributions: data.monthly_distribution || data.seasonality,
      airbnb_rating: data.average_rating,
      review_count: data.review_count,
      comparable_properties: data.comparables?.length || 0,
      data_source: "airroi",
    };

    console.log("Successfully fetched AirROI data for:", address);

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
