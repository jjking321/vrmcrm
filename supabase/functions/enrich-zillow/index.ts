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

    // Search for property
    const searchUrl = `https://zillow-com1.p.rapidapi.com/propertyExtendedSearch?location=${encodeURIComponent(fullAddress)}&home_type=Houses`;
    
    const searchResponse = await fetch(searchUrl, {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": "zillow-com1.p.rapidapi.com",
      },
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error("Zillow search error:", searchResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to search Zillow. Check your RapidAPI key." }),
        { status: searchResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const searchData = await searchResponse.json();
    
    if (!searchData.props || searchData.props.length === 0) {
      console.log("Property not found on Zillow for:", fullAddress);
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
