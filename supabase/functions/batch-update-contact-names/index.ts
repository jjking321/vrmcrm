import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateRecord {
  address: string;
  ownerLastName: string;
  contactName: string;
}

interface UpdateResult {
  address: string;
  ownerLastName: string;
  contactName: string;
  status: "updated" | "not_found" | "error";
  message?: string;
}

// Normalize address for matching - strips unit variations and normalizes spacing
function normalizeAddress(address: string): string {
  return address
    .toUpperCase()
    .replace(/,/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*(#|APT|UNIT|SUITE|STE)\s*/g, ' UNIT ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract base address (street number and name) for matching
function getBaseAddress(address: string): string {
  const normalized = normalizeAddress(address);
  // Remove unit number portion for base matching
  const unitMatch = normalized.match(/^(.+?)\s*UNIT\s*\S+$/);
  return unitMatch ? unitMatch[1].trim() : normalized;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { records } = await req.json() as { records: UpdateRecord[] };

    if (!records || !Array.isArray(records) || records.length === 0) {
      return new Response(
        JSON.stringify({ error: "records array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${records.length} records for contact name updates`);

    const results: UpdateResult[] = [];
    let matched = 0;
    let updated = 0;
    let notFound = 0;
    let errors = 0;

    // Fetch all properties and owners for matching
    const { data: properties, error: propError } = await supabase
      .from("properties")
      .select("id, address, city");

    if (propError) {
      console.error("Error fetching properties:", propError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch properties", details: propError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: owners, error: ownerError } = await supabase
      .from("owners")
      .select("id, property_id, owners, name");

    if (ownerError) {
      console.error("Error fetching owners:", ownerError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch owners", details: ownerError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create lookup maps
    const propertyMap = new Map<string, { id: string; address: string; city: string }>();
    for (const prop of properties || []) {
      const baseAddr = getBaseAddress(prop.address);
      propertyMap.set(baseAddr, prop);
      // Also store with full normalized address
      propertyMap.set(normalizeAddress(prop.address), prop);
    }

    const ownerByPropertyId = new Map<string, typeof owners[0]>();
    for (const owner of owners || []) {
      ownerByPropertyId.set(owner.property_id, owner);
    }

    // Process each record
    for (const record of records) {
      if (!record.address || !record.contactName) {
        results.push({
          ...record,
          status: "error",
          message: "Missing address or contactName"
        });
        errors++;
        continue;
      }

      const baseAddr = getBaseAddress(record.address);
      const fullAddr = normalizeAddress(record.address);
      
      // Try to find matching property
      let matchedProperty = propertyMap.get(fullAddr) || propertyMap.get(baseAddr);
      
      // If not found, try fuzzy matching on base address
      if (!matchedProperty) {
        for (const [key, prop] of propertyMap.entries()) {
          if (key.startsWith(baseAddr) || baseAddr.startsWith(key.split(' UNIT')[0])) {
            matchedProperty = prop;
            break;
          }
        }
      }

      // Try to find owner record - first by address match, then by owner name only
      let ownerRecord: typeof owners[0] | undefined;
      
      if (matchedProperty) {
        ownerRecord = ownerByPropertyId.get(matchedProperty.id);
      }
      
      // If no address match or no owner for that property, try matching by owner last name only
      if (!ownerRecord && record.ownerLastName) {
        const ownerLastNameUpper = record.ownerLastName.toUpperCase().trim();
        
        for (const owner of owners || []) {
          const ownersArray = owner.owners as any[] | null;
          const firstOwnerLastName = (ownersArray?.[0]?.lastName || '').toUpperCase().trim();
          const ownerName = (owner.name || '').toUpperCase().trim();
          
          // Check if last name matches (allow partial matches for long trust names)
          const lastNameMatches = 
            (firstOwnerLastName && (
              firstOwnerLastName.includes(ownerLastNameUpper) ||
              ownerLastNameUpper.includes(firstOwnerLastName)
            )) ||
            (ownerName && (
              ownerName.includes(ownerLastNameUpper) ||
              ownerLastNameUpper.includes(ownerName)
            ));
          
          if (lastNameMatches) {
            ownerRecord = owner;
            console.log(`Matched by owner name only: "${record.ownerLastName}" -> owner id ${owner.id}, name="${ownerName || firstOwnerLastName}"`);
            break;
          }
        }
      }
      
      if (!ownerRecord) {
        results.push({
          ...record,
          status: "not_found",
          message: `No match found for address: ${record.address}, owner: ${record.ownerLastName}`
        });
        notFound++;
        continue;
      }

      matched++;

      // Update the contact_name field
      const { error: updateError } = await supabase
        .from("owners")
        .update({ contact_name: record.contactName })
        .eq("id", ownerRecord.id);

      if (updateError) {
        results.push({
          ...record,
          status: "error",
          message: `Update failed: ${updateError.message}`
        });
        errors++;
      } else {
        results.push({
          ...record,
          status: "updated"
        });
        updated++;
      }
    }

    console.log(`Batch update complete: ${updated} updated, ${notFound} not found, ${errors} errors`);

    return new Response(
      JSON.stringify({
        total: records.length,
        matched,
        updated,
        notFound,
        errors,
        results: results.filter(r => r.status !== "updated").slice(0, 50) // Return non-success results for debugging
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in batch-update-contact-names:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
