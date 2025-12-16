import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 25; // AirROI batch limit

// Normalize listing endpoint response to common format
function normalizeListingResponse(data: any) {
  const performanceMetrics = data.performance_metrics || {};
  const ratings = data.ratings || {};
  const listingInfo = data.listing_info || {};
  const hostInfo = data.host_info || {};
  const comparables = data.comparable_listings || [];
  
  // Calculate market averages from comparable listings
  let marketAvgADR = null;
  let marketAvgOccupancy = null;
  let marketAvgRevenue = null;
  
  if (comparables.length > 0) {
    const validComps = comparables.filter((c: any) => c.performance_metrics?.ttm_revenue > 0);
    if (validComps.length > 0) {
      marketAvgADR = Math.round(
        validComps.reduce((sum: number, c: any) => sum + (c.performance_metrics?.ttm_avg_rate || 0), 0) / validComps.length
      );
      marketAvgOccupancy = 
        validComps.reduce((sum: number, c: any) => sum + (c.performance_metrics?.ttm_occupancy || 0), 0) / validComps.length;
      marketAvgRevenue = Math.round(
        validComps.reduce((sum: number, c: any) => sum + (c.performance_metrics?.ttm_revenue || 0), 0) / validComps.length
      );
    }
  }
  
  return {
    // Actual listing performance
    average_daily_rate: performanceMetrics.ttm_avg_rate || performanceMetrics.l90d_avg_rate,
    occupancy: performanceMetrics.ttm_occupancy || performanceMetrics.l90d_occupancy,
    estimated_annual_revenue: performanceMetrics.ttm_revenue,
    airbnb_rating: ratings.rating_overall,
    review_count: ratings.num_reviews,
    
    // Market estimates from comparables
    market_avg_adr: marketAvgADR,
    market_avg_occupancy: marketAvgOccupancy,
    market_avg_revenue: marketAvgRevenue,
    comparable_count: comparables.length,
    
    data_source: "airroi_listing",
    // Extended fields from listing endpoint
    listing_name: listingInfo.listing_name,
    cover_photo_url: listingInfo.cover_photo_url,
    host_name: hostInfo.host_name,
    superhost: hostInfo.superhost,
    ttm_revpar: performanceMetrics.ttm_revpar,
    l90d_revenue: performanceMetrics.l90d_revenue,
    l90d_avg_rate: performanceMetrics.l90d_avg_rate,
    l90d_occupancy: performanceMetrics.l90d_occupancy,
    monthly_revenue_distributions: data.monthly_revenue_distributions,
  };
}

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

    const body = await req.json();
    const { airbnbListingId, airbnbListingIds, lat, lng, bedrooms, baths, guests, mode } = body;

    // Mode: Monthly metrics for actuals (uses /listings/metrics/all)
    if (airbnbListingId && mode === 'metrics') {
      console.log("Fetching AirROI monthly metrics for ID:", airbnbListingId);
      
      const params = new URLSearchParams({
        id: airbnbListingId,
        currency: 'native',
        num_months: '12',
      });

      const apiUrl = `https://api.airroi.com/listings/metrics/all?${params}`;
      console.log("AirROI Metrics API URL:", apiUrl);
      
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "x-api-key": AIRROI_API_KEY,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AirROI Metrics API error:", response.status, errorText);
        return new Response(
          JSON.stringify({ error: `AirROI API error: ${response.status} - ${errorText}` }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      console.log("AirROI metrics raw response:", JSON.stringify(data));
      
      // Extract monthly data from results array
      const monthlyData = data.results || [];
      
      // Compute TTM rollup
      const ttmRevenue = monthlyData.reduce((sum: number, m: any) => sum + (m.revenue || 0), 0);
      const ttmAvgOccupancy = monthlyData.length > 0 
        ? monthlyData.reduce((sum: number, m: any) => sum + (m.occupancy || 0), 0) / monthlyData.length 
        : 0;
      const ttmAvgADR = monthlyData.length > 0 
        ? monthlyData.reduce((sum: number, m: any) => sum + (m.average_daily_rate || 0), 0) / monthlyData.length 
        : 0;
      
      const result = {
        monthly_metrics: monthlyData.map((m: any) => ({
          date: m.date,
          occupancy: m.occupancy,
          average_daily_rate: m.average_daily_rate,
          rev_par: m.rev_par,
          revenue: m.revenue,
        })),
        ttm_revenue: Math.round(ttmRevenue),
        ttm_avg_occupancy: ttmAvgOccupancy,
        ttm_avg_adr: Math.round(ttmAvgADR),
        data_source: 'airroi_actuals',
      };
      
      console.log("Normalized metrics data:", JSON.stringify(result));

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mode 1: Single listing by ID
    if (airbnbListingId) {
      console.log("Fetching AirROI listing data for ID:", airbnbListingId);
      
      const params = new URLSearchParams({
        id: airbnbListingId,
        currency: 'native',
      });

      const apiUrl = `https://api.airroi.com/listings?${params}`;
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
      console.log("AirROI listing raw response:", JSON.stringify(data));
      
      const result = normalizeListingResponse(data);
      console.log("Normalized listing data:", JSON.stringify(result));

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mode 2: Batch listings by IDs
    if (airbnbListingIds && Array.isArray(airbnbListingIds) && airbnbListingIds.length > 0) {
      console.log("Fetching AirROI batch data for", airbnbListingIds.length, "listings");
      
      const allResults: Record<string, any> = {};
      
      // Process in chunks of BATCH_SIZE
      for (let i = 0; i < airbnbListingIds.length; i += BATCH_SIZE) {
        const chunk = airbnbListingIds.slice(i, i + BATCH_SIZE);
        console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}, IDs:`, chunk);
        
        const response = await fetch("https://api.airroi.com/listings/batch", {
          method: "POST",
          headers: {
            "x-api-key": AIRROI_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ids: chunk,
            currency: "native",
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("AirROI batch API error:", response.status, errorText);
          // Continue processing other batches, mark failed ones
          chunk.forEach(id => {
            allResults[id] = { error: `API error: ${response.status}` };
          });
          continue;
        }

        const data = await response.json();
        console.log("AirROI batch raw response:", JSON.stringify(data));
        
        // Process each listing in the response
        if (data.listings && Array.isArray(data.listings)) {
          data.listings.forEach((listing: any) => {
            const listingId = listing.listing_info?.listing_id || listing.id;
            if (listingId) {
              allResults[listingId] = normalizeListingResponse(listing);
            }
          });
        }
        
        // Also handle if response is an object keyed by ID
        if (typeof data === 'object' && !Array.isArray(data) && !data.listings) {
          Object.entries(data).forEach(([id, listingData]: [string, any]) => {
            allResults[id] = normalizeListingResponse(listingData);
          });
        }
      }

      console.log("Batch results:", JSON.stringify(allResults));

      return new Response(
        JSON.stringify({ results: allResults }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mode 3: Calculator fallback (existing behavior)
    if (!lat || !lng) {
      return new Response(
        JSON.stringify({ error: "Latitude and longitude are required for calculator estimates, or provide airbnbListingId for listing data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Fetching AirROI calculator data for coordinates:", lat, lng, "bedrooms:", bedrooms, "baths:", baths, "guests:", guests);

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
    
    // Extract ADR and occupancy from response
    const adr = data.average_daily_rate || data.adr;
    const occupancy = data.occupancy || data.occupancy_rate;
    
    // Calculate annual revenue: ADR × occupancy × 365
    const annualRevenue = adr && occupancy ? Math.round(adr * occupancy * 365) : null;
    
    // Map AirROI response fields to our format
    const result = {
      average_daily_rate: adr,
      occupancy: occupancy,
      estimated_annual_revenue: annualRevenue,
      monthly_revenue_distributions: data.monthly_revenue_distributions,
      data_source: "airroi_calculator",
    };

    console.log("Successfully fetched AirROI calculator data:", JSON.stringify(result));

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
