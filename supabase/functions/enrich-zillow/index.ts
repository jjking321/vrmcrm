import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to search Zillow
async function searchZillow(location: string, apiKey: string) {
  const searchUrl = `https://zillow-com1.p.rapidapi.com/propertyExtendedSearch?location=${encodeURIComponent(location)}`;
  console.log("Zillow search URL:", searchUrl);
  
  const response = await fetch(searchUrl, {
    method: "GET",
    headers: {
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": "zillow-com1.p.rapidapi.com",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Zillow search error:", response.status, errorText);
    return { props: [] };
  }

  return await response.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY");
    if (!RAPIDAPI_KEY) {
      return new Response(
        JSON.stringify({ error: "RAPIDAPI_KEY is not configured. Please add it in Settings." }),
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

    const fullAddress = `${address}, ${city}, ${state} ${zip}`;
    console.log("Fetching Zillow data for:", fullAddress);

    // Try searching with the full address first
    let searchData = await searchZillow(fullAddress, RAPIDAPI_KEY);
    
    // If not found and address contains APT/UNIT/etc., try without it
    if ((!searchData.props || searchData.props.length === 0) && /\s+(APT|UNIT|STE|#)\s*\d*/i.test(address)) {
      const baseAddress = address.replace(/\s+(APT|UNIT|STE|#)\s*\d*/i, '').trim();
      const simpleAddress = `${baseAddress}, ${city}, ${state} ${zip}`;
      console.log("Trying simplified address:", simpleAddress);
      searchData = await searchZillow(simpleAddress, RAPIDAPI_KEY);
    }
    
    // If still not found, try just city/state search
    if (!searchData.props || searchData.props.length === 0) {
      console.log("Property not found on Zillow for:", fullAddress);
      console.log("API response:", JSON.stringify(searchData));
      return new Response(
        JSON.stringify({ found: false, error: "Property not found on Zillow" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const property = searchData.props[0];
    
    // Get detailed property info
    let detailData = null;
    if (property.zpid) {
      try {
        const detailUrl = `https://zillow-com1.p.rapidapi.com/property?zpid=${property.zpid}`;
        const detailResponse = await fetch(detailUrl, {
          method: "GET",
          headers: {
            "X-RapidAPI-Key": RAPIDAPI_KEY,
            "X-RapidAPI-Host": "zillow-com1.p.rapidapi.com",
          },
        });
        
        if (detailResponse.ok) {
          detailData = await detailResponse.json();
        }
      } catch (e) {
        console.error("Error fetching property details:", e);
      }
    }

    const result = {
      zpid: property.zpid,
      zestimate: property.zestimate || detailData?.zestimate,
      rentZestimate: property.rentZestimate || detailData?.rentZestimate,
      price: property.price,
      bedrooms: property.bedrooms || detailData?.bedrooms,
      bathrooms: property.bathrooms || detailData?.bathrooms,
      livingArea: property.livingArea || detailData?.livingArea,
      yearBuilt: detailData?.yearBuilt,
      lotSize: detailData?.lotSize,
      propertyType: property.propertyType || detailData?.homeType,
      image: property.imgSrc || detailData?.imgSrc,
      zillowUrl: property.detailUrl || `https://www.zillow.com/homedetails/${property.zpid}_zpid/`,
      lastSoldPrice: detailData?.lastSoldPrice,
      lastSoldDate: detailData?.dateSold,
      taxAssessedValue: detailData?.taxAssessedValue,
    };

    console.log("Successfully fetched Zillow data for:", address);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in enrich-zillow:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
