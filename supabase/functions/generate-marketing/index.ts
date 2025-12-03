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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { property, tone, format } = await req.json();

    if (!property || !tone || !format) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: property, tone, format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formatInstructions: Record<string, string> = {
      email: "Write a compelling email (subject line + body) to the property owner introducing your vacation rental management services.",
      cold_call_script: "Write a cold call script with an opening, key talking points, objection handlers, and a close.",
      direct_mail: "Write direct mail copy suitable for a postcard or letter, with a headline and call-to-action.",
    };

    const toneDescriptions: Record<string, string> = {
      professional: "Use a professional, business-like tone that builds trust and credibility.",
      friendly: "Use a warm, friendly tone that feels personal and approachable.",
      urgent: "Use an urgent tone that creates a sense of time-sensitivity and opportunity.",
    };

    const systemPrompt = `You are an expert vacation rental marketing copywriter. You specialize in writing compelling outreach to property owners for vacation rental management companies.

${toneDescriptions[tone] || toneDescriptions.professional}
${formatInstructions[format] || formatInstructions.email}

Key points to emphasize:
- Your company can maximize their rental income
- Professional management means less hassle for owners
- You have local expertise and proven results
- Reference specific property details when available`;

    const userPrompt = `Write marketing copy for this property:

Property Address: ${property.address}, ${property.city}, ${property.state} ${property.zip}
Bedrooms: ${property.bedrooms}
Bathrooms: ${property.bathrooms}
${property.guests ? `Max Guests: ${property.guests}` : ''}

Owner Name: ${property.owner?.name || 'Property Owner'}
${property.marketData?.projectedRevenue ? `Estimated Annual Revenue: $${property.marketData.projectedRevenue.toLocaleString()}` : ''}
${property.marketData?.adr ? `Average Daily Rate: $${property.marketData.adr}` : ''}
${property.marketData?.occupancyRate ? `Occupancy Rate: ${property.marketData.occupancyRate}%` : ''}
${property.tags?.length ? `Property Features: ${property.tags.join(', ')}` : ''}

Generate the ${format.replace('_', ' ')} now.`;

    console.log("Generating marketing copy for:", property.address);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Usage limit reached. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to generate marketing copy" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const generatedContent = data.choices?.[0]?.message?.content || "";

    console.log("Successfully generated marketing copy");

    return new Response(
      JSON.stringify({ content: generatedContent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-marketing:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
