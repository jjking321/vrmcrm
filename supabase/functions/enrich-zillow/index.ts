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

    // Format: "220 YOUNG AVE APT 10 COCOA BEACH, FL 32931"
    const fullAddress = `${address} ${city}, ${state} ${zip}`;
    // Replace spaces with + for URL parameter
    const encodedAddress = encodeURIComponent(fullAddress).replace(/%20/g, '+');
    
    const searchUrl = `https://zllw-working-api.p.rapidapi.com/pro/byaddress?propertyaddress=${encodedAddress}`;
    console.log("Fetching Zillow data for:", fullAddress);
    console.log("API URL:", searchUrl);

    const response = await fetch(searchUrl, {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": "zllw-working-api.p.rapidapi.com",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Zillow API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to search Zillow. Check your RapidAPI key." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("Zillow API response:", JSON.stringify(data).substring(0, 500));

    // Check if we got valid data - new API returns data in propertyDetails
    const isSuccess = data.message === "200: Success" || data.propertyDetails;
    if (!data || data.error || !isSuccess) {
      console.log("Property not found on Zillow for:", fullAddress);
      return new Response(
        JSON.stringify({ found: false, error: data?.error || "Property not found on Zillow" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pd = data.propertyDetails || {};
    const result = {
      zpid: pd.zpid,
      zestimate: pd.zestimate,
      rentZestimate: pd.rentZestimate,
      price: pd.price,
      bedrooms: pd.bedrooms,
      bathrooms: pd.bathrooms,
      livingArea: pd.livingAreaSF || pd.livingArea,
      yearBuilt: pd.yearBuilt,
      lotSize: pd.lotSizeSF || pd.lotSize,
      propertyType: pd.homeType || pd.propertyType,
      image: pd.hiResImageLink || pd.imgSrc,
      zillowUrl: data.zillowURL || (pd.zpid ? `https://www.zillow.com/homedetails/${pd.zpid}_zpid/` : null),
      lastSoldPrice: pd.lastSoldPrice,
      lastSoldDate: pd.dateSold || pd.datePosted,
      taxAssessedValue: pd.taxAssessedValue,
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