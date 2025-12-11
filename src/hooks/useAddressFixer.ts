import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { parseFullAddress } from '@/lib/addressParser';

export interface MalformedProperty {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

export interface FixAddressesResult {
  fixed: number;
  failed: MalformedProperty[];
  locallyParsed: number;
  geocodioFixed: number;
}

export function useMalformedAddresses() {
  const { company } = useAuth();

  return useQuery({
    queryKey: ['malformed-addresses', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];

      // Fetch all properties with empty city, state, OR zip
      const { data, error } = await supabase
        .from('properties')
        .select('id, address, city, state, zip')
        .eq('company_id', company.id)
        .or('city.is.null,city.eq.,state.is.null,state.eq.,zip.is.null,zip.eq.');

      if (error) throw error;

      // Return all incomplete addresses for processing
      return (data || []).map(prop => ({
        id: prop.id,
        address: prop.address,
        city: prop.city || '',
        state: prop.state || '',
        zip: prop.zip || '',
      }));
    },
    enabled: !!company?.id,
  });
}

// Try to parse a single address locally
export function tryLocalParse(property: MalformedProperty): { success: boolean; parsed: ReturnType<typeof parseFullAddress> } {
  const fullString = [property.address, property.city, property.state, property.zip]
    .filter(p => p.trim())
    .join(', ');
  
  const parsed = parseFullAddress(fullString);
  const success = parsed.isValid && !!parsed.city && !!parsed.state && !!parsed.zip;
  
  return { success, parsed };
}

// Hook for manually updating a property address
export function useUpdatePropertyAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (property: { id: string; address: string; city: string; state: string; zip: string }) => {
      const { error } = await supabase
        .from('properties')
        .update({
          address: property.address,
          city: property.city,
          state: property.state,
          zip: property.zip,
        })
        .eq('id', property.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['malformed-addresses'] });
      queryClient.invalidateQueries({ queryKey: ['property-count'] });
    },
  });
}

// Hook for fixing a single address via Geocodio
export function useFixSingleAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (property: MalformedProperty) => {
      const parts = [property.address, property.city, property.state, property.zip].filter(p => p.trim());
      
      const { data, error } = await supabase.functions.invoke('verify-address-batch', {
        body: { addresses: [{ address: parts.join(', '), city: '', state: '', zip: '', index: 0 }] },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Failed to verify address');
      }

      const result = data.results?.[0];
      if (!result?.success || !result?.standardized?.city || !result?.standardized?.state || !result?.standardized?.zip) {
        throw new Error('Geocodio could not parse this address');
      }

      // Update property in database
      const { error: updateError } = await supabase
        .from('properties')
        .update({
          address: result.standardized.street,
          city: result.standardized.city,
          state: result.standardized.state,
          zip: result.standardized.zip,
          latitude: result.latitude,
          longitude: result.longitude,
        })
        .eq('id', property.id);

      if (updateError) throw updateError;
      
      return result.standardized;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['malformed-addresses'] });
      queryClient.invalidateQueries({ queryKey: ['property-count'] });
    },
  });
}

// Hook for applying local parse result to database
export function useApplyLocalParse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ propertyId, parsed }: { propertyId: string; parsed: ReturnType<typeof parseFullAddress> }) => {
      const { error } = await supabase
        .from('properties')
        .update({
          address: parsed.street,
          city: parsed.city,
          state: parsed.state,
          zip: parsed.zip,
        })
        .eq('id', propertyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['malformed-addresses'] });
      queryClient.invalidateQueries({ queryKey: ['property-count'] });
    },
  });
}

export function useFixAddresses() {
  const { company } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (properties: MalformedProperty[]): Promise<FixAddressesResult> => {
      if (!company?.id || properties.length === 0) return { fixed: 0, failed: [], locallyParsed: 0, geocodioFixed: 0 };

      const toastId = toast.loading(`Processing ${properties.length} addresses...`);

      // Step 1: Try local parsing first
      const locallyParsed: { prop: MalformedProperty; parsed: ReturnType<typeof parseFullAddress> }[] = [];
      const needsGeocoding: MalformedProperty[] = [];

      for (const prop of properties) {
        const { success, parsed } = tryLocalParse(prop);
        if (success) {
          locallyParsed.push({ prop, parsed });
        } else {
          needsGeocoding.push(prop);
        }
      }

      toast.loading(`Local parse: ${locallyParsed.length} parseable, ${needsGeocoding.length} need Geocodio...`, { id: toastId });

      // Step 2: Update locally parsed addresses in DB
      let localFixed = 0;
      const CHUNK_SIZE = 50;
      
      for (let i = 0; i < locallyParsed.length; i += CHUNK_SIZE) {
        const chunk = locallyParsed.slice(i, i + CHUNK_SIZE);
        await Promise.all(
          chunk.map(async ({ prop, parsed }) => {
            const { error } = await supabase
              .from('properties')
              .update({
                address: parsed.street,
                city: parsed.city,
                state: parsed.state,
                zip: parsed.zip,
              })
              .eq('id', prop.id);
            if (!error) localFixed++;
          })
        );
      }

      // Step 3: Send remaining to Geocodio
      let geocodioFixed = 0;
      const failed: MalformedProperty[] = [];

      if (needsGeocoding.length > 0) {
        toast.loading(`Sending ${needsGeocoding.length} to Geocodio...`, { id: toastId });

        const addressesToVerify = needsGeocoding.map((prop, idx) => {
          const parts = [prop.address, prop.city, prop.state, prop.zip].filter(p => p.trim());
          return {
            address: parts.join(', '),
            city: '',
            state: '',
            zip: '',
            index: idx,
          };
        });

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
              const prop = needsGeocoding[result.index];
              
              if (result.success && result.standardized && 
                  result.standardized.city && result.standardized.state && result.standardized.zip) {
                const { error: updateError } = await supabase
                  .from('properties')
                  .update({
                    address: result.standardized.street,
                    city: result.standardized.city,
                    state: result.standardized.state,
                    zip: result.standardized.zip,
                    latitude: result.latitude,
                    longitude: result.longitude,
                  })
                  .eq('id', prop.id);

                if (!updateError) {
                  geocodioFixed++;
                } else {
                  failed.push(prop);
                }
              } else {
                failed.push(prop);
              }
            })
          );
        }
      }

      const totalFixed = localFixed + geocodioFixed;
      
      if (failed.length > 0) {
        toast.warning(`Fixed ${totalFixed} (${localFixed} local, ${geocodioFixed} Geocodio), ${failed.length} failed`, { id: toastId });
      } else {
        toast.success(`Fixed all ${totalFixed} addresses (${localFixed} local, ${geocodioFixed} Geocodio)`, { id: toastId });
      }
      
      return { fixed: totalFixed, failed, locallyParsed: localFixed, geocodioFixed };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['malformed-addresses'] });
      queryClient.invalidateQueries({ queryKey: ['property-count'] });
    },
  });
}
