import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { parseFullAddress } from '@/lib/addressParser';
import { 
  isCanadianAddress, 
  parseCanadianAddress, 
  containsCanadianPostalCode,
  validProvinceAbbrs 
} from '@/lib/canadianAddressParser';

export interface MalformedMailingAddress {
  ownerId: string;
  propertyId: string;
  mailingAddress: string;
  mailingCity: string;
  mailingState: string;
  mailingZip: string;
  propertyAddress: string; // For context
  propertyCity: string;
  propertyState: string;
  isCanadian?: boolean; // Flag for Canadian addresses
}

export interface FixMailingAddressesResult {
  fixed: number;
  failed: MalformedMailingAddress[];
  locallyParsed: number;
  geocodioFixed: number;
}

// Valid US state abbreviations
const validStateAbbrs = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
]);

// Helper: Title Case conversion
function toTitleCase(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    // Keep common abbreviations uppercase
    .replace(/\b(Nw|Ne|Sw|Se|Po|Apt|Ste|Fl)\b/gi, (match) => match.toUpperCase())
    .replace(/\b(Ii|Iii|Iv)\b/gi, (match) => match.toUpperCase());
}

// Street suffixes that are also state abbreviations - must not be treated as states
// when they appear at the end of an address without a ZIP code
const streetSuffixesMatchingStates = new Set([
  'CT',  // Court (also Connecticut)
  'NE',  // Northeast (also Nebraska)  
  'NV',  // Not common but could appear
  'AL',  // Alley (also Alabama)
  'IN',  // Not common suffix but could be confused
]);

// Common street directional suffixes
const directionalSuffixes = new Set(['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW']);

/**
 * Check if a mailing address field contains embedded city/state/zip
 * that differs from the stored city/state/zip values.
 * Unlike isFullAddressField(), this checks REGARDLESS of whether city/state are populated.
 * Also detects Canadian addresses with embedded postal codes.
 */
function hasEmbeddedAddressData(
  mailingAddress: string,
  storedCity: string,
  storedState: string,
  storedZip: string
): { hasMalformed: boolean; isCanadian: boolean } {
  if (!mailingAddress) return { hasMalformed: false, isCanadian: false };
  
  const addr = mailingAddress.trim();
  
  // Check for Canadian address first
  if (isCanadianAddress(addr) || containsCanadianPostalCode(addr)) {
    // If it has a Canadian postal code embedded, it needs parsing
    const parsed = parseCanadianAddress(addr);
    if (parsed.isValid) {
      return { hasMalformed: true, isCanadian: true };
    }
    // Even if parsing failed, if it has a Canadian postal code, flag it
    if (containsCanadianPostalCode(addr)) {
      return { hasMalformed: true, isCanadian: true };
    }
  }
  
  // Pattern 1: Check for "STATE ZIP" at end (e.g., "135 E 54TH ST NEW YORK, NY 10022")
  // This is the most reliable pattern - if there's a ZIP code, it's definitely an address
  const stateZipPattern = /\b([A-Z]{2})\s+(\d{5})(?:-\d{4})?\s*$/i;
  const stateZipMatch = addr.match(stateZipPattern);
  
  if (stateZipMatch) {
    const embeddedState = stateZipMatch[1].toUpperCase();
    const embeddedZip = stateZipMatch[2];
    
    if (validStateAbbrs.has(embeddedState)) {
      // Found embedded state+zip - check if it differs from stored values
      const storedStateNorm = storedState?.trim().toUpperCase() || '';
      const storedZipNorm = storedZip?.trim().slice(0, 5) || '';
      
      // If embedded values differ from stored, it's malformed
      if (embeddedState !== storedStateNorm || embeddedZip !== storedZipNorm) {
        return { hasMalformed: true, isCanadian: false };
      }
      
      // Even if they match, if the address has a comma (city embedded), it's malformed
      if (addr.includes(',')) {
        return { hasMalformed: true, isCanadian: false };
      }
    }
  }
  
  // Pattern 2: Check for comma-delimited full address (e.g., "123 Main St, City, NY 10022")
  if (addr.includes(',')) {
    const parsed = parseFullAddress(addr);
    if (parsed.isValid && parsed.city && parsed.state) {
      const parsedCityLower = parsed.city.toLowerCase().trim();
      const storedCityLower = storedCity?.toLowerCase().trim() || '';
      const parsedStateLower = parsed.state.toLowerCase().trim();
      const storedStateLower = storedState?.toLowerCase().trim() || '';
      
      // If parsed city/state differs from stored, it's malformed
      if (parsedCityLower !== storedCityLower || parsedStateLower !== storedStateLower) {
        return { hasMalformed: true, isCanadian: false };
      }
    }
  }
  
  // Pattern 3: Check for STATE at end without ZIP - BUT be careful about street suffixes!
  // Only flag if it's likely a state, not a street suffix like CT (Court) or NE (Northeast)
  // Skip this check entirely - too many false positives with street suffixes
  // We only reliably detect embedded addresses when there's a ZIP code or comma delimiter
  
  return { hasMalformed: false, isCanadian: false };
}

// Try to parse a mailing address locally (handles both US and Canadian)
export function tryLocalMailingParse(address: MalformedMailingAddress): { 
  success: boolean; 
  parsed: { street: string; city: string; state: string; zip: string };
  isCanadian: boolean;
} {
  // Try Canadian parsing first if it looks like a Canadian address
  if (address.isCanadian || isCanadianAddress(address.mailingAddress) || containsCanadianPostalCode(address.mailingAddress)) {
    const canadianParsed = parseCanadianAddress(address.mailingAddress);
    if (canadianParsed.isValid) {
      return {
        success: true,
        parsed: {
          street: canadianParsed.street,
          city: canadianParsed.city,
          state: canadianParsed.province,
          zip: canadianParsed.postalCode,
        },
        isCanadian: true,
      };
    }
  }
  
  // Try US parsing
  const parsed = parseFullAddress(address.mailingAddress);
  
  if (parsed.isValid && parsed.city && parsed.state && parsed.zip) {
    return {
      success: true,
      parsed: {
        street: toTitleCase(parsed.street),
        city: toTitleCase(parsed.city),
        state: parsed.state.toUpperCase(),
        zip: parsed.zip,
      },
      isCanadian: false,
    };
  }
  
  return { 
    success: false, 
    parsed: { street: '', city: '', state: '', zip: '' },
    isCanadian: false,
  };
}

// Query to find owners with malformed mailing addresses
export function useMalformedMailingAddresses() {
  const { company } = useAuth();

  return useQuery({
    queryKey: ['malformed-mailing-addresses', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];

      // Fetch all owners with their property info
      const { data: owners, error } = await supabase
        .from('owners')
        .select(`
          id,
          property_id,
          mailing_address,
          mailing_city,
          mailing_state,
          mailing_zip,
          properties!inner (
            address,
            city,
            state
          )
        `)
        .eq('company_id', company.id)
        .not('mailing_address', 'is', null)
        .neq('mailing_address', '');

      if (error) throw error;

      // Filter to find malformed addresses where the mailing_address field
      // contains embedded city/state/zip that should be split out
      const malformed: MalformedMailingAddress[] = [];

      for (const owner of owners || []) {
        const mailingAddress = owner.mailing_address || '';
        const mailingCity = owner.mailing_city || '';
        const mailingState = owner.mailing_state || '';
        const mailingZip = owner.mailing_zip || '';
        
        const property = owner.properties as any;
        const propertyCity = property?.city || '';
        const propertyState = property?.state || '';

        // Check if this looks like a full address with embedded city/state/zip
        const { hasMalformed, isCanadian } = hasEmbeddedAddressData(mailingAddress, mailingCity, mailingState, mailingZip);
        if (hasMalformed) {
          malformed.push({
            ownerId: owner.id,
            propertyId: owner.property_id,
            mailingAddress: mailingAddress,
            mailingCity: mailingCity,
            mailingState: mailingState,
            mailingZip: mailingZip,
            propertyAddress: property?.address || '',
            propertyCity: propertyCity,
            propertyState: propertyState,
            isCanadian: isCanadian,
          });
        }
      }

      return malformed;
    },
    enabled: !!company?.id,
  });
}

// Hook to update a single owner's mailing address
export function useUpdateOwnerMailingAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (update: { 
      ownerId: string; 
      mailingAddress: string; 
      mailingCity: string; 
      mailingState: string; 
      mailingZip: string;
    }) => {
      const { error } = await supabase
        .from('owners')
        .update({
          mailing_address: update.mailingAddress,
          mailing_city: update.mailingCity,
          mailing_state: update.mailingState,
          mailing_zip: update.mailingZip,
        })
        .eq('id', update.ownerId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owners'] });
      queryClient.invalidateQueries({ queryKey: ['malformed-mailing-addresses'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });
}

// Hook to apply local parse result
export function useApplyLocalMailingParse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ownerId, parsed }: { 
      ownerId: string; 
      parsed: { street: string; city: string; state: string; zip: string } 
    }) => {
      const { error } = await supabase
        .from('owners')
        .update({
          mailing_address: parsed.street,
          mailing_city: parsed.city,
          mailing_state: parsed.state,
          mailing_zip: parsed.zip,
        })
        .eq('id', ownerId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owners'] });
      queryClient.invalidateQueries({ queryKey: ['malformed-mailing-addresses'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });
}

// Hook to fix a single mailing address via Geocodio
export function useFixSingleMailingAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (address: MalformedMailingAddress) => {
      const { data, error } = await supabase.functions.invoke('verify-address-batch', {
        body: { 
          addresses: [{ 
            address: address.mailingAddress, 
            city: '', 
            state: '', 
            zip: '', 
            index: 0 
          }] 
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Failed to verify address');
      }

      const result = data.results?.[0];
      if (!result?.success || !result?.standardized?.city || !result?.standardized?.state || !result?.standardized?.zip) {
        throw new Error('Geocodio could not parse this address');
      }

      // Update owner in database with title case
      const { error: updateError } = await supabase
        .from('owners')
        .update({
          mailing_address: toTitleCase(result.standardized.street),
          mailing_city: toTitleCase(result.standardized.city),
          mailing_state: result.standardized.state.toUpperCase(),
          mailing_zip: result.standardized.zip,
        })
        .eq('id', address.ownerId);

      if (updateError) throw updateError;
      
      return {
        street: toTitleCase(result.standardized.street),
        city: toTitleCase(result.standardized.city),
        state: result.standardized.state,
        zip: result.standardized.zip,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owners'] });
      queryClient.invalidateQueries({ queryKey: ['malformed-mailing-addresses'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });
}

// Hook to batch fix all malformed mailing addresses
export function useFixMailingAddresses() {
  const { company } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (addresses: MalformedMailingAddress[]): Promise<FixMailingAddressesResult> => {
      if (!company?.id || addresses.length === 0) {
        return { fixed: 0, failed: [], locallyParsed: 0, geocodioFixed: 0 };
      }

      const toastId = toast.loading(`Processing ${addresses.length} mailing addresses...`);

      // Step 1: Try local parsing first
      const locallyParsed: { addr: MalformedMailingAddress; parsed: { street: string; city: string; state: string; zip: string } }[] = [];
      const needsGeocoding: MalformedMailingAddress[] = [];

      for (const addr of addresses) {
        const { success, parsed } = tryLocalMailingParse(addr);
        if (success) {
          locallyParsed.push({ addr, parsed });
        } else {
          needsGeocoding.push(addr);
        }
      }

      toast.loading(`Local parse: ${locallyParsed.length} parseable, ${needsGeocoding.length} need Geocodio...`, { id: toastId });

      // Step 2: Update locally parsed addresses in DB
      let localFixed = 0;
      const CHUNK_SIZE = 50;

      for (let i = 0; i < locallyParsed.length; i += CHUNK_SIZE) {
        const chunk = locallyParsed.slice(i, i + CHUNK_SIZE);
        await Promise.all(
          chunk.map(async ({ addr, parsed }) => {
            const { error } = await supabase
              .from('owners')
              .update({
                mailing_address: parsed.street,
                mailing_city: parsed.city,
                mailing_state: parsed.state,
                mailing_zip: parsed.zip,
              })
              .eq('id', addr.ownerId);
            if (!error) localFixed++;
          })
        );
      }

      // Step 3: Send remaining to Geocodio
      let geocodioFixed = 0;
      const failed: MalformedMailingAddress[] = [];

      if (needsGeocoding.length > 0) {
        toast.loading(`Sending ${needsGeocoding.length} to Geocodio...`, { id: toastId });

        const addressesToVerify = needsGeocoding.map((addr, idx) => ({
          address: addr.mailingAddress,
          city: '',
          state: '',
          zip: '',
          index: idx,
        }));

        const { data, error } = await supabase.functions.invoke('verify-address-batch', {
          body: { addresses: addressesToVerify },
        });

        if (error || data?.error) {
          toast.error(data?.error || error?.message || 'Failed to verify addresses', { id: toastId });
          return { fixed: localFixed, failed: needsGeocoding, locallyParsed: localFixed, geocodioFixed: 0 };
        }

        const results = data.results || [];

        for (let i = 0; i < results.length; i += CHUNK_SIZE) {
          const chunk = results.slice(i, i + CHUNK_SIZE);

          await Promise.all(
            chunk.map(async (result: any) => {
              const addr = needsGeocoding[result.index];

              if (result.success && result.standardized &&
                  result.standardized.city && result.standardized.state && result.standardized.zip) {
                const { error: updateError } = await supabase
                  .from('owners')
                  .update({
                    mailing_address: toTitleCase(result.standardized.street),
                    mailing_city: toTitleCase(result.standardized.city),
                    mailing_state: result.standardized.state.toUpperCase(),
                    mailing_zip: result.standardized.zip,
                  })
                  .eq('id', addr.ownerId);

                if (!updateError) {
                  geocodioFixed++;
                } else {
                  failed.push(addr);
                }
              } else {
                failed.push(addr);
              }
            })
          );
        }
      }

      const totalFixed = localFixed + geocodioFixed;

      if (failed.length > 0) {
        toast.warning(`Fixed ${totalFixed} (${localFixed} local, ${geocodioFixed} Geocodio), ${failed.length} failed`, { id: toastId });
      } else {
        toast.success(`Fixed all ${totalFixed} mailing addresses (${localFixed} local, ${geocodioFixed} Geocodio)`, { id: toastId });
      }

      return { fixed: totalFixed, failed, locallyParsed: localFixed, geocodioFixed };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owners'] });
      queryClient.invalidateQueries({ queryKey: ['malformed-mailing-addresses'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });
}
