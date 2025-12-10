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
    
    // Log available keys to debug field names
    console.log("PropertyDetails keys:", Object.keys(pd).join(", "));
    console.log("Bedrooms field check - bedrooms:", pd.bedrooms, "beds:", pd.beds, "resoFacts?.bedrooms:", pd.resoFacts?.bedrooms);
    console.log("Bathrooms field check - bathrooms:", pd.bathrooms, "baths:", pd.baths, "resoFacts?.bathrooms:", pd.resoFacts?.bathrooms);
    console.log("Image field check - hiResImageLink:", pd.hiResImageLink, "imgSrc:", pd.imgSrc, "originalPhotos:", pd.originalPhotos?.length, "thumb:", pd.thumb);
    
    // Helper function to check if URL is a valid property image (not Google Maps)
    const isGoogleMapsUrl = (url: string | undefined): boolean => {
      if (!url || typeof url !== 'string') return false;
      return url.includes('maps.googleapis.com');
    };
    
    // Helper to extract URL from various formats (string, object with url, array of objects)
    const extractUrl = (source: any): string | null => {
      if (!source) return null;
      if (typeof source === 'string') return source;
      if (Array.isArray(source) && source.length > 0) {
        return source[0]?.url || null;
      }
      if (source.url) return source.url;
      return null;
    };
    
    // Check multiple image sources in order of preference
    let validImage: string | null = null;
    let streetViewUrl: string | null = null;
    
    // 1. Try originalPhotos array first (actual property photos - highest quality)
    if (pd.originalPhotos && Array.isArray(pd.originalPhotos) && pd.originalPhotos.length > 0) {
      for (const photo of pd.originalPhotos) {
        // originalPhotos can have nested structure with mixedSources
        if (photo.mixedSources?.jpeg && photo.mixedSources.jpeg.length > 0) {
          const jpegs = photo.mixedSources.jpeg;
          const jpegUrl = jpegs[jpegs.length - 1]?.url || jpegs[0]?.url;
          if (jpegUrl && !isGoogleMapsUrl(jpegUrl)) {
            validImage = jpegUrl;
            console.log("Found valid originalPhotos jpeg image:", validImage);
            break;
          } else if (jpegUrl && isGoogleMapsUrl(jpegUrl) && !streetViewUrl) {
            streetViewUrl = jpegUrl;
          }
        } else if (photo.url) {
          if (!isGoogleMapsUrl(photo.url)) {
            validImage = photo.url;
            console.log("Found valid originalPhotos image:", validImage);
            break;
          } else if (!streetViewUrl) {
            streetViewUrl = photo.url;
          }
        }
      }
    }
    
    // 2. Try thumb (can be string, object, or array)
    if (!validImage) {
      const thumbUrl = extractUrl(pd.thumb);
      if (thumbUrl && !isGoogleMapsUrl(thumbUrl)) {
        validImage = thumbUrl;
        console.log("Using thumb image:", validImage);
      } else if (thumbUrl && isGoogleMapsUrl(thumbUrl) && !streetViewUrl) {
        streetViewUrl = thumbUrl;
        console.log("Thumb is Google Maps, saving for Street View capture");
      }
    }
    
    // 3. Try imgSrc
    if (!validImage && pd.imgSrc) {
      if (!isGoogleMapsUrl(pd.imgSrc)) {
        validImage = pd.imgSrc;
        console.log("Using imgSrc image:", validImage);
      } else if (!streetViewUrl) {
        streetViewUrl = pd.imgSrc;
      }
    }
    
    // 4. Try hiResImageLink
    if (!validImage && pd.hiResImageLink) {
      if (!isGoogleMapsUrl(pd.hiResImageLink)) {
        validImage = pd.hiResImageLink;
        console.log("Using hiResImageLink image:", validImage);
      } else if (!streetViewUrl) {
        streetViewUrl = pd.hiResImageLink;
        console.log("hiResImageLink is Google Maps, saving for Street View capture:", streetViewUrl);
      }
    }
    
    // 5. Check streetViewImageUrl field as another source
    if (!validImage && !streetViewUrl && pd.streetViewImageUrl) {
      streetViewUrl = pd.streetViewImageUrl;
      console.log("Using streetViewImageUrl for capture:", streetViewUrl);
    }
    
    console.log("Final image decision - validImage:", validImage, "streetViewUrl:", streetViewUrl);
    
    const result = {
      zpid: pd.zpid,
      zestimate: pd.zestimate,
      rentZestimate: pd.rentZestimate,
      price: pd.price,
      bedrooms: pd.bedrooms || pd.beds || pd.resoFacts?.bedrooms,
      bathrooms: pd.bathrooms || pd.baths || pd.resoFacts?.bathrooms,
      livingArea: pd.livingAreaSF || pd.livingArea || pd.resoFacts?.livingArea,
      yearBuilt: pd.yearBuilt || pd.resoFacts?.yearBuilt,
      lotSize: pd.lotSizeSF || pd.lotSize || pd.resoFacts?.lotSize,
      propertyType: pd.homeType || pd.propertyType || pd.homeStatus,
      image: validImage,
      streetViewUrl: streetViewUrl, // For frontend to trigger capture if needed
      zillowUrl: data.zillowURL || (pd.zpid ? `https://www.zillow.com/homedetails/${pd.zpid}_zpid/` : null),
      lastSoldPrice: pd.lastSoldPrice,
      lastSoldDate: pd.dateSold || pd.datePosted,
      taxAssessedValue: pd.taxAssessedValue,
    };

    console.log("Extracted result:", JSON.stringify(result));
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