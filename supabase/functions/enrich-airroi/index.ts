import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 25;

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

function normalizeListingResponse(data: any) {
  const performanceMetrics = data.performance_metrics || {};
  const ratings = data.ratings || {};
  const listingInfo = data.listing_info || {};
  const hostInfo = data.host_info || {};
  const comparables = data.comparable_listings || [];
  
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
    average_daily_rate: performanceMetrics.ttm_avg_rate || performanceMetrics.l90d_avg_rate,
    occupancy: performanceMetrics.ttm_occupancy || performanceMetrics.l90d_occupancy,
    estimated_annual_revenue: performanceMetrics.ttm_revenue,
    airbnb_rating: ratings.rating_overall,
    review_count: ratings.num_reviews,
    market_avg_adr: marketAvgADR,
    market_avg_occupancy: marketAvgOccupancy,
    market_avg_revenue: marketAvgRevenue,
    comparable_count: comparables.length,
    data_source: "airroi_listing",
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
    const AIRROI_API_KEY = await getApiKey(req, "airroi", "AIRROI_API_KEY");
    if (!AIRROI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AirROI API key is not configured. Please add it in Settings > Integrations." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { airbnbListingId, airbnbListingIds, lat, lng, bedrooms, baths, guests, mode } = body;

    // Mode: Monthly metrics for actuals
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
        headers: { "x-api-key": AIRROI_API_KEY },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AirROI Metrics API error:", response.status, errorText);
        const errorMessage = response.status === 404 
          ? 'Listing not found in AirROI database. The listing may be new or not yet indexed.'
          : `AirROI API error: ${response.status}`;
        return new Response(
          JSON.stringify({ error: errorMessage, status: response.status }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      console.log("AirROI metrics raw response:", JSON.stringify(data));
      
      const monthlyData = data.results || [];
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
        headers: { "x-api-key": AIRROI_API_KEY },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AirROI API error:", response.status, errorText);
        const errorMessage = response.status === 404 
          ? 'Listing not found in AirROI database. The listing may be new or not yet indexed.'
          : `AirROI API error: ${response.status}`;
        return new Response(
          JSON.stringify({ error: errorMessage, status: response.status }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
            listing_ids: chunk,
            currency: "native",
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("AirROI batch API error:", response.status, errorText);
          chunk.forEach(id => {
            allResults[id] = { error: `API error: ${response.status}` };
          });
          continue;
        }

        const data = await response.json();
        console.log("AirROI batch raw response:", JSON.stringify(data));
        
        if (data.results && Array.isArray(data.results)) {
          data.results.forEach((listing: any) => {
            const returnedId = listing.listing_info?.listing_id?.toString() || '';
            const originalId = chunk.find(id => 
              id === returnedId || 
              id.startsWith(returnedId.slice(0, 15)) ||
              returnedId.startsWith(id.slice(0, 15))
            );
            if (originalId && listing.listing_info) {
              allResults[originalId] = normalizeListingResponse(listing);
            }
          });
        }
        
        if (data.errors && Array.isArray(data.errors)) {
          data.errors.forEach((error: any) => {
            const errorId = error.listing_id?.toString() || error.id?.toString();
            const matchingOriginalId = chunk.find(id => 
              id === errorId || 
              id.startsWith(errorId?.slice(0, 15)) ||
              errorId?.startsWith(id.slice(0, 15))
            );
            if (matchingOriginalId) {
              allResults[matchingOriginalId] = { error: error.message || 'Listing not found' };
            }
          });
        }
      }

      console.log("Batch results:", JSON.stringify(allResults));

      return new Response(
        JSON.stringify({ results: allResults }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mode 3: Calculator fallback
    if (!lat || !lng) {
      return new Response(
        JSON.stringify({ error: "Latitude and longitude are required for calculator estimates, or provide airbnbListingId for listing data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Fetching AirROI calculator data for coordinates:", lat, lng, "bedrooms:", bedrooms, "baths:", baths, "guests:", guests);

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
      headers: { "x-api-key": AIRROI_API_KEY },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AirROI API error:", response.status, errorText);
      const errorMessage = response.status === 404 
        ? 'No market data available for this location.'
        : `AirROI API error: ${response.status}`;
      return new Response(
        JSON.stringify({ error: errorMessage, status: response.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("AirROI raw response:", JSON.stringify(data));
    
    const adr = data.average_daily_rate || data.adr;
    const occupancy = data.occupancy || data.occupancy_rate;
    const annualRevenue = adr && occupancy ? Math.round(adr * occupancy * 365) : null;
    
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
